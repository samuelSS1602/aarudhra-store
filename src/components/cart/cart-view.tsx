"use client";

import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Lock, ShoppingBag } from "lucide-react";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, Card, EmptyState, Skeleton } from "@/components/ui/display";
import { useCart } from "@/components/providers/cart-provider";
import { useSession } from "@/components/providers/session-provider";
import { CartLine } from "./cart-line";
import { CouponInput } from "./coupon-input";
import { OrderSummary } from "./order-summary";
import { useQuote } from "./use-quote";

export function CartView() {
  const { items, couponCode, setCouponCode, ready } = useCart();
  const { user } = useSession();
  const { quote, loading, error } = useQuote(items, couponCode, null);

  if (!ready || (items.length > 0 && !quote && loading)) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Looks like you haven't added anything yet. Explore our stationery and home essentials."
          action={<Button asChild><Link href="/products">Continue shopping</Link></Button>}
        />
      </Card>
    );
  }

  const issues = (quote?.issues ?? []).filter((i) => i !== "MIN_ORDER");
  const belowMin = quote?.issues.includes("MIN_ORDER");
  const canCheckout = Boolean(quote && quote.itemCount > 0 && !belowMin);

  return (
    <div className="grid gap-8 pb-20 md:pb-0 lg:grid-cols-[1fr_380px]">
      {quote && quote.itemCount > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(3.6rem+env(safe-area-inset-bottom))] z-20 border-t border-border bg-surface/95 px-4 py-2.5 shadow-[0_-8px_24px_-12px_rgb(22_27_51/0.25)] backdrop-blur-md md:hidden">
          <div className="flex items-center gap-3">
            <div className="mr-auto">
              <p className="text-xs text-muted-foreground">{quote.itemCount} item{quote.itemCount === 1 ? "" : "s"} · before delivery</p>
              <p className="font-display text-lg font-semibold tabular-nums">{formatINR(quote.subtotal - quote.discount)}</p>
            </div>
            <Button asChild size="lg" disabled={!canCheckout}>
              <Link href={user ? "/checkout" : "/login?next=/checkout"} aria-disabled={!canCheckout} onClick={(e) => !canCheckout && e.preventDefault()}>
                <Lock /> Checkout
              </Link>
            </Button>
          </div>
        </div>
      )}
      <div>
        {error && <Alert tone="danger" icon={AlertCircle} title="Couldn't refresh prices" className="mb-4">{error}</Alert>}
        {issues.map((msg) => (
          <Alert key={msg} tone="warning" icon={AlertCircle} className="mb-3">{msg}</Alert>
        ))}
        <Card className="px-4 sm:px-6">
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>{quote?.lines.map((l) => <CartLine key={l.key} line={l} />)}</AnimatePresence>
          </ul>
        </Card>
        <Button variant="link" asChild className="mt-4">
          <Link href="/products"><ArrowLeft /> Continue shopping</Link>
        </Button>
      </div>

      <aside className="lg:sticky lg:top-36 lg:self-start">
        <Card className="p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
          <CouponInput code={couponCode} quote={quote} onApply={setCouponCode} loading={loading} />
          <div className="mt-5">{quote && <OrderSummary quote={quote} />}</div>
          {belowMin && quote && (
            <Alert tone="warning" className="mt-4">Minimum order value is {formatINR(quote.minimumOrderValue)}.</Alert>
          )}
          <Button asChild size="lg" className="mt-5 w-full" disabled={!canCheckout}>
            <Link href={user ? "/checkout" : "/login?next=/checkout"} aria-disabled={!canCheckout} onClick={(e) => !canCheckout && e.preventDefault()}>
              <Lock /> {user ? "Proceed to checkout" : "Sign in to checkout"}
            </Link>
          </Button>
          <p className="mt-3 text-center text-xs text-subtle-foreground">Delivery charges are confirmed at checkout. Prices are verified by the store.</p>
        </Card>
      </aside>
    </div>
  );
}
