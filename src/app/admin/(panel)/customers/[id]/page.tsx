import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { formatDate, formatDateTime, formatINR, maskPhone, whatsappLink } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import type { OrderStatus } from "@/lib/constants";
import { getCustomerForAdmin } from "@/services/customers.service";
import { listAdminOrders } from "@/services/orders.service";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/display";
import { PageHeader, StatTile } from "@/components/admin/ui";
import { OrderStatusBadge } from "@/components/orders/order-bits";
import { CustomerAdminPanel } from "@/components/admin/customer-admin-panel";

export const metadata = { title: "Customer" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("customers:view");
  const { id } = await params;
  const data = await getCustomerForAdmin(id);
  if (!data) notFound();
  const { user, stats } = data;
  const orders = await listAdminOrders({ userId: id, page: 1, pageSize: 20 });
  const pii = can(admin.role, "customers:pii");

  return (
    <div>
      <PageHeader
        title={user.name || "Unnamed customer"}
        description={<span className="flex flex-wrap items-center gap-2">{pii ? formatPhoneForDisplay(user.phoneNumber ?? user.contactPhone) : maskPhone(user.phoneNumber ?? user.contactPhone)} {user.phoneVerified && <Badge tone="success">Phone verified</Badge>} {user.authProvider === "google" && <Badge tone="info">Google · {user.email}</Badge>} <Badge tone={user.accountStatus === "active" ? "primary" : "danger"} className="capitalize">{user.accountStatus}</Badge></span>}
        actions={pii && (user.phoneNumber || user.contactPhone) && (
          <Button asChild variant="outline"><a href={whatsappLink(user.phoneNumber ?? user.contactPhone ?? "")} target="_blank" rel="noopener noreferrer"><MessageCircle /> WhatsApp</a></Button>
        )}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Orders" value={stats.orderCount} />
        <StatTile label="Order value" value={formatINR(stats.totalValue)} hint="Excludes cancelled" />
        <StatTile label="Last order" value={stats.lastOrderAt ? formatDate(stats.lastOrderAt) : "—"} />
        <StatTile label="Registered" value={formatDate(user.createdAt)} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Order history</CardTitle></CardHeader>
            <CardContent className="px-0 sm:px-0">
              {orders.items.length === 0 ? (
                <p className="px-6 pb-4 text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.items.map((o) => (
                    <li key={String(o._id)}>
                      <Link href={`/admin/orders/${o._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/50 sm:px-6">
                        <span className="flex-1 font-mono text-sm font-semibold">{o.orderNumber}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                        <OrderStatusBadge status={o.orderStatus as OrderStatus} />
                        <span className="w-20 text-right text-sm font-semibold tabular-nums">{formatINR(o.totalAmount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Saved addresses</CardTitle></CardHeader>
            <CardContent>
              {!pii ? (
                <p className="text-sm text-muted-foreground">Addresses are hidden for your role.</p>
              ) : user.addresses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved addresses.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {user.addresses.map((a) => (
                    <div key={String(a._id)} className="rounded-[var(--radius-lg)] border border-border p-3.5 text-sm">
                      <p className="font-semibold">{a.label} {a.isDefault && <Badge tone="primary">Default</Badge>}</p>
                      <p className="mt-1 text-muted-foreground">{a.fullName}, {a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? `, near ${a.landmark}` : ""}, {a.city}, {a.district}, {a.state} – {a.pincode}</p>
                      <p className="text-muted-foreground">{a.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <CustomerAdminPanel
          id={id}
          name={user.name ?? ""}
          email={user.email ?? ""}
          status={user.accountStatus as "active" | "suspended"}
          notes={(user.internalNotes ?? []).map((n) => ({ id: String(n._id), note: n.note, adminName: n.adminName ?? "", at: new Date(n.createdAt as Date).toISOString() }))}
          canWrite={can(admin.role, "customers:write")}
          canSuspend={can(admin.role, "customers:suspend")}
          preferences={{ whatsapp: Boolean(user.preferences?.whatsappOrderUpdates), marketing: Boolean(user.preferences?.marketingOptIn) }}
        />
      </div>
    </div>
  );
}
