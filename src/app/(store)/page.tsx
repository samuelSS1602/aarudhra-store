import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MessageCircle, Navigation } from "lucide-react";
import { getSettings, storeAddressLines } from "@/services/settings.service";
import { listActiveCategoriesCached } from "@/services/categories.service";
import { getProductCollectionsCached } from "@/services/products.service";
import { cn, whatsappLink } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DynamicIcon } from "@/components/storefront/icons";
import { ProductRail, SectionHeading } from "@/components/storefront/sections";
import { Reveal } from "@/components/storefront/reveal";
import { NewsletterForm } from "@/components/storefront/newsletter-form";
import { HeroShowcase } from "@/components/storefront/hero-showcase";
import { StoreGallery } from "@/components/storefront/store-gallery";
import { BrandMarquee } from "@/components/storefront/brand-marquee";
import { STOREFRONT_PHOTO } from "@/components/storefront/store-photos";

// Pre-built and served from cache; rebuilt on any catalogue/settings change (see lib/cache.ts).
export const revalidate = 300;

const BANNER_TONES = {
  green: "bg-primary text-primary-foreground",
  gold: "bg-accent-soft text-accent-foreground",
  charcoal: "bg-foreground text-white",
  lime: "bg-brand-gradient text-white",
} as const;

export default async function HomePage() {
  const settings = await getSettings();
  const h = settings.homepage;
  const [categories, collections] = await Promise.all([listActiveCategoriesCached(), getProductCollectionsCached(h.featuredProductIds)]);
  const featuredCats = h.featuredCategoryIds.length
    ? h.featuredCategoryIds.map((id) => categories.find((c) => c.id === id)).filter((c): c is (typeof categories)[number] => Boolean(c))
    : categories;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(settings.general.mapQuery)}&output=embed`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings.general.mapQuery)}`;

  return (
    <>
      <HeroShowcase
        eyebrow={h.hero.eyebrow}
        title={h.hero.title}
        subtitle={h.hero.subtitle}
        cta={h.hero.ctaLabel ? { label: h.hero.ctaLabel, href: h.hero.ctaHref } : undefined}
        secondary={h.hero.secondaryCtaLabel ? { label: h.hero.secondaryCtaLabel, href: h.hero.secondaryCtaHref } : undefined}
        location={[settings.general.address.line2, settings.general.address.city].filter(Boolean).join(", ")}
        codEnabled={settings.commerce.codEnabled}
        adminImage={h.hero.imageUrl || null}
      />

      {/* Categories */}
      {featuredCats.length > 0 && (
        <section className="container-page mt-8 sm:mt-14" aria-labelledby="cat-heading">
          <Reveal>
            <SectionHeading eyebrow="Browse" title="Shop by category" href="/categories" />
          </Reveal>
          <div className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-3 lg:grid-cols-6">
            {featuredCats.slice(0, 12).map((c) => (
              <Link
                key={c.id}
                href={`/categories/${c.slug}`}
                className="group flex flex-col items-center text-center transition-all sm:rounded-[var(--radius-xl)] sm:border sm:border-border sm:bg-surface sm:p-4 sm:shadow-soft sm:hover:-translate-y-0.5 sm:hover:border-primary/30 sm:hover:shadow-lift"
              >
                <div className="relative flex size-[60px] items-center justify-center overflow-hidden rounded-2xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white sm:size-16">
                  {c.image?.url ? <Image src={c.image.url} alt="" fill sizes="64px" className="object-cover" /> : <DynamicIcon name={c.icon} className="size-7" />}
                </div>
                <p className="mt-2 line-clamp-2 text-[11.5px] font-semibold leading-tight sm:mt-3 sm:text-sm">{c.name}</p>
                {typeof c.productCount === "number" && c.productCount > 0 && (
                  <p className="mt-0.5 hidden text-[11px] text-subtle-foreground sm:block">{c.productCount} products</p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {h.brands.enabled && <BrandMarquee title={h.brands.title} brands={h.brands.items} />}

      <ProductRail eyebrow="Handpicked" title="Featured products" href="/products" products={collections.featured} />

      {/* Promotional banners */}
      {h.banners.length > 0 && (
        <section className="container-page mt-16 grid gap-4 md:grid-cols-2" aria-label="Promotions">
          {h.banners.map((b, i) => (
            <Reveal key={i} delay={i * 0.05}>
              <Link href={b.href || "/products"} className={cn("group relative flex min-h-44 flex-col justify-end overflow-hidden rounded-[1.75rem] p-6 sm:min-h-52 sm:p-8", BANNER_TONES[b.tone])}>
                {b.imageUrl && (
                  <>
                    <Image src={b.imageUrl} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </>
                )}
                <div className={cn("relative", b.imageUrl && "text-white")}>
                  <h3 className="font-display text-2xl font-semibold sm:text-3xl">{b.title}</h3>
                  {b.subtitle && <p className="mt-1.5 max-w-sm text-sm opacity-85">{b.subtitle}</p>}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold">
                    Shop now <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </section>
      )}

      <ProductRail eyebrow="Customer favourites" title="Best sellers" href="/products?sort=popular" products={collections.bestSellers} />
      <ProductRail eyebrow="Just in" title="New arrivals" href="/products?sort=newest" products={collections.newArrivals} />
      <ProductRail eyebrow="Save more" title="Special offers" href="/products?onSale=1&sort=discount" products={collections.offers} />
      <ProductRail eyebrow="Under ₹99" title="Affordable everyday essentials" href="/products?maxPrice=99&sort=popular" products={collections.essentials} />

      {/* Why shop with us */}
      {h.highlights.length > 0 && (
        <section className="container-page mt-20" aria-labelledby="why-heading">
          <div className="rounded-[2rem] bg-surface-muted px-5 py-10 sm:px-10 sm:py-14">
            <Reveal>
              <h2 id="why-heading" className="text-center font-display text-2xl font-semibold sm:text-3xl">
                Why shop with {settings.general.storeName.split(" ")[0]}
              </h2>
            </Reveal>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {h.highlights.map((x, i) => (
                <Reveal key={i} delay={i * 0.05}>
                  <div className="flex flex-col items-center text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-surface text-primary shadow-soft">
                      <DynamicIcon name={x.icon} className="size-6" />
                    </div>
                    <h3 className="mt-4 font-semibold">{x.title}</h3>
                    <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{x.text}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Inside our store */}
      <section className="mt-20" aria-labelledby="inside-heading">
        <Reveal className="container-page">
          <SectionHeading eyebrow="Inside our store" title="Come see it all in person" />
        </Reveal>
        <StoreGallery />
      </section>

      {/* Store location */}
      <section className="container-page mt-20" aria-labelledby="visit-heading">
        <div className="grid overflow-hidden rounded-[2rem] border border-border bg-surface shadow-soft lg:grid-cols-2">
          <div className="p-6 sm:p-10">
            {STOREFRONT_PHOTO && (
              <div className="group relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl shadow-soft">
                <Image
                  src={STOREFRONT_PHOTO.src}
                  alt={STOREFRONT_PHOTO.caption}
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1024px) 40vw, 100vw"
                  className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
              </div>
            )}
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Visit us</p>
            <h2 id="visit-heading" className="mt-2 font-display text-2xl font-semibold sm:text-3xl">Our Palani store</h2>
            <address className="mt-5 space-y-1 text-[15px] not-italic leading-relaxed text-muted-foreground">
              {storeAddressLines(settings).map((l) => (
                <p key={l}>{l}</p>
              ))}
            </address>
            {settings.general.storeHours && <p className="mt-4 text-sm"><span className="font-semibold">Hours:</span> {settings.general.storeHours}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href={directions} target="_blank" rel="noopener noreferrer">
                  <Navigation /> Get directions
                </a>
              </Button>
              {settings.general.whatsappNumber && (
                <Button asChild>
                  <a href={whatsappLink(settings.general.whatsappNumber, "Hello Aarudhra Smart Store!")} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Chat on WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </div>
          <div className="relative min-h-72 bg-surface-muted">
            <iframe
              title={`Map showing ${settings.general.storeName}`}
              src={mapSrc}
              className="absolute inset-0 size-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </section>

      {h.newsletterEnabled && (
        <section className="container-page mt-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-primary px-6 py-10 text-primary-foreground sm:px-10 lg:flex-row lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-semibold">Offers in your inbox</h2>
              <p className="mt-1.5 text-sm opacity-85">Occasional updates on new arrivals and special offers. Unsubscribe anytime.</p>
            </div>
            <NewsletterForm />
          </div>
        </section>
      )}
    </>
  );
}
