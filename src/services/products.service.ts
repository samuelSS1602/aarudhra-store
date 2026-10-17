import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { connectDB, withTransaction } from "@/lib/mongodb";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { escapeRegex, slugify } from "@/lib/utils";
import { toAdminProductDTO, toProductCardDTO, toProductDetailDTO } from "@/lib/serialize";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { can } from "@/lib/permissions";
import type { ProductInput, ProductListQuery } from "@/lib/validation/schemas";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { Order } from "@/models/Order";
import { InventoryLog } from "@/models/misc";
import { audit } from "./audit.service";
import { cached, TAGS } from "@/lib/cache";
import { deleteImage } from "@/lib/media-store";

/** Deletes MongoDB-stored photos that are no longer referenced (keeps the free 512 MB tier tidy). */
async function releaseImages(before: { publicId?: string | null }[], after: { publicId?: string | null }[] = []) {
  const keep = new Set(after.map((i) => i.publicId).filter(Boolean));
  for (const img of before) {
    const pid = img.publicId ?? "";
    if (pid.startsWith("mongo:") && !keep.has(pid)) await deleteImage(pid.slice("mongo:".length));
  }
}

/** Fields that are safe to send to customers (costPrice is excluded by schema `select: false`). */
const PUBLIC_FIELDS =
  "name slug sku brand images price originalPrice discountPercent stock lowStockThreshold variants categoryId description specifications tags tax.gstRate tax.inclusive seo weightGrams status featured salesCount createdAt updatedAt";
const CARD_FIELDS = "name slug brand images price originalPrice discountPercent stock lowStockThreshold variants categoryId";

/* ------------------------------- Storefront ------------------------------- */

type CategoryRef = { _id: string; name: string; slug: string; status: string };

/**
 * All categories (small list) from the data cache. Resolving category slugs, hidden
 * categories and display names from here saves a database round-trip per page.
 */
const getCategoryRefs = cached(
  async (): Promise<CategoryRef[]> => {
    await connectDB();
    const cats = await Category.find().select("name slug status").lean();
    return cats.map((c) => ({ _id: String(c._id), name: c.name, slug: c.slug, status: c.status }));
  },
  "category-refs",
  [TAGS.catalog],
  300,
);

function withCategory<T extends { categoryId?: unknown }>(items: T[], refs: CategoryRef[]) {
  const byId = new Map(refs.map((r) => [r._id, r]));
  return items.map((p) => ({ ...p, categoryId: byId.get(String(p.categoryId)) ?? null }));
}

export async function listProducts(query: ProductListQuery) {
  await connectDB();
  const filter: Record<string, unknown> = { status: "active" };
  const refs = await getCategoryRefs();

  if (query.category) {
    const cat = refs.find((c) => c.slug === query.category!.toLowerCase() && c.status === "active");
    if (!cat) return { items: [], total: 0, page: 1, pageSize: query.pageSize, totalPages: 0, facets: { brands: [], priceRange: null } };
    filter.categoryId = new Types.ObjectId(cat._id);
  } else {
    // Hide products whose category has been disabled.
    const inactive = refs.filter((c) => c.status === "inactive");
    if (inactive.length) filter.categoryId = { $nin: inactive.map((c) => new Types.ObjectId(c._id)) };
  }

  const facetFilter = { ...filter };
  if (query.brand) filter.brand = { $in: query.brand.split(",").map((b) => b.trim()).filter(Boolean).slice(0, 20) };
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {
      ...(query.minPrice !== undefined ? { $gte: Math.round(query.minPrice * 100) } : {}),
      ...(query.maxPrice !== undefined ? { $lte: Math.round(query.maxPrice * 100) } : {}),
    };
  }
  if (query.availability === "in_stock") filter.stock = { $gt: 0 };
  if (query.onSale) filter.discountPercent = { $gt: 0 };

  const sortKey = query.sort ?? (query.q ? "relevance" : "newest");
  const sorts: Record<string, Record<string, 1 | -1 | { $meta: "textScore" }>> = {
    newest: { createdAt: -1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: 1 },
    popular: { salesCount: -1, createdAt: -1 },
    discount: { discountPercent: -1, createdAt: -1 },
  };

  let searchFilter = filter;
  let sort = sorts[sortKey] ?? sorts.newest!;
  let useTextScore = false;

  if (query.q) {
    const textFilter = { ...filter, $text: { $search: query.q } };
    const textHits = await Product.countDocuments(textFilter);
    if (textHits > 0) {
      searchFilter = textFilter;
      if (sortKey === "relevance") {
        sort = { score: { $meta: "textScore" }, salesCount: -1 };
        useTextScore = true;
      }
    } else {
      // Partial-word fallback (e.g. "note" → "Notebook"), escaped to prevent regex injection.
      const rx = { $regex: escapeRegex(query.q), $options: "i" };
      searchFilter = { ...filter, $or: [{ name: rx }, { brand: rx }, { tags: rx }, { sku: rx }] };
      if (sortKey === "relevance") sort = { salesCount: -1, createdAt: -1 };
    }
  }

  const skip = (query.page - 1) * query.pageSize;
  const finder = Product.find(searchFilter, useTextScore ? { score: { $meta: "textScore" } } : undefined)
    .select(CARD_FIELDS)
    .sort(sort)
    .skip(skip)
    .limit(query.pageSize)
    .lean();

  const [items, total, brands, priceAgg] = await Promise.all([
    finder,
    Product.countDocuments(searchFilter),
    Product.distinct("brand", facetFilter),
    Product.aggregate<{ min: number; max: number }>([
      { $match: facetFilter },
      { $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } },
    ]),
  ]);

  return {
    items: withCategory(items, refs).map(toProductCardDTO),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.ceil(total / query.pageSize),
    facets: {
      brands: (brands as string[]).filter(Boolean).sort((a, b) => a.localeCompare(b)),
      priceRange: priceAgg[0] ? { min: priceAgg[0].min, max: priceAgg[0].max } : null,
    },
  };
}

