import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { findImage, storeImage } from "@/lib/media-store";
import { imageSchema } from "@/lib/validation/common";
import { productInputSchema } from "@/lib/validation/schemas";
import { createProduct, deleteProduct, updateProduct } from "@/services/products.service";
import { GET as mediaRoute } from "@/app/media/[file]/route";
import { makeAdmin, makeCategory, request } from "./helpers";

async function photo(width = 2400, height = 1200) {
  return new Uint8Array(await sharp({ create: { width, height, channels: 3, background: "#2b3590" } }).jpeg().toBuffer());
}
const serve = (file: string, headers: Record<string, string> = {}) => mediaRoute(request(`/media/${file}`, { headers }), { params: Promise.resolve({ file }) });

describe("MongoDB image storage", () => {
  it("resizes uploads to WebP within 1600px and stores them in GridFS", async () => {
    const img = await storeImage(await photo(), { folder: "products", uploadedBy: "test" });
    expect(img.url).toMatch(/^\/media\/[a-f0-9]{24}\.webp$/);
    expect(img.publicId).toMatch(/^mongo:/);
    expect(img.width).toBe(1600);
    expect(img.height).toBe(800);
    const meta = await findImage(img.publicId.slice(6));
    expect(meta?.metadata?.contentType).toBe("image/webp");
  });

  it("never enlarges small images", async () => {
    const img = await storeImage(await photo(300, 200), { folder: "products", uploadedBy: "test" });
    expect([img.width, img.height]).toEqual([300, 200]);
  });

  it("serves images with long-lived caching and supports 304 revalidation", async () => {
    const img = await storeImage(await photo(), { folder: "products", uploadedBy: "test" });
    const file = img.url.split("/").pop()!;
    const res = await serve(file);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("cache-control")).toContain("immutable");
    const body = new Uint8Array(await res.arrayBuffer());
    expect((await sharp(body).metadata()).format).toBe("webp");
    const again = await serve(file, { "if-none-match": res.headers.get("etag")! });
    expect(again.status).toBe(304);
  });

  it("returns 404 for unknown or malformed image paths", async () => {
    expect((await serve("aaaaaaaaaaaaaaaaaaaaaaaa.webp")).status).toBe(404);
    expect((await serve("../../etc/passwd")).status).toBe(404);
    expect((await serve("not-an-id.png")).status).toBe(404);
  });

  it("rejects files that aren't decodable images", async () => {
    await expect(storeImage(new TextEncoder().encode("not an image at all"), { folder: "products", uploadedBy: "t" })).rejects.toMatchObject({ status: 415 });
  });

  it("only accepts images uploaded through the store", () => {
    expect(imageSchema.safeParse({ url: "/media/0123456789abcdef01234567.webp" }).success).toBe(true);
    expect(imageSchema.safeParse({ url: "https://res.cloudinary.com/demo/image/upload/x.jpg" }).success).toBe(true);
    expect(imageSchema.safeParse({ url: "https://evil.example/x.jpg" }).success).toBe(false);
    expect(imageSchema.safeParse({ url: "/media/../secret.webp" }).success).toBe(false);
  });

  it("deletes photos removed from a product, and all photos of a deleted product", async () => {
    const admin = await makeAdmin("owner");
    const cat = await makeCategory();
    const a = await storeImage(await photo(), { folder: "products", uploadedBy: admin.id });
    const b = await storeImage(await photo(), { folder: "products", uploadedBy: admin.id });
    const base = { name: "Photo Notebook", sku: "PH-1", categoryId: String(cat._id), price: 50 };
    const p = await createProduct(productInputSchema.parse({ ...base, images: [a, b] }), admin);

    await updateProduct(p.id, productInputSchema.parse({ ...base, slug: p.slug, images: [b] }), admin);
    expect(await findImage(a.publicId.slice(6))).toBeNull();
    expect(await findImage(b.publicId.slice(6))).not.toBeNull();

    await deleteProduct(p.id, admin);
    expect(await findImage(b.publicId.slice(6))).toBeNull();
  });
});
