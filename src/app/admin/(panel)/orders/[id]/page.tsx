import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Printer, User } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { toAdminOrderDTO } from "@/lib/serialize";
import { NOTIFICATION_TYPE_LABELS, ORDER_STATUS_LABELS, ORDER_TRANSITIONS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDateTime, formatINR, whatsappLink } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import { getOrderById } from "@/services/orders.service";
import { listOrderNotifications } from "@/services/notifications.service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display";
import { PageHeader } from "@/components/admin/ui";
import { AutoRefresh } from "@/components/admin/filters";
import { AddressBlock, OrderStatusBadge, OrderTotals, PaymentStatusBadge } from "@/components/orders/order-bits";
import { ProductImage } from "@/components/products/product-image";
import { NotificationBadge } from "@/components/admin/notification-badge";
import { OrderActions, OrderNotes, RetryNotificationButton } from "@/components/admin/order-actions";

export const metadata = { title: "Order details" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("orders:view");
  const { id } = await params;
  const doc = await getOrderById(id);
  if (!doc) notFound();
  const order = toAdminOrderDTO(doc);
  const notifications = await listOrderNotifications(id);
  const pii = can(admin.role, "customers:pii");

  return (
    <div>
      <AutoRefresh intervalMs={20_000} />
      <PageHeader
        title={`Order ${order.orderNumber}`}
        description={<span className="flex flex-wrap items-center gap-2">Placed {formatDateTime(order.createdAt)} <OrderStatusBadge status={order.orderStatus} /> <PaymentStatusBadge status={order.paymentStatus} /></span>}
        actions={
          <>
            {pii && (
              <Button asChild variant="outline">
                <a href={whatsappLink(order.customer.phone, `Hello ${order.customer.name}, this is Aarudhra Smart Store about your order ${order.orderNumber}.`)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> WhatsApp customer
                </a>
              </Button>
            )}
            <Button asChild variant="outline"><Link href={`/admin/orders/${order.id}/invoice`} target="_blank"><Printer /> Invoice</Link></Button>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Items</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr><th className="pb-2">Product</th><th className="pb-2">SKU</th><th className="pb-2 text-right">Price</th><th className="pb-2 text-right">Qty</th><th className="pb-2 text-right">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {order.items.map((i) => (
                      <tr key={`${i.productId}:${i.variantId}`}>
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative size-11 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border">
                              <ProductImage image={i.image ? { url: i.image } : null} name={i.name} sizes="44px" className="size-full" />
                            </div>
                            <div>
                              <Link href={`/admin/products/${i.productId}`} className="font-medium hover:text-primary">{i.name}</Link>
                              {i.variantName && <p className="text-xs text-muted-foreground">{i.variantName}</p>}
                              {i.gstRate > 0 && <p className="text-xs text-subtle-foreground">GST {i.gstRate}% {i.taxInclusive ? "incl." : "extra"}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs">{i.sku}</td>
                        <td className="py-3 text-right tabular-nums">
                          {formatINR(i.unitPrice)}
                          {i.originalPrice && <span className="block text-xs text-subtle-foreground line-through">{formatINR(i.originalPrice)}</span>}
                        </td>
                        <td className="py-3 text-right tabular-nums">{i.quantity}</td>
                        <td className="py-3 text-right font-semibold tabular-nums">{formatINR(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto mt-4 max-w-sm border-t border-border pt-4">
                <OrderTotals order={order} />
                {order.coupon && <p className="mt-2 text-right text-xs text-muted-foreground">Coupon {order.coupon.code}</p>}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Customer</CardTitle>
                {can(admin.role, "customers:view") && <Link href={`/admin/customers/${order.userId}`} className="flex items-center gap-1 text-sm font-semibold text-primary"><User className="size-4" /> Profile</Link>}
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{order.customer.name}</p>
                <p className="text-muted-foreground">{pii ? formatPhoneForDisplay(order.customer.phone) : "Phone hidden for your role"}</p>
                {order.customer.email && <p className="text-muted-foreground">{order.customer.email}</p>}
                <p className="pt-2 text-xs text-subtle-foreground">WhatsApp updates: {order.whatsappOptIn ? "opted in" : "not opted in"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Shipping</CardTitle></CardHeader>
              <CardContent>
                {pii ? <AddressBlock a={order.shippingAddress} /> : <p className="text-sm text-muted-foreground">{order.shippingAddress.city}, {order.shippingAddress.pincode}</p>}
                {order.deliveryOption && <p className="mt-3 text-xs font-medium text-primary">{order.deliveryOption.label} · {order.deliveryOption.etaText}</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-subtle-foreground">Method</p><p className="font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p></div>
              <div><p className="text-xs text-subtle-foreground">Status</p><PaymentStatusBadge status={order.paymentStatus} /></div>
              <div><p className="text-xs text-subtle-foreground">Amount</p><p className="font-semibold">{formatINR(order.totalAmount)}</p></div>
              {order.cancellation && <div className="sm:col-span-3"><p className="text-xs text-subtle-foreground">Cancellation</p><p>{order.cancellation.reason || "No reason given"} · {formatDateTime(order.cancellation.at)}</p></div>}
              {order.refund && <div className="sm:col-span-3"><p className="text-xs text-subtle-foreground">Refund</p><p>{formatINR(order.refund.amount)} · {order.refund.reference || "no reference"} · {formatDateTime(order.refund.at)}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>WhatsApp notifications</CardTitle></CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notifications recorded for this order{order.ownerNotificationStatus === "disabled" ? " — no owner WhatsApp recipient is configured, or owner alerts are disabled in settings." : "."}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => (
                    <li key={String(n._id)} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{NOTIFICATION_TYPE_LABELS[n.type]}</p>
                        <p className="text-xs text-muted-foreground">To {pii ? formatPhoneForDisplay(n.recipient) : "•••"} · {n.attempts} attempt{n.attempts === 1 ? "" : "s"}{n.sentAt ? ` · sent ${formatDateTime(n.sentAt)}` : ""}</p>
                        {n.errorMessage && n.status !== "sent" && <p className="mt-0.5 text-xs text-danger">[{n.errorCode}] {n.errorMessage}</p>}
                      </div>
                      <NotificationBadge status={n.status} />
                      {n.status === "failed" && can(admin.role, "notifications:retry") && <RetryNotificationButton id={String(n._id)} />}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Update order</CardTitle></CardHeader>
            <CardContent>
              <OrderActions
                orderId={order.id}
                status={order.orderStatus}
                paymentMethod={order.paymentMethod}
                paymentStatus={order.paymentStatus}
                totalAmount={order.totalAmount}
                allowed={ORDER_TRANSITIONS[order.orderStatus]}
                canUpdate={can(admin.role, "orders:update")}
                canCancel={can(admin.role, "orders:cancel")}
                canRefund={can(admin.role, "orders:refund")}
                canOverride={can(admin.role, "orders:override")}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Timeline</CardTitle></CardHeader>
            <CardContent>
              <ol className="space-y-4 border-l-2 border-border pl-4 text-sm">
                {[...order.statusHistory].reverse().map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary ring-4 ring-surface" aria-hidden />
                    <p className="font-medium">{ORDER_STATUS_LABELS[h.status]}</p>
                    <p className="text-xs text-subtle-foreground">{formatDateTime(h.at)}{h.by?.name ? ` · ${h.by.name}` : ""}{h.by?.type ? ` (${h.by.type})` : ""}</p>
                    {h.note && <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>}
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Internal notes</CardTitle></CardHeader>
            <CardContent>
              <OrderNotes orderId={order.id} notes={order.internalNotes} canWrite={can(admin.role, "orders:update")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