export async function suggestProducts(q: string, limit = 6) {
  await connectDB();
  const term = q.trim();
  if (term.length < 2) return [];
  const rx = { $regex: escapeRegex(term), $options: "i" };
  const items = await Product.find({ status: "active", $or: [{ name: rx }, { brand: rx }, { tags: rx }] })
    .select("name slug images price brand")
    .sort({ salesCount: -1 })
    .limit(limit)
    .lean();
  return items.map((p) => ({ id: String(p._id), name: p.name, slug: p.slug, price: p.price, brand: p.brand ?? "", image: p.images?.[0]?.url ?? null }));
}

export async function getProductBySlug(slug: string) {
  await connectDB();
  const [p, refs] = await Promise.all([
    Product.findOne({ slug: String(slug).toLowerCase(), status: "active" }).select(PUBLIC_FIELDS).lean(),
    getCategoryRefs(),
  ]);
  if (!p) return null;
  const [withCat] = withCategory([p], refs);
  const cat = withCat!.categoryId;
  if (cat && cat.status === "inactive") return null;
  return toProductDetailDTO(withCat!);
}

export async function getRelatedProducts(productId: string, categoryId: string | undefined, limit = 8) {
  if (!categoryId) return [];
  await connectDB();
  const items = await Product.find({ status: "active", categoryId, _id: { $ne: productId } })
    .select(CARD_FIELDS)
    .sort({ salesCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  return items.map(toProductCardDTO);
}

export async function getProductCollections(featuredIds: string[] = []) {
  await connectDB();
  const base = { status: "active" };
  const featuredQuery = featuredIds.length
    ? Product.find({ ...base, _id: { $in: featuredIds.map((i) => new Types.ObjectId(i)) } })
    : Product.find({ ...base, featured: true });
  const [featured, bestSellers, newArrivals, offers, essentials] = await Promise.all([
    featuredQuery.select(CARD_FIELDS).populate("categoryId", "name slug").limit(8).lean(),
    // "Best sellers" only lists products that have actually sold.
    Product.find({ ...base, salesCount: { $gt: 0 } }).select(CARD_FIELDS).populate("categoryId", "name slug").sort({ salesCount: -1 }).limit(8).lean(),
    Product.find(base).select(CARD_FIELDS).populate("categoryId", "name slug").sort({ createdAt: -1 }).limit(8).lean(),
    Product.find({ ...base, discountPercent: { $gt: 0 } }).select(CARD_FIELDS).populate("categoryId", "name slug").sort({ discountPercent: -1 }).limit(8).lean(),
    Product.find({ ...base, price: { $lte: 9900 }, stock: { $gt: 0 } }).select(CARD_FIELDS).populate("categoryId", "name slug").sort({ salesCount: -1, price: 1 }).limit(8).lean(),
  ]);
  return {
    featured: featured.map(toProductCardDTO),
    bestSellers: bestSellers.map(toProductCardDTO),
    newArrivals: newArrivals.map(toProductCardDTO),
    offers: offers.map(toProductCardDTO),
    essentials: essentials.map(toProductCardDTO),
  };
}

/** Homepage collections from the data cache; refreshed on any catalog/stock change and at most every 60s. */
export const getProductCollectionsCached = cached((featuredIds: string[]) => getProductCollections(featuredIds), "home-collections", [TAGS.catalog], 60);

export async function listProductsForSitemap() {
  await connectDB();
  return Product.find({ status: "active" }).select("slug updatedAt").lean();
}

/* ---------------------------------- Admin --------------------------------- */

export async function listAdminProducts(opts: {
  q?: string;
  status?: string;
  categoryId?: string;
  stock?: "low" | "out";
  page: number;
  pageSize: number;
}) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status && ["active", "draft", "archived"].includes(opts.status)) filter.status = opts.status;
  else filter.status = { $ne: "archived" };
  if (opts.categoryId && Types.ObjectId.isValid(opts.categoryId)) filter.categoryId = new Types.ObjectId(opts.categoryId);
  if (opts.q) {
    const rx = { $regex: escapeRegex(opts.q), $options: "i" };
    filter.$or = [{ name: rx }, { sku: rx }, { brand: rx }, { "variants.sku": rx }, { barcode: rx }];
  }
  if (opts.stock === "out") filter.stock = 0;
  if (opts.stock === "low") filter.$expr = { $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockThreshold"] }] };

  const [items, total] = await Promise.all([
    Product.find(filter)
      .populate("categoryId", "name slug")
      .sort({ updatedAt: -1 })
      .skip((opts.page - 1) * opts.pageSize)
      .limit(opts.pageSize)
      .lean(),
    Product.countDocuments(filter),
  ]);
  return { items: items.map((p) => toAdminProductDTO(p, false)), total };
}

export async function getAdminProduct(id: string, admin: CurrentAdmin) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) throw notFound("Product not found.");
  const includeCost = can(admin.role, "products:cost");
  const q = Product.findById(id).populate("categoryId", "name slug");
  if (includeCost) q.select("+costPrice");
  const p = await q.lean();
  if (!p) throw notFound("Product not found.");
  return toAdminProductDTO(p, includeCost);
}

