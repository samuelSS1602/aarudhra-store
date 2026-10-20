import { formatAmount, jpegImageUrl } from "@/lib/utils";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, type OrderStatus } from "@/lib/constants";
import { formatPhoneForDisplay } from "@/lib/phone";

/**
 * Message builders for WhatsApp notifications. Template parameter order MUST match
 * the approved templates documented in README.md → "WhatsApp message templates".
 */

export type OrderForMessage = {
  orderNumber: string;
  customerSnapshot: { name: string; phone: string };
  items: { name: string; variantName?: string | null; quantity: number; unitPrice?: number; lineTotal: number; image?: string | null }[];
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    district: string;
    state: string;
    pincode: string;
  };
  deliveryOption?: { label?: string | null } | null;
  createdAt: Date | string;
};

const IST_TIME = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export function itemSummaryLines(order: OrderForMessage): string[] {
  return order.items.map(
    (i) => `${i.quantity} × ${i.name}${i.variantName ? ` (${i.variantName})` : ""} — ₹${formatAmount(i.lineTotal)}`,
  );
}

export function addressOneLine(order: OrderForMessage): string {
  const a = order.shippingAddress;
  return [a.fullName, a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : "", `${a.city}, ${a.district}`, `${a.state} - ${a.pincode}`, `Ph: ${formatPhoneForDisplay(a.phone)}`]
    .filter(Boolean)
    .join(", ");
}

const paymentMethodLabel = (m: string) => PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m;
const paymentStatusLabel = (s: string) => PAYMENT_STATUS_LABELS[s as keyof typeof PAYMENT_STATUS_LABELS] ?? s;

/** Owner template `{{1}}…{{14}}` parameters. */
export function ownerTemplateParams(order: OrderForMessage, adminUrl: string): string[] {
  return [
    order.orderNumber,
    order.customerSnapshot.name,
    formatPhoneForDisplay(order.customerSnapshot.phone),
    itemSummaryLines(order).join("; "),
    formatAmount(order.subtotal),
    formatAmount(order.discount),
    formatAmount(order.deliveryCharge),
    formatAmount(order.tax),
    formatAmount(order.totalAmount),
    paymentMethodLabel(order.paymentMethod),
    paymentStatusLabel(order.paymentStatus),
    addressOneLine(order),
    IST_TIME.format(new Date(order.createdAt)),
    adminUrl,
  ];
}

const DIVIDER = "━━━━━━━━━━━━━━━━";

/**
 * Full formatted owner message (Cloud API "text" mode and the customer's wa.me hand-off).
 * With `siteUrl`, each item gets a direct link to its product photo (JPEG, so WhatsApp
 * can preview it).
 */
export function ownerTextMessage(order: OrderForMessage, adminUrl: string, siteUrl?: string): string {
  const a = order.shippingAddress;
  const money = (paise: number) => `₹${formatAmount(paise)}`;
  const pieces = order.items.reduce((n, i) => n + i.quantity, 0);
  const items = order.items.flatMap((i, k) => {
    const unit = i.unitPrice ?? Math.round(i.lineTotal / i.quantity);
    const photo = siteUrl && i.image ? new URL(jpegImageUrl(i.image), siteUrl).toString() : "";
    return [
      `*${k + 1}. ${i.name}*${i.variantName ? ` _(${i.variantName})_` : ""}`,
      `   ${i.quantity} × ${money(unit)} = *${money(i.lineTotal)}*`,
      ...(photo ? [`   🖼️ Photo: ${photo}`] : []),
      "",
    ];
  });
  return [
    "🛍️ *NEW ORDER*",
    "*Aarudhra Smart Store*",
    DIVIDER,
    `🧾 *Order:* ${order.orderNumber}`,
    `📅 ${IST_TIME.format(new Date(order.createdAt))}`,
    "",
    "👤 *Customer*",
    order.customerSnapshot.name,
    `📞 ${formatPhoneForDisplay(order.customerSnapshot.phone)}`,
    "",
    `📦 *Items* (${pieces} ${pieces === 1 ? "piece" : "pieces"})`,
    "",
    ...items,
    DIVIDER,
    `Subtotal: ${money(order.subtotal)}`,
    ...(order.discount > 0 ? [`Discount: −${money(order.discount)}`] : []),
    `Delivery: ${order.deliveryCharge > 0 ? money(order.deliveryCharge) : "FREE"}`,
    ...(order.tax > 0 ? [`GST: ${money(order.tax)}`] : []),
    `💰 *TOTAL: ${money(order.totalAmount)}*`,
    DIVIDER,
    "",
    `💳 *Payment:* ${paymentMethodLabel(order.paymentMethod)} (${paymentStatusLabel(order.paymentStatus)})`,
    ...(order.deliveryOption?.label ? [`🚚 *Delivery:* ${order.deliveryOption.label}`] : []),
    "",
    "📍 *Deliver to*",
    ...[a.fullName, a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : "", `${a.city}, ${a.district}`, `${a.state} – ${a.pincode}`].filter(Boolean),
    `📞 ${formatPhoneForDisplay(a.phone)}`,
    "",
    "🔗 *Manage this order:*",
    adminUrl,
  ].join("\n");
}

/** Customer confirmation template `{{1}}…{{8}}` parameters. */
export function customerConfirmationParams(order: OrderForMessage, trackingUrl: string, supportContact: string): string[] {
  const a = order.shippingAddress;
  return [
    order.customerSnapshot.name,
    order.orderNumber,
    itemSummaryLines(order).join("; "),
    formatAmount(order.totalAmount),
    paymentMethodLabel(order.paymentMethod),
    `${a.line1}, ${a.city} - ${a.pincode}`,
    trackingUrl,
    supportContact || "Reply to this message",
  ];
}

/** Customer status update template `{{1}}…{{5}}` parameters. */
export function statusUpdateParams(
  order: Pick<OrderForMessage, "orderNumber" | "customerSnapshot">,
  status: OrderStatus,
  trackingUrl: string,
  supportContact: string,
): string[] {
  return [order.customerSnapshot.name, order.orderNumber, ORDER_STATUS_LABELS[status], trackingUrl, supportContact || "Reply to this message"];
}
