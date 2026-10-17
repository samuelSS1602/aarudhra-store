import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { toAdminOrderDTO } from "@/lib/serialize";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime, formatINR } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getOrderById } from "@/services/orders.service";
import { getSettings, storeAddressLines } from "@/services/settings.service";
import { LogoFull } from "@/components/layout/logo";
import { PrintButton } from "@/components/admin/print-button";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("orders:view");
  const { id } = await params;
  const doc = await getOrderById(id);
  if (!doc) notFound();
  const o = toAdminOrderDTO(doc);
  const s = await getSettings();
  const a = o.shippingAddress;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex justify-end"><PrintButton /></div>
      <article className="rounded-[var(--radius-xl)] border border-border bg-white p-8 text-sm text-foreground shadow-soft print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b border-border pb-6">
          <div className="flex gap-3">
            <LogoFull className="w-36" />
            <div>
              <p className="font-display text-xl font-semibold">{s.general.storeName}</p>
              {storeAddressLines(s).map((l) => <p key={l} className="text-xs text-muted-foreground">{l}</p>)}
              {s.general.supportPhone && <p className="text-xs text-muted-foreground">Phone: {formatPhoneForDisplay(s.general.supportPhone)}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">Invoice</p>
            <p className="font-mono">{o.orderNumber}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-6 border-b border-border py-6">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Bill / ship to</p>
            <p className="font-medium">{a.fullName}</p>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
            {a.landmark && <p>Landmark: {a.landmark}</p>}
            <p>{a.city}, {a.district}, {a.state} – {a.pincode}</p>
            <p>Phone: {formatPhoneForDisplay(a.phone)}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Payment</p>
            <p>{PAYMENT_METHOD_LABELS[o.paymentMethod]}</p>
            <p>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</p>
            {o.deliveryOption && <p className="mt-2">{o.deliveryOption.label}</p>}
          </div>
        </section>
        <table className="mt-6 w-full">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr><th className="pb-2">Item</th><th className="pb-2">SKU</th><th className="pb-2 text-right">GST</th><th className="pb-2 text-right">Rate</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Amount</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {o.items.map((i) => (
              <tr key={`${i.productId}:${i.variantId}`}>
                <td className="py-2">{i.name}{i.variantName ? ` (${i.variantName})` : ""}</td>
                <td className="py-2 font-mono text-xs">{i.sku}</td>
                <td className="py-2 text-right">{i.gstRate}%{i.taxInclusive ? " incl." : ""}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(i.unitPrice)}</td>
                <td className="py-2 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2 text-right tabular-nums">{formatINR(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="ml-auto mt-6 w-64 space-y-1.5">
          <div className="flex justify-between"><dt>Subtotal</dt><dd className="tabular-nums">{formatINR(o.subtotal)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>Discount{o.coupon ? ` (${o.coupon.code})` : ""}</dt><dd className="tabular-nums">− {formatINR(o.discount)}</dd></div>}
          {o.tax > 0 && <div className="flex justify-between"><dt>GST</dt><dd className="tabular-nums">{formatINR(o.tax)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd className="tabular-nums">{formatINR(o.deliveryCharge)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatINR(o.totalAmount)}</dd></div>
          {o.taxIncluded > 0 && <p className="text-right text-xs text-muted-foreground">Includes {formatINR(o.taxIncluded)} GST</p>}
        </dl>
        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted-foreground">Thank you for shopping with {s.general.storeName}.</footer>
      </article>
    </div>
  );
}
