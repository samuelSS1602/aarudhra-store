"use client";

import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/display";
import { useCart } from "@/components/providers/cart-provider";
import { formatINR } from "@/lib/utils";
import { CartLine } from "./cart-line";
import { useQuote } from "./use-quote";

export function CartDrawer() {
  const { items, couponCode, drawerOpen, setDrawerOpen, count } = useCart();
  const { quote, loading } = useQuote(items, couponCode, null, drawerOpen);

  return (
    <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
      <SheetContent side="right" title={`Your cart${count ? ` (${count})` : ""}`}>
        {items.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Your cart is empty"
            description="Browse our stationery and home essentials to get started."
            action={
              <Button asChild onClick={() => setDrawerOpen(false)}>
                <Link href="/products">Start shopping</Link>
              </Button>
            }
            className="flex-1"
          />
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5">
              {!quote && loading ? (
                <div className="space-y-4 py-4">
                  {items.map((i) => (
                    <div key={`${i.productId}:${i.variantId}`} className="flex gap-3">
                      <Skeleton className="size-16" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  <AnimatePresence initial={false}>{quote?.lines.map((l) => <CartLine key={l.key} line={l} compact />)}</AnimatePresence>
                </ul>
              )}
            </div>
            <div className="pb-safe border-t border-border bg-surface-muted/60 px-5 py-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-display text-xl font-semibold tabular-nums">{quote ? formatINR(quote.subtotal - quote.discount) : "—"}</span>
              </div>
              <p className="mt-0.5 text-xs text-subtle-foreground">Delivery and coupons are calculated at checkout.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="outline" asChild onClick={() => setDrawerOpen(false)}>
                  <Link href="/cart">View cart</Link>
                </Button>
                <Button asChild onClick={() => setDrawerOpen(false)} disabled={!quote || quote.itemCount === 0}>
                  <Link href="/checkout">Checkout</Link>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Dialog>
  );
}
