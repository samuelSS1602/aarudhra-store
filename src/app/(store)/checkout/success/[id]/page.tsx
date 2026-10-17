import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, MessageCircle, Package } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { toOrderDTO } from "@/lib/serialize";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatDateTime, formatINR, whatsappLink } from "@/lib/utils";
import { getCustomerOrder } from "@/services/orders.service";
import { getSettings, resolveOwnerRecipients } from "@/services/settings.service";
import { ownerTextMessage, type OrderForMessage } from "@/lib/whatsapp/templates";
import { SendToStoreWhatsApp } from "@/components/orders/send-to-store-whatsapp";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/display";
import { AddressBlock, OrderStatusBadge, OrderTotals } from "@/components/orders/order-bits";
import { ProductImage } from "@/components/products/product-image";
import { Celebrate } from "@/components/orders/celebrate";

export const metadata: Metadata = { title: "Order placed", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function OrderSuccessPage({ params }: { params: Promise<{ id: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login");
  const { id } = await params;
  const doc = await getCustomerOrder(id, customer.id);
  if (!doc) notFound();
  const order = toOrderDTO(doc);
  const settings = await getSettings();
  const wa = settings.general.whatsappNumber;
  // Company WhatsApp: the store number from settings, else the owner alert recipient.
  const storeWa = wa || resolveOwnerRecipients(settings)[0] || "";
  const adminUrl = new URL(`/admin/orders/${order.id}`, process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").toString();
  const storeMessage = ownerTextMessage(doc as unknown as OrderForMessage, adminUrl);

  return (
    <div className="container-page max-w-4xl py-8 sm:py-12">
      <Celebrate>
        <div className="text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 className="size-9" />
          </div>
          <h1 className="mt-5 font-display text-3xl font-semibold sm:text-4xl">Thank you! Your order is placed.</h1>
          <p className="mt-2 text-muted-foreground">
            We&apos;ve received your order and it&apos;s now with the store team. You&apos;ll pay {formatINR(order.totalAmount)} on delivery.
          </p>
        </div>
      </Celebrate>

      {storeWa && <SendToStoreWhatsApp href={whatsappLink(storeWa, storeMessage)} orderNumber={order.orderNumber} />}

      <Card className="mt-8 grid gap-4 p-5 sm:grid-cols-4 sm:p-6">
        <div>
          <p className="text-xs text-subtle-foreground">Order number</p>
          <p className="mt-0.5 font-mono font-semibold">{order.orderNumber}</p>
        </div>
        <div>
          <p className="text-xs text-subtle-foreground">Order date</p>
          <p className="mt-0.5 text-sm font-medium">{formatDateTime(order.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs text-subtle-foreground">Payment</p>
          <p className="mt-0.5 text-sm font-medium">{PAYMENT_METHOD_LABELS[order.paymentMethod]}</p>
        </div>
        <div>
          <p className="text-xs text-subtle-foreground">Status</p>
          <div className="mt-1"><OrderStatusBadge status={order.orderStatus} /></div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 md:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          <h2 className="font-semibold">Order summary</h2>
          <ul className="mt-3 divide-y divide-border">
            {order.items.map((i) => (
              <li key={`${i.productId}:${i.variantId}`} className="flex items-center gap-3 py-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border">
                  <ProductImage image={i.image ? { url: i.image } : null} name={i.name} sizes="56px" className="size-full" />
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="line-clamp-1 font-medium">{i.name}</p>
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
            {order.deliveryOption && (
              <p className="mt-3 rounded-[var(--radius-md)] bg-primary-soft p-2.5 text-xs font-medium text-primary-soft-foreground">
                {order.deliveryOption.label}{order.deliveryOption.etaText ? ` · Estimated ${order.deliveryOption.etaText}` : ""}
              </p>
            )}
          </Card>
          <div className="grid gap-2.5">
            <Button asChild variant="outline">
              <Link href={`/account/orders/${order.id}`}><Package /> Track this order</Link>
            </Button>
            {wa && (
              <Button asChild variant="outline">
                <a href={whatsappLink(wa, `Hello! I have a question about my order ${order.orderNumber}.`)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> WhatsApp support
                </a>
              </Button>
            )}
            <Button asChild>
              <Link href="/products">Continue shopping</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
