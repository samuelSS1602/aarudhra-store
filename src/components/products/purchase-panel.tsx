"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Heart, ShoppingBag, Zap } from "lucide-react";
import { toast } from "sonner";
import { cn, formatINR } from "@/lib/utils";
import type { ProductDetailDTO, VariantDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";
import { QuantitySelector } from "@/components/cart/quantity-selector";
import { Price, StockLabel } from "./price";

/** Groups variant options ("Colour: Blue", "Size: A4") into selectable axes. */
function optionAxes(variants: VariantDTO[]) {
  const axes = new Map<string, string[]>();
  for (const v of variants) {
    for (const o of v.options) {
      const list = axes.get(o.name) ?? [];
      if (!list.includes(o.value)) list.push(o.value);
      axes.set(o.name, list);
    }
  }
  return [...axes.entries()];
}

export function PurchasePanel({ product }: { product: ProductDetailDTO }) {
  const router = useRouter();
  const { add } = useCart();
  const { wishlist, toggleWishlist } = useSession();
  const hasVariants = product.variants.length > 0;
  const axes = optionAxes(product.variants);
  const useAxes = hasVariants && axes.length > 0 && product.variants.every((v) => v.options.length === axes.length);

  const firstInStock = product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = React.useState<string | null>(firstInStock?.id ?? null);
  const [qty, setQty] = React.useState(1);
  const [justAdded, setJustAdded] = React.useState(false);

  const variant = product.variants.find((v) => v.id === variantId) ?? null;
  const price = variant?.price ?? product.price;
  const originalPrice = variant ? (variant.originalPrice ?? product.originalPrice) : product.originalPrice;
  const stock = hasVariants ? (variant?.stock ?? 0) : product.stock;
  const canBuy = stock > 0 && (!hasVariants || Boolean(variant));
  const saved = wishlist.has(product.id);

  React.useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, Math.max(1, stock))));
  }, [stock]);

  function selectOption(axis: string, value: string) {
    const current = Object.fromEntries((variant?.options ?? []).map((o) => [o.name, o.value]));
    current[axis] = value;
    const match =
      product.variants.find((v) => v.options.every((o) => current[o.name] === o.value)) ??
      product.variants.find((v) => v.options.some((o) => o.name === axis && o.value === value));
    if (match) setVariantId(match.id);
  }

  function addToCart(buyNow = false) {
    if (!canBuy) return;
    add({ productId: product.id, variantId: hasVariants ? variantId : null, quantity: qty });
    if (buyNow) {
      router.push("/checkout");
      return;
    }
    setJustAdded(true);
    toast.success("Added to cart", { description: `${qty} × ${product.name}${variant ? ` (${variant.name})` : ""}`, action: { label: "View cart", onClick: () => router.push("/cart") } });
    setTimeout(() => setJustAdded(false), 1600);
  }

  // Phones: keep a buy bar on screen once the main buttons scroll away.
  const buttonsRef = React.useRef<HTMLDivElement>(null);
  const [buttonsVisible, setButtonsVisible] = React.useState(true);
  const [footerVisible, setFooterVisible] = React.useState(false);
  React.useEffect(() => {
    const el = buttonsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setButtonsVisible(Boolean(entry?.isIntersecting)), { rootMargin: "0px 0px -60px 0px" });
    io.observe(el);
    const footer = document.getElementById("site-footer");
    const fo = new IntersectionObserver(([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)));
    if (footer) fo.observe(footer);
    return () => {
      io.disconnect();
      fo.disconnect();
    };
  }, []);

  return (
    <div>
      <Price price={price} originalPrice={originalPrice} size="lg" />
      <p className="mt-1 text-xs text-subtle-foreground">
        {product.tax.inclusive ? "Inclusive of all taxes" : `+ ${product.tax.gstRate}% GST at checkout`}
      </p>
      <div className="mt-3">
        <StockLabel stock={stock} lowStockThreshold={product.lowStockThreshold} />
      </div>

      {hasVariants && (
        <div className="mt-6 space-y-5">
          {useAxes ? (
            axes.map(([axis, values]) => {
              const selected = variant?.options.find((o) => o.name === axis)?.value;
              return (
                <fieldset key={axis}>
                  <legend className="mb-2 text-sm font-semibold">
                    {axis}: <span className="font-normal text-muted-foreground">{selected}</span>
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {values.map((val) => {
                      const anyStock = product.variants.some((v) => v.stock > 0 && v.options.some((o) => o.name === axis && o.value === val));
                      return (
                        <button
                          key={val}
                          type="button"
                          aria-pressed={selected === val}
                          onClick={() => selectOption(axis, val)}
                          className={cn(
                            "min-w-12 rounded-[var(--radius-md)] border px-3.5 py-2 text-sm font-medium transition-all",
                            selected === val ? "border-primary bg-primary-soft text-primary-soft-foreground ring-1 ring-primary" : "border-border-strong bg-surface hover:border-foreground/40",
                            !anyStock && "text-subtle-foreground line-through decoration-1",
                          )}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })
          ) : (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">Option</legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    aria-pressed={variantId === v.id}
                    onClick={() => setVariantId(v.id)}
                    className={cn(
                      "rounded-[var(--radius-md)] border px-3.5 py-2 text-sm font-medium transition-all",
                      variantId === v.id ? "border-primary bg-primary-soft text-primary-soft-foreground ring-1 ring-primary" : "border-border-strong bg-surface hover:border-foreground/40",
                      v.stock <= 0 && "text-subtle-foreground line-through decoration-1",
                    )}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <QuantitySelector value={qty} onChange={setQty} max={Math.max(1, Math.min(99, stock))} disabled={!canBuy} />
        <button
          type="button"
          onClick={() => void toggleWishlist(product.id)}
          aria-pressed={saved}
          className="flex size-11 items-center justify-center rounded-[var(--radius-md)] border border-border-strong bg-surface transition-colors hover:bg-surface-muted"
          aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
        >
          <Heart className={cn("size-5", saved && "fill-danger text-danger")} />
        </button>
      </div>

      <div ref={buttonsRef} className="mt-4 grid gap-2.5 sm:grid-cols-2">
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button size="lg" variant="outline" className="w-full" onClick={() => addToCart(false)} disabled={!canBuy}>
            {justAdded ? <Check /> : <ShoppingBag />}
            {justAdded ? "Added to cart" : "Add to cart"}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.98 }}>
          <Button size="lg" className="w-full" onClick={() => addToCart(true)} disabled={!canBuy}>
            <Zap /> Buy now
          </Button>
        </motion.div>
      </div>
      {!canBuy && <p className="mt-3 text-sm text-danger">{hasVariants && !variant ? "Please choose an option." : "This item is currently out of stock."}</p>}

      <AnimatePresence>
        {!buttonsVisible && !footerVisible && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 38 }}
            className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-2.5 shadow-[0_-8px_24px_-12px_rgb(22_27_51/0.25)] backdrop-blur-md md:hidden"
          >
            <div className="flex items-center gap-2">
              <div className="mr-auto min-w-0">
                <p className="truncate text-xs text-muted-foreground">{variant ? variant.name : product.name}</p>
                <p className="font-semibold tabular-nums">{formatINR(price)}</p>
              </div>
              <Button variant="outline" className="h-11 px-3" onClick={() => addToCart(false)} disabled={!canBuy} aria-label="Add to cart">
                {justAdded ? <Check /> : <ShoppingBag />}
              </Button>
              <Button className="h-11 px-5" onClick={() => addToCart(true)} disabled={!canBuy}>
                <Zap /> Buy now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
