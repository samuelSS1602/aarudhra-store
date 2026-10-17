import type { MetadataRoute } from "next";
import { listProductsForSitemap } from "@/services/products.service";
import { listActiveCategories } from "@/services/categories.service";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = ["", "/products", "/categories", "/contact", "/policies/delivery", "/policies/returns"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === "" ? "daily" : "weekly",
    priority: p === "" ? 1 : 0.6,
  }));
  try {
    const [products, categories] = await Promise.all([listProductsForSitemap(), listActiveCategories()]);
    return [
      ...staticPages,
      ...categories.map((c) => ({ url: `${base}/categories/${c.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.7 })),
      ...products.map((p) => ({ url: `${base}/products/${p.slug}`, lastModified: p.updatedAt ? new Date(p.updatedAt as unknown as string) : now, changeFrequency: "weekly" as const, priority: 0.8 })),
    ];
  } catch {
    return staticPages;
  }
}
