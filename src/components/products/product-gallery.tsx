"use client";

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ImageDTO } from "@/types";
import { ProductImage } from "./product-image";

export function ProductGallery({ images, name, discountPercent }: { images: ImageDTO[]; name: string; discountPercent: number }) {
  const [index, setIndex] = React.useState(0);
  const current = images[index] ?? null;

  return (
    <div className="lg:sticky lg:top-36">
      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-surface">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={index} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0">
            <ProductImage image={current} name={name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="size-full" />
          </motion.div>
        </AnimatePresence>
        {discountPercent > 0 && (
          <span className="absolute left-4 top-4 rounded-full bg-accent px-3 py-1 text-sm font-bold text-white shadow-soft">{discountPercent}% OFF</span>
        )}
      </div>
      {images.length > 1 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show image ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-[var(--radius-md)] border-2 transition-colors sm:size-20",
                i === index ? "border-primary" : "border-transparent opacity-70 hover:opacity-100",
              )}
            >
              <Image src={img.url} alt={img.alt || `${name} image ${i + 1}`} fill sizes="80px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
