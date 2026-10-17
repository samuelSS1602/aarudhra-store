import { Truck } from "lucide-react";
import { formatINR } from "@/lib/utils";
import type { QuoteDTO } from "@/types";

export function SummaryRow({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: "success" }) {
  return (
    <div className={strong ? "flex items-baseline justify-between pt-3 text-base font-semibold" : "flex items-baseline justify-between text-sm"}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${tone === "success" ? "font-medium text-success" : ""} ${strong ? "font-display text-xl" : ""}`}>{value}</dd>
    </div>
  );
}

export function OrderSummary({ quote, showDelivery = true }: { quote: QuoteDTO; showDelivery?: boolean }) {
  return (
    <div>
      {quote.freeDeliveryThreshold > 0 && quote.amountToFreeDelivery > 0 && quote.subtotal > 0 && (
        <div className="mb-4 rounded-[var(--radius-lg)] bg-primary-soft p-3 text-sm text-primary-soft-foreground">
          <p className="flex items-center gap-2 font-medium">
            <Truck className="size-4" /> Add {formatINR(quote.amountToFreeDelivery)} more for free delivery
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${Math.min(100, ((quote.subtotal - quote.discount) / quote.freeDeliveryThreshold) * 100)}%` }}
            />
          </div>
        </div>
      )}
      <dl className="space-y-2.5">
        <SummaryRow label={`Subtotal (${quote.itemCount} item${quote.itemCount === 1 ? "" : "s"})`} value={formatINR(quote.subtotal)} />
        {quote.discount > 0 && (
          <SummaryRow label={`Discount${quote.coupon ? ` (${quote.coupon.code})` : ""}`} value={`− ${formatINR(quote.discount)}`} tone="success" />
        )}
        {quote.tax > 0 && <SummaryRow label="GST" value={formatINR(quote.tax)} />}
        {showDelivery && (
          <SummaryRow
            label="Delivery"
            value={quote.deliveryCharge === 0 ? <span className="font-medium text-success">Free</span> : formatINR(quote.deliveryCharge)}
          />
        )}
        <div className="border-t border-dashed border-border-strong" />
        <SummaryRow label="Total" value={formatINR(quote.total)} strong />
        {quote.taxIncluded > 0 && <p className="text-right text-xs text-subtle-foreground">Includes {formatINR(quote.taxIncluded)} GST</p>}
      </dl>
    </div>
  );
}