async function uniqueProductSlug(base: string, excludeId?: Types.ObjectId) {
  const root = slugify(base) || "product";
  let slug = root;
  for (let i = 2; await Product.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) slug = `${root}-${i}`;
  return slug;
}

async function assertSkusAvailable(input: ProductInput, excludeId?: Types.ObjectId) {
  const skus = [input.sku, ...input.variants.map((v) => v.sku)];
  const clash = await Product.findOne({
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    $or: [{ sku: { $in: skus } }, { "variants.sku": { $in: skus } }],
  })
    .select("name")
    .lean();
  if (clash) throw conflict(`SKU already used by “${clash.name}”.`, { field: "sku" });
}

export async function createProduct(input: ProductInput, admin: CurrentAdmin) {
  await connectDB();
  if (!(await Category.exists({ _id: input.categoryId }))) throw badRequest("Selected category does not exist.");
  await assertSkusAvailable(input);
  const slug = input.slug ? input.slug : await uniqueProductSlug(input.name);
  if (await Product.exists({ slug })) throw conflict("A product with this slug already exists.", { field: "slug" });

  const data: Record<string, unknown> = { ...input, slug, categoryId: new Types.ObjectId(input.categoryId) };
  if (!can(admin.role, "products:cost")) delete data.costPrice;
  // Variant ids are assigned by the database; any client-sent _id is dropped.
  data.variants = input.variants.map((v) => {
    const { _id: _ignored, ...rest } = v; // eslint-disable-line @typescript-eslint/no-unused-vars
    return rest;
  });

  const product = await withTransaction(async (session) => {
    const [p] = await Product.create([data], { session });
    const logs = p!.variants.length
      ? p!.variants
          .filter((v) => v.stock > 0)
          .map((v) => ({ productId: p!._id, variantId: v._id, sku: v.sku, productName: p!.name, adjustmentType: "initial", quantityChange: v.stock, previousStock: 0, newStock: v.stock, reason: "Initial stock", adminId: new Types.ObjectId(admin.id), adminName: admin.name }))
      : p!.stock > 0
        ? [{ productId: p!._id, sku: p!.sku, productName: p!.name, adjustmentType: "initial", quantityChange: p!.stock, previousStock: 0, newStock: p!.stock, reason: "Initial stock", adminId: new Types.ObjectId(admin.id), adminName: admin.name }]
        : [];
    if (logs.length) await InventoryLog.insertMany(logs, { session });
    return p!;
  });

  await audit(admin, "product.create", "product", product._id, { name: product.name, sku: product.sku, price: product.price });
  return getAdminProduct(String(product._id), admin);
}

