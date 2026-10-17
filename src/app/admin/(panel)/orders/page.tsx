import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_STATUSES, NOTIFICATION_STATUS_LABELS, type OrderStatus, type PaymentStatus } from "@/lib/constants";
import { resolveRange } from "@/lib/date-range";
import { formatDateTime, formatINR, maskPhone } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import { listAdminOrders } from "@/services/orders.service";
import { EmptyState } from "@/components/ui/display";
import { NotificationBadge } from "@/components/admin/notification-badge";
import { PageHeader, Pagination, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { AutoRefresh, SearchFilter, SelectFilter } from "@/components/admin/filters";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/orders/order-bits";

export const metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage("orders:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const range = sp.range ? resolveRange(sp.range, sp.from, sp.to) : null;
  const { items, total } = await listAdminOrders({
    q: sp.q,
    status: sp.status,
    paymentStatus: sp.paymentStatus,
    notification: sp.notification,
    from: range?.from,
    to: range?.to,
    page,
    pageSize: 25,
  });
  const pii = can(admin.role, "customers:pii");

  return (
    <div>
      <AutoRefresh intervalMs={15_000} />
      <PageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"} · refreshes automatically`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchFilter placeholder="Order number, customer name or phone…" />
        <SelectFilter param="status" label="All statuses" options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))} />
        <SelectFilter param="paymentStatus" label="Any payment" options={PAYMENT_STATUSES.map((s) => ({ value: s, label: PAYMENT_STATUS_LABELS[s] }))} />
        <SelectFilter param="notification" label="Any WhatsApp status" options={["pending", "queued", "sent", "delivered", "read", "failed", "disabled"].map((s) => ({ value: s, label: NOTIFICATION_STATUS_LABELS[s]! }))} />
        <SelectFilter param="range" label="Any date" options={[{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }, { value: "7d", label: "Last 7 days" }, { value: "30d", label: "Last 30 days" }]} />
      </div>
      {/* Phones: tappable cards */}
      {items.length > 0 && (
        <ul className="space-y-2.5 md:hidden">
          {items.map((o) => (
            <li key={String(o._id)}>
              <Link href={`/admin/orders/${o._id}`} className="block rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-soft active:bg-surface-muted">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold text-primary">{o.orderNumber}</p>
                    <p className="truncate text-sm font-medium">{o.customerSnapshot?.name}</p>
                    <p className="text-xs text-muted-foreground">{pii ? formatPhoneForDisplay(o.customerSnapshot!.phone) : maskPhone(o.customerSnapshot!.phone)} · {formatDateTime(o.createdAt)}</p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums">{formatINR(o.totalAmount)}</p>
                </div>
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <OrderStatusBadge status={o.orderStatus as OrderStatus} />
                  <PaymentStatusBadge status={o.paymentStatus as PaymentStatus} />
                  <NotificationBadge status={o.ownerNotificationStatus ?? "pending"} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TableCard className={items.length > 0 ? "hidden md:block" : ""}>
        {items.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No orders found" description="Orders appear here the moment customers place them." />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th>Items</Th>
                <Th className="text-right">Total</Th>
                <Th>Payment</Th>
                <Th>Status</Th>
                <Th>WhatsApp</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={String(o._id)} className="hover:bg-surface-muted/50">
                  <Td>
                    <Link href={`/admin/orders/${o._id}`} className="font-mono text-sm font-semibold text-primary hover:underline">{o.orderNumber}</Link>
                    <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</p>
                  </Td>
                  <Td>
                    <p className="font-medium">{o.customerSnapshot?.name}</p>
                    <p className="text-xs text-muted-foreground">{pii ? formatPhoneForDisplay(o.customerSnapshot!.phone) : maskPhone(o.customerSnapshot!.phone)}</p>
                  </Td>
                  <Td className="max-w-56">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}</p>
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">{formatINR(o.totalAmount)}</Td>
                  <Td>
                    <p className="text-xs">{PAYMENT_METHOD_LABELS[o.paymentMethod as "cod"]}</p>
                    <PaymentStatusBadge status={o.paymentStatus as PaymentStatus} />
                  </Td>
                  <Td><OrderStatusBadge status={o.orderStatus as OrderStatus} /></Td>
                  <Td><NotificationBadge status={o.ownerNotificationStatus ?? "pending"} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>
      <Pagination page={page} total={total} pageSize={25} buildHref={(p) => hrefWith("/admin/orders", sp, { page: p })} />
    </div>
  );
}
