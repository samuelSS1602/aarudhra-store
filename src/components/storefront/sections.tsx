import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ProductCardDTO } from "@/types";
import { cn } from "@/lib/utils";
import { ProductCard } from "@/components/products/product-card";
import { Reveal } from "./reveal";

export function SectionHeading({
  eyebrow,
  title,
  href,
  hrefLabel = "View all",
  className,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  hrefLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow && <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h2 className="font-display text-2xl font-semibold text-foreground sm:text-[1.9rem]">{title}</h2>
      </div>
      {href && (
        <Link href={href} className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
          {hrefLabel}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/** Horizontally scrollable on phones, grid on larger screens. */
export function ProductRail({
  eyebrow,
  title,
  href,
  products,
  className,
}: {
  eyebrow?: string;
  title: string;
  href?: string;
  products: ProductCardDTO[];
  className?: string;
}) {
  if (!products.length) return null;
  return (
    <section className={cn("container-page mt-16", className)} aria-label={title}>
      <Reveal>
        <SectionHeading eyebrow={eyebrow} title={title} href={href} />
      </Reveal>
      <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {products.slice(0, 8).map((p) => (
          <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