/**
 * Updates product details. Stock levels of existing items are NOT changed here —
 * they move only through inventory adjustments (which are logged). New variants
 * may be created with an initial stock.
 */
export async function updateProduct(id: string, input: ProductInput, admin: CurrentAdmin) {
  await connectDB();
  const product = await Product.findById(id).select("+costPrice");
  if (!product) throw notFound("Product not found.");
  if (!(await Category.exists({ _id: input.categoryId }))) throw badRequest("Selected category does not exist.");
  await assertSkusAvailable(input, product._id);
  const slug = input.slug ? input.slug : product.slug;
  if (slug !== product.slug && (await Product.exists({ slug, _id: { $ne: product._id } }))) {
    throw conflict("A product with this slug already exists.", { field: "slug" });
  }

  const before = { name: product.name, price: product.price, originalPrice: product.originalPrice, status: product.status, sku: product.sku };
  const previousImages = product.images.map((i) => ({ publicId: i.publicId }));
  const existingVariants = new Map(product.variants.map((v) => [String(v._id), v]));
  const newVariantLogs: { sku: string; stock: number }[] = [];

  const variants = input.variants.map((v) => {
    const existing = v._id ? existingVariants.get(v._id) : undefined;
    if (existing) return { ...v, _id: existing._id, stock: existing.stock };
    if (v.stock > 0) newVariantLogs.push({ sku: v.sku, stock: v.stock });
    const { _id, ...rest } = v;
    void _id;
    return rest;
  });

  // Removing a variant that still has stock would silently destroy inventory.
  const keptIds = new Set(variants.map((v) => ("_id" in v && v._id ? String(v._id) : "")));
  for (const [vid, v] of existingVariants) {
    if (!keptIds.has(vid) && v.stock > 0) {
      throw conflict(`Variant “${v.name}” still has ${v.stock} in stock. Set it inactive or adjust stock to 0 first.`);
    }
  }

  const update: Record<string, unknown> = {
    ...input,
    slug,
    categoryId: new Types.ObjectId(input.categoryId),
    variants,
  };
  delete update.stock; // stock is managed via inventory adjustments
  if (!can(admin.role, "products:cost")) delete update.costPrice;
  if (product.variants.length === 0 && variants.length > 0 && product.stock > 0) {
    throw conflict("This product has stock without variants. Adjust its stock to 0 before adding variants.");
  }

  product.set(update);
  await product.save();
  await releaseImages(previousImages, input.images);

  for (const log of newVariantLogs) {
    const v = product.variants.find((x) => x.sku === log.sku);
    await InventoryLog.create({ productId: product._id, variantId: v?._id, sku: log.sku, productName: product.name, adjustmentType: "initial", quantityChange: log.stock, previousStock: 0, newStock: log.stock, reason: "New variant initial stock", adminId: new Types.ObjectId(admin.id), adminName: admin.name });
  }

  await audit(admin, "product.update", "product", product._id, {
    before,
    after: { name: product.name, price: product.price, originalPrice: product.originalPrice, status: product.status, sku: product.sku },
  });
  return getAdminProduct(String(product._id), admin);
}

export async function setProductStatus(id: string, status: "active" | "draft" | "archived", admin: CurrentAdmin) {
  await connectDB();
  const p = await Product.findByIdAndUpdate(id, { $set: { status } }, { new: true }).lean();
  if (!p) throw notFound("Product not found.");
  await audit(admin, `product.${status === "archived" ? "archive" : "status"}`, "product", p._id, { status });
  return toAdminProductDTO(p, false);
}

/** Hard delete is only allowed for products never ordered; otherwise archive instead. */
export async function deleteProduct(id: string, admin: CurrentAdmin) {
  await connectDB();
  const p = await Product.findById(id).lean();
  if (!p) throw notFound("Product not found.");
  const ordered = await Order.exists({ "items.productId": p._id });
  if (ordered) throw conflict("This product appears in past orders and can't be deleted. Archive it instead.");
  await Product.deleteOne({ _id: p._id });
  await releaseImages(p.images ?? []);
  await audit(admin, "product.delete", "product", p._id, { name: p.name, sku: p.sku });
}

export async function getLowStockProducts(limit = 10) {
  await connectDB();
  const pipeline: PipelineStage[] = [
    { $match: { status: "active", $expr: { $lte: ["$stock", "$lowStockThreshold"] } } },
    { $sort: { stock: 1 } },
    { $limit: limit },
    { $project: { name: 1, sku: 1, stock: 1, lowStockThreshold: 1, slug: 1 } },
  ];
  return Product.aggregate(pipeline);
}
