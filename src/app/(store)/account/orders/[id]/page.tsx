import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { toOrderDTO } from "@/lib/serialize";
import { ORDER_STATUS_LABELS, PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDateTime, formatINR, whatsappLink } from "@/lib/utils";
import { getCustomerOrder } from "@/services/orders.service";
import { getSettings } from "@/services/settings.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { AddressBlock, OrderProgress, OrderStatusBadge, OrderTotals, PaymentStatusBadge } from "@/components/orders/order-bits";
import { ProductImage } from "@/components/products/product-image";
import { CancelOrderButton } from "@/components/account/cancel-order-button";

export const metadata = { title: "Order details" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account/orders");
  const { id } = await params;
  // Ownership enforced in the query — another customer's order id returns 404.
  const doc = await getCustomerOrder(id, customer.id);
  if (!doc) notFound();
  const order = toOrderDTO(doc);
  const settings = await getSettings();
  const cancellable = settings.commerce.customerCancellableStatuses.includes(order.orderStatus);
  const wa = settings.general.whatsappNumber;

  return (
    <div>
      <Link href="/account/orders" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> All orders
      </Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">Order {order.orderNumber}</h1>
        <OrderStatusBadge status={order.orderStatus} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>

      <Card className="mt-6 p-5 sm:p-6">
        <OrderProgress order={order} />
        {order.deliveryOption?.etaText && !["delivered", "cancelled", "returned", "refunded"].includes(order.orderStatus) && (
          <p className="mt-5 text-center text-sm text-muted-foreground">{order.deliveryOption.label} · Estimated {order.deliveryOption.etaText}</p>
        )}
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">Items</h2>
          <ul className="mt-2 divide-y divide-border">
            {order.items.map((i) => (
              <li key={`${i.productId}:${i.variantId}`} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border">
                  <ProductImage image={i.image ? { url: i.image } : null} name={i.name} sizes="56px" className="size-full" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {i.slug ? <Link href={`/products/${i.slug}`} className="line-clamp-1 font-medium hover:text-primary">{i.name}</Link> : <p className="font-medium">{i.name}</p>}
                  {i.variantName && <p className="text-xs text-muted-foreground">{i.variantName}</p>}
                  <p className="text-xs text-muted-foreground">{i.quantity} × {formatINR(i.unitPrice)}</p>
                </div>
                <p className="text-sm font-semibold tabular-nums">{formatINR(i.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-4 border-t border-border pt-4">
            <OrderTotals order={order} />
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="mb-2 text-sm font-semibold">Delivery address</h2>
            <AddressBlock a={order.shippingAddress} />
          </Card>
          <Card className="space-y-2 p-5 text-sm">
            <h2 className="font-semibold">Payment</h2>
            <p className="text-muted-foreground">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
            <PaymentStatusBadge status={order.paymentStatus} />
            {order.refund && <p className="text-muted-foreground">Refunded {formatINR(order.refund.amount)}</p>}
          </Card>
          <Card className="p-5 text-sm">
            <h2 className="mb-3 font-semibold">History</h2>
            <ol className="space-y-3 border-l-2 border-border pl-4">
              {[...order.statusHistory].reverse().map((h, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full bg-primary" aria-hidden />
                  <p className="font-medium">{ORDER_STATUS_LABELS[h.status]}</p>
                  <p className="text-xs text-subtle-foreground">{formatDateTime(h.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
          <div className="grid gap-2">
            {wa && (
              <Button asChild variant="outline">
                <a href={whatsappLink(wa, `Hello! I need help with order ${order.orderNumber}.`)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Get help on WhatsApp
                </a>
              </Button>
            )}
            {cancellable && <CancelOrderButton orderId={order.id} orderNumber={order.orderNumber} />}
          </div>
        </div>
      </div>
    </div>
  );
}
