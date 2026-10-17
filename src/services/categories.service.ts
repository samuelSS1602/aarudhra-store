import "server-only";
import { Types } from "mongoose";
import type { z } from "zod";
import { connectDB, withTransaction } from "@/lib/mongodb";
import { conflict, notFound } from "@/lib/errors";
import { slugify } from "@/lib/utils";
import { toCategoryDTO } from "@/lib/serialize";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import type { categoryInputSchema } from "@/lib/validation/schemas";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { audit } from "./audit.service";
import { cached, TAGS } from "@/lib/cache";

type CategoryInput = z.infer<typeof categoryInputSchema>;

export async function listActiveCategories() {
  await connectDB();
  const [cats, counts] = await Promise.all([
    Category.find({ status: "active" }).sort({ displayOrder: 1, name: 1 }).lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      { $match: { status: "active" } },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ]),
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return cats.map((c) => toCategoryDTO(c, map.get(String(c._id)) ?? 0));
}

/** Storefront category list from the data cache (invalidated on catalog changes). */
export const listActiveCategoriesCached = cached(() => listActiveCategories(), "active-categories", [TAGS.catalog], 300);

export async function getActiveCategoryBySlug(slug: string) {
  await connectDB();
  const c = await Category.findOne({ slug: String(slug).toLowerCase(), status: "active" }).lean();
  return c ? toCategoryDTO(c) : null;
}

export async function listAllCategories() {
  await connectDB();
  const [cats, counts] = await Promise.all([
    Category.find().sort({ displayOrder: 1, name: 1 }).lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([{ $group: { _id: "$categoryId", count: { $sum: 1 } } }]),
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.count]));
  return cats.map((c) => toCategoryDTO(c, map.get(String(c._id)) ?? 0));
}

async function uniqueSlug(base: string, excludeId?: string) {
  const root = slugify(base) || "category";
  let slug = root;
  for (let i = 2; await Category.exists({ slug, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }); i++) slug = `${root}-${i}`;
  return slug;
}

export async function createCategory(input: CategoryInput, admin: CurrentAdmin) {
  await connectDB();
  const slug = input.slug ? input.slug : await uniqueSlug(input.name);
  if (await Category.exists({ slug })) throw conflict("A category with this slug already exists.", { field: "slug" });
  const max = await Category.findOne().sort({ displayOrder: -1 }).select("displayOrder").lean();
  const cat = await Category.create({
    ...input,
    slug,
    image: input.image ?? null,
    displayOrder: input.displayOrder || (max?.displayOrder ?? 0) + 1,
  });
  await audit(admin, "category.create", "category", cat._id, { name: cat.name, slug });
  return toCategoryDTO(cat.toObject());
}

export async function updateCategory(id: string, input: CategoryInput, admin: CurrentAdmin) {
  await connectDB();
  const cat = await Category.findById(id);
  if (!cat) throw notFound("Category not found.");
  const slug = input.slug ? input.slug : cat.slug;
  if (slug !== cat.slug && (await Category.exists({ slug, _id: { $ne: cat._id } }))) {
    throw conflict("A category with this slug already exists.", { field: "slug" });
  }
  const before = { name: cat.name, slug: cat.slug, status: cat.status };
  cat.set({ ...input, slug, image: input.image ?? null });
  await cat.save();
  await audit(admin, "category.update", "category", cat._id, { before, after: { name: cat.name, slug, status: cat.status } });
  return toCategoryDTO(cat.toObject());
}

export async function reorderCategories(ids: string[], admin: CurrentAdmin) {
  await connectDB();
  await Category.bulkWrite(
    ids.map((cid, index) => ({
      updateOne: { filter: { _id: new Types.ObjectId(cid) }, update: { $set: { displayOrder: index + 1 } } },
    })),
  );
  await audit(admin, "category.reorder", "category", null, { count: ids.length });
}

/**
 * Deletes a category. Refuses while products reference it unless `reassignTo`
 * names another category, in which case products are moved atomically first.
 */
export async function deleteCategory(id: string, admin: CurrentAdmin, reassignTo?: string) {
  await connectDB();
  const cat = await Category.findById(id).lean();
  if (!cat) throw notFound("Category not found.");
  const productCount = await Product.countDocuments({ categoryId: cat._id });

  if (productCount > 0 && !reassignTo) {
    throw conflict(
      `This category still has ${productCount} product${productCount === 1 ? "" : "s"}. Reassign them to another category before deleting.`,
      { productCount },
    );
  }
  if (reassignTo) {
    if (reassignTo === id) throw conflict("Choose a different category to move products into.");
    const target = await Category.exists({ _id: reassignTo });
    if (!target) throw notFound("The category to reassign products to was not found.");
  }

  await withTransaction(async (session) => {
    if (reassignTo && productCount > 0) {
      await Product.updateMany({ categoryId: cat._id }, { $set: { categoryId: new Types.ObjectId(reassignTo) } }, { session: session ?? undefined });
    }
    // Re-check inside the transaction to avoid racing with a concurrent product create.
    const remaining = await Product.countDocuments({ categoryId: cat._id }).session(session);
    if (remaining > 0) throw conflict("Products were added to this category meanwhile. Please try again.");
    await Category.deleteOne({ _id: cat._id }, { session: session ?? undefined });
  });

  await audit(admin, "category.delete", "category", cat._id, { name: cat.name, reassignTo: reassignTo ?? null, productCount });
}
