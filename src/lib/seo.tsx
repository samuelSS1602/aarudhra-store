import type { StoreSettings } from "@/lib/settings-defaults";
import type { ProductDetailDTO } from "@/types";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
export const absoluteUrl = (path: string) => new URL(path, appUrl()).toString();

/** Renders JSON-LD safely (escapes `<` so content can't break out of the script tag). */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Local business data for the Palani store. Only configured, accurate fields are emitted. */
export function localBusinessJsonLd(settings: StoreSettings) {
  const g = settings.general;
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: g.storeName,
    description: g.description,
    url: appUrl(),
    currenciesAccepted: "INR",
    paymentAccepted: settings.commerce.codEnabled ? "Cash" : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: [g.address.line1, g.address.line2].filter(Boolean).join(", "),
      addressLocality: g.address.city,
      addressRegion: g.address.state,
      postalCode: g.address.pincode,
      addressCountry: "IN",
    },
    ...(g.supportPhone ? { telephone: g.supportPhone } : {}),
    ...(g.contactEmail ? { email: g.contactEmail } : {}),
    ...(g.logoUrl ? { logo: g.logoUrl, image: g.logoUrl } : {}),
    ...(Object.values(g.social).some(Boolean) ? { sameAs: Object.values(g.social).filter(Boolean) } : {}),
  };
}

/** Product structured data — real price and availability only; no ratings or reviews. */
export function productJsonLd(p: ProductDetailDTO) {
  const prices = p.variants.length ? p.variants.map((v) => v.price ?? p.price) : [p.price];
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description: p.seo.description || p.description.slice(0, 300) || undefined,
    image: p.images.map((i) => i.url),
    ...(p.brand ? { brand: { "@type": "Brand", name: p.brand } } : {}),
    ...(p.category ? { category: p.category.name } : {}),
    offers:
      low === high
        ? {
            "@type": "Offer",
            url: absoluteUrl(`/products/${p.slug}`),
            priceCurrency: "INR",
            price: (low / 100).toFixed(2),
            availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemCondition: "https://schema.org/NewCondition",
          }
        : {
            "@type": "AggregateOffer",
            priceCurrency: "INR",
            lowPrice: (low / 100).toFixed(2),
            highPrice: (high / 100).toFixed(2),
            offerCount: prices.length,
            availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          },
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: absoluteUrl(it.href) })),
  };
}
