import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RotateCcw, ShieldCheck, Store, Truck } from "lucide-react";
import { getProductBySlug, getRelatedProducts } from "@/services/products.service";
import { getSettings } from "@/services/settings.service";
import { breadcrumbJsonLd, JsonLd, productJsonLd } from "@/lib/seo";
import { formatINR, jpegImageUrl } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { ProductGallery } from "@/components/products/product-gallery";
import { PurchasePanel } from "@/components/products/purchase-panel";
import { ProductRail } from "@/components/storefront/sections";

// Pre-built and served from cache; rebuilt on any catalogue/settings change (see lib/cache.ts).
export const revalidate = 300;

/** Product pages are built on first visit, then cached (none at build time). */
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return { title: "Product not found", robots: { index: false } };
  const description = p.seo.description || p.description.slice(0, 160) || `Buy ${p.name} at ${formatINR(p.price)} from Aarudhra Smart Store, Palani.`;
  return {
    title: p.seo.title || p.name,
    description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title: p.seo.title || p.name, description, images: p.images.slice(0, 1).map((i) => ({ url: jpegImageUrl(i.url), alt: i.alt || p.name })) },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const [related, settings] = await Promise.all([getRelatedProducts(product.id, product.category?.id), getSettings()]);
  const c = settings.commerce;
  const delivery = c.deliveryOptions.filter((o) => o.enabled);

  const crumbs = [
    { name: "Home", href: "/" },
    ...(product.category ? [{ name: product.category.name, href: `/categories/${product.category.slug}` }] : []),
    { name: product.name, href: `/products/${product.slug}` },
  ];

  return (
    <div className="container-page py-6 sm:py-8">
      <Breadcrumbs items={crumbs} />
      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <ProductGallery key={product.id} images={product.images} name={product.name} discountPercent={product.discountPercent} />

        <div>
          {product.brand && <p className="text-sm font-semibold uppercase tracking-wide text-primary">{product.brand}</p>}
          <h1 className="mt-1 font-display text-3xl font-semibold leading-tight sm:text-4xl">{product.name}</h1>
          <p className="mt-2 text-xs text-subtle-foreground">SKU: {product.sku}</p>

          <div className="mt-6">
            <PurchasePanel product={product} />
          </div>

          <div className="mt-8 grid gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4 sm:grid-cols-2">
            {delivery.map((d) => (
              <div key={d.id} className="flex gap-3">
                {d.id === "pickup" ? <Store className="mt-0.5 size-5 shrink-0 text-primary" /> : <Truck className="mt-0.5 size-5 shrink-0 text-primary" />}
                <div className="text-sm">
                  <p className="font-semibold">{d.label}</p>
                  <p className="text-muted-foreground">
                    {d.etaText}
                    {d.charge > 0 ? ` · ${formatINR(d.charge)}` : " · Free"}
                    {d.charge > 0 && c.freeDeliveryThreshold > 0 && ` (free over ${formatINR(c.freeDeliveryThreshold)})`}
                  </p>
                </div>
              </div>
            ))}
            {c.codEnabled && (
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold">Cash on Delivery</p>
                  <p className="text-muted-foreground">Pay when your order arrives</p>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <RotateCcw className="mt-0.5 size-5 shrink-0 text-primary" />
              <div className="text-sm">
                <p className="font-semibold">Easy returns</p>
                <p className="line-clamp-2 text-muted-foreground">{c.returnPolicy}</p>
              </div>
            </div>
          </div>

          {product.description && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Description</h2>
              <div className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{product.description}</div>
            </section>
          )}

          {(product.specifications.length > 0 || product.weightGrams) && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold">Specifications</h2>
              <dl className="mt-3 divide-y divide-border overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface text-sm">
                {product.specifications.map((s) => (
                  <div key={s.label} className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5">
                    <dt className="text-muted-foreground">{s.label}</dt>
                    <dd className="font-medium">{s.value}</dd>
                  </div>
                ))}
                {product.weightGrams ? (
                  <div className="grid grid-cols-[40%_1fr] gap-3 px-4 py-2.5">
                    <dt className="text-muted-foreground">Weight</dt>
                    <dd className="font-medium">{product.weightGrams} g</dd>
                  </div>
                ) : null}
              </dl>
            </section>
          )}

          <section className="mt-8">
            <h2 className="text-lg font-semibold">Returns &amp; cancellation</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.returnPolicy}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.cancellationPolicy}</p>
          </section>
        </div>
      </div>

      <ProductRail eyebrow="You may also like" title="Related products" href={product.category ? `/categories/${product.category.slug}` : undefined} products={related} />
      <JsonLd data={productJsonLd(product)} />
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
    </div>
  );
}
