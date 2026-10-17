"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, Trash2 } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";
import type { CartLineDTO } from "@/types";
import { ProductImage } from "@/components/products/product-image";
import { useCart } from "@/components/providers/cart-provider";
import { QuantitySelector } from "./quantity-selector";

export function CartLine({ line, compact = false }: { line: CartLineDTO; compact?: boolean }) {
  const { setQuantity, remove } = useCart();
  const unavailable = line.issue === "unavailable" || line.issue === "out_of_stock";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, transition: { duration: 0.15 } }}
      className={cn("flex gap-3 py-4", compact ? "" : "sm:gap-4")}
    >
      <Link href={line.slug ? `/products/${line.slug}` : "#"} className={cn("relative shrink-0 overflow-hidden rounded-[var(--radius-lg)] border border-border", compact ? "size-16" : "size-20 sm:size-24")}>
        <ProductImage image={line.image} name={line.name} sizes="96px" className={cn("size-full", unavailable && "opacity-50 grayscale")} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={line.slug ? `/products/${line.slug}` : "#"} className="line-clamp-2 text-sm font-medium leading-snug hover:text-primary">
              {line.name}
            </Link>
            {line.variantName && <p className="mt-0.5 text-xs text-muted-foreground">{line.variantName}</p>}
            <p className="mt-0.5 text-xs text-subtle-foreground">{formatINR(line.unitPrice)} each</p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatINR(line.lineTotal)}</p>
        </div>
        {line.issue && (
          <p className={cn("mt-1.5 flex items-center gap-1 text-xs font-medium", unavailable ? "text-danger" : "text-warning")}>
            <AlertTriangle className="size-3.5" />
            {line.issue === "unavailable" && "No longer available"}
            {line.issue === "out_of_stock" && "Out of stock"}
            {line.issue === "insufficient_stock" && `Only ${line.available} available — quantity adjusted`}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          {unavailable ? (
            <span />
          ) : (
            <QuantitySelector
              size="sm"
              value={Math.min(line.requestedQuantity, Math.max(1, line.available))}
              max={Math.min(99, line.available)}
              onChange={(v) => setQuantity(line.productId, line.variantId, v)}
              label={`Quantity for ${line.name}`}
            />
          )}
          <button
            type="button"
            onClick={() => remove(line.productId, line.variantId)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-danger-soft hover:text-danger"
            aria-label={`Remove ${line.name}`}
          >
            <Trash2 className="size-3.5" /> Remove
          </button>
        </div>
      </div>
    </motion.li>
  );
}
