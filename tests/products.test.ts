import { describe, expect, it } from "vitest";
import { productInputSchema, type ProductInput } from "@/lib/validation/schemas";
import { createProduct, getAdminProduct, getProductBySlug, listProducts, updateProduct, deleteProduct } from "@/services/products.service";
import { adjustInventory } from "@/services/inventory.service";
import { deleteCategory } from "@/services/categories.service";
import { createOrder } from "@/services/orders.service";
import { sniffImageType, validateImageFile } from "@/lib/cloudinary";
import { productListQuery } from "@/lib/validation/schemas";
import { Product } from "@/models/Product";
import { InventoryLog } from "@/models/misc";
import { POST as createProductRoute } from "@/app/api/admin/products/route";
import { checkoutInput, customerCookie, makeAdmin, makeCategory, makeCustomer, makeProduct, noParams, request } from "./helpers";

function input(categoryId: string, over: Record<string, unknown> = {}): ProductInput {
  return productInputSchema.parse({
    name: "Spiral Notebook A5",
    sku: "nb-a5-001",
    categoryId,
    price: 79.5,
    originalPrice: 99,
    costPrice: 40,
    stock: 25,
    description: "200 pages",
    ...over,
  });
}

describe("Product management", () => {
  it("creates a product as an admin, in paise, with an initial inventory log", async () => {
    const admin = await makeAdmin("owner");
    const cat = await makeCategory();
    const p = await createProduct(input(String(cat._id)), admin);
    expect(p.price).toBe(7950);
    expect(p.originalPrice).toBe(9900);
    expect(p.sku).toBe("NB-A5-001");
    expect(p.discountPercent).toBe(20);
    expect(p.costPrice).toBe(4000);
    const logs = await InventoryLog.find({ productId: p.id }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ adjustmentType: "initial", quantityChange: 25, newStock: 25 });
  });

  it("rejects product creation by a customer", async () => {
    const c = await makeCustomer();
    const cat = await makeCategory();
    const res = await createProductRoute(
      request("/api/admin/products", { body: { name: "Hack", sku: "H1", categoryId: String(cat._id), price: 1 }, cookie: await customerCookie(c.id) }),
      noParams,
    );
    expect(res.status).toBe(401);
    expect(await Product.countDocuments()).toBe(0);
  });

  it("validates prices and stock", () => {
    const cat = "a".repeat(24);
    expect(productInputSchema.safeParse({ name: "x", sku: "x", categoryId: cat, price: -1 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "x", sku: "x", categoryId: cat, price: 0 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "x", sku: "x", categoryId: cat, price: 50, originalPrice: 40 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "x", sku: "x", categoryId: cat, price: 50, stock: -3 }).success).toBe(false);
    expect(productInputSchema.safeParse({ name: "x", sku: "x", categoryId: cat, price: 50, stock: 1.5 }).success).toBe(false);
    // Mass-assignment: unknown fields like salesCount are stripped.
    const parsed = productInputSchema.parse({ name: "x", sku: "x", categoryId: cat, price: 50, salesCount: 999, isDemo: true });
    expect(parsed).not.toHaveProperty("salesCount");
  });

  it("hides cost price from staff without the permission and from the storefront", async () => {
    const owner = await makeAdmin("owner");
    const staff = await makeAdmin("staff");
    const cat = await makeCategory();
    const p = await createProduct(input(String(cat._id)), owner);
    expect((await getAdminProduct(p.id, staff)).costPrice).toBeNull();
    const pub = await getProductBySlug(p.slug);
    expect(pub).not.toBeNull();
    expect(JSON.stringify(pub)).not.toContain("costPrice");
  });

  it("updates details and the change appears on the storefront", async () => {
    const admin = await makeAdmin("owner");
    const cat = await makeCategory();
    const p = await createProduct(input(String(cat._id)), admin);
    await updateProduct(p.id, input(String(cat._id), { name: "Spiral Notebook A5 — Premium", price: 85, slug: p.slug }), admin);
    const pub = await getProductBySlug(p.slug);
    expect(pub?.name).toBe("Spiral Notebook A5 — Premium");
    expect(pub?.price).toBe(8500);
    // Stock isn't silently changed by product edits.
    expect(pub?.stock).toBe(25);
    const list = await listProducts(productListQuery.parse({ q: "Premium" }));
    expect(list.items.map((i) => i.id)).toContain(p.id);
  });

  it("archived products disappear from the storefront", async () => {
    const admin = await makeAdmin("owner");
    const cat = await makeCategory();
    const p = await createProduct(input(String(cat._id), { status: "archived" }), admin);
    expect(await getProductBySlug(p.slug)).toBeNull();
  });

  it("rejects duplicate SKUs across products and variants", async () => {
    const admin = await makeAdmin("owner");
    const cat = await makeCategory();
    await createProduct(input(String(cat._id)), admin);
    await expect(createProduct(input(String(cat._id), { name: "Other", slug: "other" }), admin)).rejects.toMatchObject({ status: 409 });
  });

  it("protects ordered products from deletion and categories with products", async () => {
    const admin = await makeAdmin("owner");
    const c = await makeCustomer();
    const p = await makeProduct({ stock: 5 });
    await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    await expect(deleteProduct(String(p._id), admin)).rejects.toMatchObject({ status: 409 });
    await expect(deleteCategory(String(p.categoryId), admin)).rejects.toMatchObject({ status: 409 });
    const other = await makeCategory("Other");
    await deleteCategory(String(p.categoryId), admin, String(other._id));
    expect(String((await Product.findById(p._id).lean())?.categoryId)).toBe(String(other._id));
  });
});

describe("Inventory", () => {
  it("logs adjustments and never allows negative stock", async () => {
    const admin = await makeAdmin("manager");
    const p = await makeProduct({ stock: 3 });
    await adjustInventory({ productId: String(p._id), adjustmentType: "restock", quantityChange: 7, reason: "Supplier delivery" }, admin);
    expect((await Product.findById(p._id).lean())?.stock).toBe(10);
    await expect(adjustInventory({ productId: String(p._id), adjustmentType: "damage", quantityChange: -11, reason: "Broken" }, admin)).rejects.toMatchObject({ status: 409 });
    expect((await Product.findById(p._id).lean())?.stock).toBe(10);
    const logs = await InventoryLog.find({ productId: p._id }).lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ previousStock: 3, newStock: 10, reason: "Supplier delivery" });
  });

  it("keeps the product total in sync with variant stock", async () => {
    const admin = await makeAdmin("manager");
    const p = await makeProduct({ variants: [{ name: "Blue", sku: "V-BLUE", stock: 4 }, { name: "Red", sku: "V-RED", stock: 6 }] });
    expect(p.stock).toBe(10);
    await adjustInventory({ productId: String(p._id), variantId: String(p.variants[0]!._id), adjustmentType: "restock", quantityChange: 5, reason: "Restock" }, admin);
    const after = await Product.findById(p._id).lean();
    expect(after?.variants[0]?.stock).toBe(9);
    expect(after?.stock).toBe(15);
  });
});

describe("Image upload validation", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  it("accepts real images by magic bytes", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(validateImageFile({ size: 1000 }, png)).toBe("image/png");
  });
  it("rejects non-images even if renamed, and oversized files", () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    expect(() => validateImageFile({ size: html.length }, html)).toThrowError(/Only JPEG/);
    expect(() => validateImageFile({ size: 5 * 1024 * 1024 }, png)).toThrowError(/4 MB/);
    expect(() => validateImageFile({ size: 0 }, new Uint8Array())).toThrowError(/empty/);
  });
});
