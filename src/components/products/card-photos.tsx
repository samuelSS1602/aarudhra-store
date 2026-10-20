"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types";
import { ProductImage } from "./product-image";

const SIZES = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw";

/**
 * Photos on a product card. With several photos: swipe on touch screens, or move the
 * mouse across the photo to flip through them; dots show which one is visible.
 * `swipe={false}` keeps touch gestures for a parent that scrolls sideways (product rails).
 */
export function CardPhotos({
  images,
  name,
  priority,
  swipe = true,
  raiseDots,
  className,
}: {
  images: ImageDTO[];
  name: string;
  priority?: boolean;
  swipe?: boolean;
  /** Lift the dots above a bottom overlay (e.g. "Out of stock"). */
  raiseDots?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const count = images.length;

  if (count <= 1) {
    return <ProductImage image={images[0]} name={name} priority={priority} className={cn(className, "transition-transform duration-500 group-hover:scale-[1.04]")} />;
  }

  const show = (i: number) => {
    const el = ref.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "instant" });
  };

  return (
    <div className={cn("relative", className)}>
      <div
        ref={ref}
        className={cn("scrollbar-none flex size-full", swipe ? "snap-x snap-mandatory overflow-x-auto overscroll-x-contain" : "overflow-hidden")}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          const r = e.currentTarget.getBoundingClientRect();
          const i = Math.min(count - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * count)));
          if (i !== index) show(i);
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") show(0);
        }}
      >
        {images.map((img, i) => (
          <div key={img.url} className="relative size-full shrink-0 snap-center bg-surface-muted">
            <Image
              src={img.url}
              alt={i === 0 ? img.alt || name : ""}
              fill
              sizes={SIZES}
              priority={priority && i === 0}
              draggable={false}
              className="object-cover"
            />
          </div>
        ))}
      </div>
      <div aria-hidden className={cn("pointer-events-none absolute inset-x-0 flex justify-center gap-1", raiseDots ? "bottom-10" : "bottom-2.5")}>
        {images.map((img, i) => (
          <span
            key={img.url}
            className={cn("h-1.5 rounded-full bg-white shadow-[0_0_3px_rgba(0,0,0,0.45)] transition-all duration-300", i === index ? "w-4" : "w-1.5 opacity-60")}
          />
        ))}
      </div>
    </div>
  );
}
