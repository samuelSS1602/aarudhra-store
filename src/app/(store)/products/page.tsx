import type { Metadata } from "next";
import { productListQuery } from "@/lib/validation/schemas";
import { listProducts } from "@/services/products.service";
import { listActiveCategoriesCached } from "@/services/categories.service";
import { ProductListing } from "@/components/products/product-listing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function flatten(sp: Record<string, string | string[] | undefined>) {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const sp = flatten(await searchParams);
  if (sp.q) {
    return { title: `Search: ${sp.q.slice(0, 60)}`, robots: { index: false, follow: true }, alternates: { canonical: "/products" } };
  }
  return {
    title: "All products",
    description: "Browse stationery, office supplies, home essentials and daily-use products at affordable prices in Palani.",
    alternates: { canonical: "/products" },
  };
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = flatten(await searchParams);
  const parsed = productListQuery.safeParse(sp);
  const query = parsed.success ? parsed.data : productListQuery.parse({});
  const [result, categories] = await Promise.all([listProducts({ ...query, category: undefined }), listActiveCategoriesCached()]);

  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: query.q ? "Search results" : "All products" }]} />
      <h1 className="mb-6 mt-3 font-display text-3xl font-semibold sm:text-4xl">{query.q ? "Search results" : query.onSale ? "Special offers" : "All products"}</h1>
      <ProductListing result={result} categories={categories} />
    </div>
  );
}
