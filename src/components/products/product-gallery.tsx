"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types";
import { ProductImage } from "./product-image";

const MAIN_SIZES = "(min-width: 1024px) 50vw, 100vw";

/**
 * Product photos: swipe on phones, arrows / keyboard / thumbnails everywhere.
 * Built on native scroll-snap, so swiping is smooth and needs no gesture library.
 */
export function ProductGallery({ images, name, discountPercent }: { images: ImageDTO[]; name: string; discountPercent: number }) {
  const slidesRef = React.useRef<HTMLDivElement>(null);
  const thumbsRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const count = images.length;

  const go = React.useCallback(
    (i: number) => {
      const el = slidesRef.current;
      if (el) el.scrollTo({ left: (((i % count) + count) % count) * el.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  // Keep the active thumbnail in view (sideways only, never scrolls the page).
  React.useEffect(() => {
    const strip = thumbsRef.current;
    const thumb = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    const left = thumb.offsetLeft - strip.clientWidth / 2 + thumb.clientWidth / 2;
    strip.scrollTo({ left, behavior: "smooth" });
  }, [index]);

  const badge = discountPercent > 0 && (
    <span className="pointer-events-none absolute left-4 top-4 rounded-full bg-accent px-3 py-1 text-sm font-bold text-white shadow-soft">{discountPercent}% OFF</span>
  );

  if (count <= 1) {
    return (
      <div className="lg:sticky lg:top-36">
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-surface">
          <ProductImage image={images[0]} name={name} priority sizes={MAIN_SIZES} className="size-full" />
          {badge}
        </div>
      </div>
    );
  }

  const arrow = "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-lift backdrop-blur transition-opacity hover:bg-surface sm:flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100";

  return (
    <div className="lg:sticky lg:top-36">
      <div className="group relative aspect-square overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-surface">
        <div
          ref={slidesRef}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label={`${name} photos`}
          className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none"
          onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
              e.preventDefault();
              go(index + (e.key === "ArrowRight" ? 1 : -1));
            }
          }}
        >
          {images.map((img, i) => (
            <div key={img.url} role="group" aria-roledescription="slide" aria-label={`Photo ${i + 1} of ${count}`} className="relative size-full shrink-0 snap-center">
              <Image src={img.url} alt={img.alt || `${name}, photo ${i + 1}`} fill priority={i === 0} sizes={MAIN_SIZES} draggable={false} className="object-cover" />
            </div>
          ))}
        </div>

        {badge}
        <span className="pointer-events-none absolute right-4 top-4 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur" aria-live="polite">
          {index + 1} / {count}
        </span>
        <button type="button" onClick={() => go(index - 1)} aria-label="Previous photo" className={cn(arrow, "left-3")}>
          <ChevronLeft className="size-5" />
        </button>
        <button type="button" onClick={() => go(index + 1)} aria-label="Next photo" className={cn(arrow, "right-3")}>
          <ChevronRight className="size-5" />
        </button>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden">
          {images.map((img, i) => (
            <span key={img.url} className={cn("h-1.5 rounded-full bg-white shadow-[0_0_3px_rgba(0,0,0,0.45)] transition-all duration-300", i === index ? "w-5" : "w-1.5 opacity-60")} />
          ))}
        </div>
      </div>

      <div ref={thumbsRef} className="scrollbar-none mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Product photos">
        {images.map((img, i) => (
          <button
            key={img.url}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Show photo ${i + 1}`}
            onClick={() => go(i)}
            className={cn(
              "relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 transition-all sm:size-20",
              i === index ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
            )}
          >
            <Image src={img.url} alt="" fill sizes="80px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
