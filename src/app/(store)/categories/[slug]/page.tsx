import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { productListQuery } from "@/lib/validation/schemas";
import { breadcrumbJsonLd, JsonLd } from "@/lib/seo";
import { getActiveCategoryBySlug, listActiveCategoriesCached } from "@/services/categories.service";
import { listProducts } from "@/services/products.service";
import { ProductListing } from "@/components/products/product-listing";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = await getActiveCategoryBySlug(slug);
  if (!cat) return { title: "Category not found", robots: { index: false } };
  return {
    title: cat.name,
    description: cat.description || `Shop ${cat.name} at affordable prices from Aarudhra Smart Store, Palani.`,
    alternates: { canonical: `/categories/${cat.slug}` },
    openGraph: { title: cat.name, images: cat.image?.url ? [cat.image.url] : undefined },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const cat = await getActiveCategoryBySlug(slug);
  if (!cat) notFound();
  const sp = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const parsed = productListQuery.safeParse(sp);
  const query = parsed.success ? parsed.data : productListQuery.parse({});
  const [result, categories] = await Promise.all([listProducts({ ...query, category: cat.slug }), listActiveCategoriesCached()]);
  const crumbs = [{ name: "Home", href: "/" }, { name: "Categories", href: "/categories" }, { name: cat.name, href: `/categories/${cat.slug}` }];

  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={crumbs} />
      <div className="mb-6 mt-3">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{cat.name}</h1>
        {cat.description && <p className="mt-2 max-w-2xl text-muted-foreground">{cat.description}</p>}
      </div>
      <ProductListing result={result} categories={categories} activeCategory={cat.slug} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
