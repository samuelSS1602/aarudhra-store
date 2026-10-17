import { Check, Circle, X } from "lucide-react";
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus, type PaymentStatus } from "@/lib/constants";
import { cn, formatDateTime, formatINR } from "@/lib/utils";
import type { OrderDTO } from "@/types";
import { Badge } from "@/components/ui/display";
import { SummaryRow } from "@/components/cart/order-summary";

const STATUS_TONE: Record<OrderStatus, "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "accent"> = {
  pending: "warning",
  confirmed: "info",
  processing: "info",
  packed: "accent",
  shipped: "primary",
  out_for_delivery: "primary",
  delivered: "success",
  cancelled: "danger",
  returned: "neutral",
  refunded: "neutral",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const tone = status === "paid" ? "success" : status === "failed" ? "danger" : status === "pending" ? "warning" : "neutral";
  return <Badge tone={tone}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

const PROGRESS: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];

/** Customer-facing progress tracker built from the real status history. */
export function OrderProgress({ order }: { order: OrderDTO }) {
  if (["cancelled", "returned", "refunded"].includes(order.orderStatus)) {
    const last = order.statusHistory.at(-1);
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-danger-soft p-4 text-sm text-danger">
        <X className="size-5" />
        <div>
          <p className="font-semibold">Order {ORDER_STATUS_LABELS[order.orderStatus].toLowerCase()}</p>
          {last && <p className="text-foreground/70">{formatDateTime(last.at)}</p>}
        </div>
      </div>
    );
  }
  const reached = new Map(order.statusHistory.map((h) => [h.status, h.at]));
  const currentIdx = Math.max(PROGRESS.indexOf(order.orderStatus === "processing" ? "confirmed" : order.orderStatus), 0);
  return (
    <ol className="relative grid grid-cols-6 gap-1" aria-label="Order progress">
      {PROGRESS.map((s, i) => {
        const done = i <= currentIdx;
        return (
          <li key={s} className="flex flex-col items-center text-center">
            <div className="relative flex w-full items-center justify-center">
              {i > 0 && <span className={cn("absolute right-1/2 top-1/2 h-0.5 w-full -translate-y-1/2", i <= currentIdx ? "bg-primary" : "bg-border-strong")} aria-hidden />}
              <span className={cn("relative z-10 flex size-7 items-center justify-center rounded-full border-2", done ? "border-primary bg-primary text-white" : "border-border-strong bg-surface text-subtle-foreground")}>
                {done ? <Check className="size-4" strokeWidth={3} /> : <Circle className="size-2 fill-current" />}
              </span>
            </div>
            <span className={cn("mt-2 text-[11px] font-medium leading-tight sm:text-xs", done ? "text-foreground" : "text-subtle-foreground")}>{ORDER_STATUS_LABELS[s]}</span>
            {reached.get(s) && <span className="mt-0.5 hidden text-[10px] text-subtle-foreground sm:block">{new Date(reached.get(s)!).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function OrderTotals({ order }: { order: OrderDTO }) {
  return (
    <dl className="space-y-2.5">
      <SummaryRow label="Subtotal" value={formatINR(order.subtotal)} />
      {order.discount > 0 && <SummaryRow label={`Discount${order.coupon ? ` (${order.coupon.code})` : ""}`} value={`− ${formatINR(order.discount)}`} tone="success" />}
      {order.tax > 0 && <SummaryRow label="GST" value={formatINR(order.tax)} />}
      <SummaryRow label="Delivery" value={order.deliveryCharge === 0 ? "Free" : formatINR(order.deliveryCharge)} />
      <div className="border-t border-dashed border-border-strong" />
      <SummaryRow label="Total" value={formatINR(order.totalAmount)} strong />
      {order.taxIncluded > 0 && <p className="text-right text-xs text-subtle-foreground">Includes {formatINR(order.taxIncluded)} GST</p>}
    </dl>
  );
}

export function AddressBlock({ a }: { a: OrderDTO["shippingAddress"] }) {
  return (
    <address className="text-sm not-italic leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">{a.fullName}</span>
      <br />
      {a.line1}
      {a.line2 && <>, {a.line2}</>}
      {a.landmark && <><br />Landmark: {a.landmark}</>}
      <br />
      {a.city}, {a.district}
      <br />
      {a.state} – {a.pincode}
      <br />
      Phone: {a.phone}
      {a.instructions && <><br /><span className="text-xs">Note: {a.instructions}</span></>}
    </address>
  );
}
