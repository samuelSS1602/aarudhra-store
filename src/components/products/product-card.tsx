"use client";

import Link from "next/link";
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Heart, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ProductCardDTO } from "@/types";
import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";
import { ProductImage } from "./product-image";
import { Price, StockLabel } from "./price";

export function ProductCard({ product, layout = "grid", priority }: { product: ProductCardDTO; layout?: "grid" | "list"; priority?: boolean }) {
  const { add } = useCart();
  const { wishlist, toggleWishlist } = useSession();
  const [added, setAdded] = React.useState(false);
  const saved = wishlist.has(product.id);
  const outOfStock = product.stock <= 0;
  const href = `/products/${product.slug}`;

  function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    add({ productId: product.id, variantId: null, quantity: 1 });
    setAdded(true);
    toast.success(`${product.name} added to cart`, { action: { label: "View cart", onClick: () => (location.href = "/cart") } });
    setTimeout(() => setAdded(false), 1400);
  }

  const action = outOfStock ? null : product.hasVariants ? (
    <Link
      href={href}
      className="inline-flex h-9 items-center justify-center rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-muted"
    >
      Choose options
    </Link>
  ) : (
    <motion.button
      type="button"
      onClick={handleAdd}
      whileTap={{ scale: 0.94 }}
      aria-label={`Add ${product.name} to cart`}
      className={cn(
        "relative inline-flex h-9 items-center justify-center gap-1.5 overflow-hidden rounded-[var(--radius-md)] px-3 text-[13px] font-semibold transition-colors",
        added ? "bg-success text-white" : "bg-primary text-primary-foreground hover:bg-primary-hover",
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        {added ? (
          <motion.span key="ok" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="flex items-center gap-1.5">
            <Check className="size-4" /> Added
          </motion.span>
        ) : (
          <motion.span key="add" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} className="flex items-center gap-1.5">
            <Plus className="size-4" /> Add
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );

  const wishlistButton = (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        void toggleWishlist(product.id);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      className="absolute right-2.5 top-2.5 z-10 flex size-9 items-center justify-center rounded-full bg-surface/90 text-foreground shadow-soft backdrop-blur transition-transform hover:scale-105"
    >
      <Heart className={cn("size-4 transition-colors", saved && "fill-danger text-danger")} />
    </button>
  );

  if (layout === "list") {
    return (
      <div className="group relative flex gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-3 shadow-soft transition-shadow hover:shadow-lift">
        <Link href={href} className="relative block aspect-square w-28 shrink-0 overflow-hidden rounded-[var(--radius-lg)] sm:w-36">
          <ProductImage image={product.image} name={product.name} sizes="144px" className="size-full" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col py-1">
          {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-subtle-foreground">{product.brand}</p>}
          <Link href={href} className="mt-0.5 line-clamp-2 font-medium text-foreground hover:text-primary">
            {product.name}
          </Link>
          <Price price={product.price} originalPrice={product.originalPrice} className="mt-2" />
          <StockLabel stock={product.stock} lowStockThreshold={product.lowStockThreshold} className="mt-1" />
          <div className="mt-auto flex items-center gap-2 pt-3">{action}</div>
        </div>
        <div className="relative">{wishlistButton}</div>
      </div>
    );
  }

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-soft transition-shadow hover:shadow-lift"
    >
      {wishlistButton}
      <Link href={href} className="relative block aspect-square overflow-hidden" tabIndex={-1} aria-hidden>
        <ProductImage image={product.image} name={product.name} priority={priority} className="size-full transition-transform duration-500 group-hover:scale-[1.04]" />
        {product.discountPercent > 0 && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-white shadow-soft">
            {product.discountPercent}% OFF
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-0 bottom-0 bg-foreground/75 py-1.5 text-center text-xs font-semibold text-white">Out of stock</span>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        {product.brand && <p className="truncate text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">{product.brand}</p>}
        <Link href={href} className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-snug text-foreground hover:text-primary sm:text-[15px]">
          {product.name}
        </Link>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="min-w-0">
            <Price price={product.price} originalPrice={product.originalPrice} size="sm" showBadge={false} />
            {!outOfStock && product.stock <= product.lowStockThreshold && (
              <p className="text-[12px] font-medium text-warning">Only {product.stock} left</p>
            )}
          </div>
          {action}
        </div>
      </div>
    </motion.div>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-2 p-3.5">
        <div className="skeleton h-3 w-1/3" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-2/3" />
        <div className="flex justify-between pt-2">
          <div className="skeleton h-5 w-16" />
          <div className="skeleton h-9 w-16" />
        </div>
      </div>
    </div>
  );
}
