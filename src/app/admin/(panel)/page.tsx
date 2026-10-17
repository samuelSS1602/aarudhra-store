import Link from "next/link";
import { AlertTriangle, Ban, Boxes, CheckCircle2, ClipboardList, Clock, IndianRupee, PackageX, ShieldAlert, Truck, Users, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { resolveRange, toIstDateInput } from "@/lib/date-range";
import { ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatDateTime, formatINR, maskPhone } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { getDashboardMetrics } from "@/services/analytics.service";
import { getLowStockProducts } from "@/services/products.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Alert } from "@/components/ui/display";
import { PageHeader, StatTile } from "@/components/admin/ui";
import { AutoRefresh, RangeFilter } from "@/components/admin/filters";
import { HBarChart, SalesTrendChart } from "@/components/admin/charts-lazy";
import { OrderStatusBadge } from "@/components/orders/order-bits";

export const metadata = { title: "Overview" };

type SP = Promise<{ range?: string; from?: string; to?: string; denied?: string }>;

export default async function AdminOverview({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdminPage("dashboard:view");
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "30d", sp.from, sp.to);
  const [m, lowStock] = await Promise.all([getDashboardMetrics(range), getLowStockProducts(6)]);
  const showMoney = can(admin.role, "analytics:view");
  const showPii = can(admin.role, "customers:pii");

  const statusTiles: { s: OrderStatus; icon: typeof Clock }[] = [
    { s: "pending", icon: Clock },
    { s: "confirmed", icon: CheckCircle2 },
    { s: "processing", icon: ClipboardList },
    { s: "shipped", icon: Truck },
    { s: "delivered", icon: CheckCircle2 },
    { s: "cancelled", icon: Ban },
  ];

  return (
    <div>
      <AutoRefresh intervalMs={30_000} />
      <PageHeader
        title={`Welcome back, ${admin.name.split(" ")[0]}`}
        description="Live figures from your store database."
        actions={<RangeFilter preset={range.preset} from={toIstDateInput(range.from)} to={toIstDateInput(range.to)} />}
      />
      {sp.denied && <Alert tone="warning" icon={ShieldAlert} className="mb-5">You don&apos;t have permission to open that page.</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {showMoney && (
          <StatTile tone="primary" label="Realized revenue" value={formatINR(m.totals.realizedRevenue)} icon={Wallet} hint="Collected payments minus refunds" />
        )}
        {showMoney && (
          <StatTile label="Gross order value" value={formatINR(m.totals.grossOrderValue)} icon={IndianRupee} hint={`Excl. cancelled · AOV ${formatINR(m.totals.averageOrderValue)}`} />
        )}
        <StatTile label="Orders" value={m.totals.orders} icon={ClipboardList} hint={`${m.totals.itemsSold} items sold`} href="/admin/orders" />
        <StatTile label="Customers" value={m.customers.total} icon={Users} hint={`${m.customers.newInRange} new in period`} href="/admin/customers" />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-4 sm:grid-cols-6 sm:gap-4">
        {statusTiles.map(({ s, icon }) => (
          <StatTile key={s} label={ORDER_STATUS_LABELS[s]} value={m.byStatus[s]} icon={icon} href={`/admin/orders?status=${s}`} tone={s === "pending" && m.byStatus[s] > 0 ? "warning" : "default"} />
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 sm:mt-4 sm:gap-4">
        <StatTile label="Products" value={m.products.total} icon={Boxes} href="/admin/products" />
        <StatTile label="Low stock" value={m.products.low} icon={AlertTriangle} href="/admin/products?stock=low" tone={m.products.low ? "warning" : "default"} />
        <StatTile label="Out of stock" value={m.products.out} icon={PackageX} href="/admin/products?stock=out" tone={m.products.out ? "danger" : "default"} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        {showMoney && (
          <Card>
            <CardHeader>
              <CardTitle>Sales trend</CardTitle>
              <CardDescription>Daily, India Standard Time. Realized = paid orders (COD is marked paid on delivery) minus refunds.</CardDescription>
            </CardHeader>
            <CardContent>
              <SalesTrendChart data={m.trend} />
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Order status distribution</CardTitle>
            <CardDescription>Orders placed in the selected period</CardDescription>
          </CardHeader>
          <CardContent>
            <HBarChart data={ORDER_STATUSES.map((s) => ({ label: ORDER_STATUS_LABELS[s], value: m.byStatus[s] })).filter((d) => d.value > 0)} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent orders</CardTitle>
            <Link href="/admin/orders" className="text-sm font-semibold text-primary">View all</Link>
          </CardHeader>
          <CardContent className="px-0 sm:px-0">
            {m.recentOrders.length === 0 ? (
              <p className="px-6 pb-4 text-sm text-muted-foreground">No orders yet. New orders appear here automatically.</p>
            ) : (
              <ul className="divide-y divide-border">
                {m.recentOrders.map((o) => (
                  <li key={String(o._id)}>
                    <Link href={`/admin/orders/${o._id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-muted/60 sm:px-6">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-sm font-semibold">{o.orderNumber}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.customerSnapshot?.name} · {formatDateTime(o.createdAt)}</p>
                      </div>
                      <OrderStatusBadge status={o.orderStatus as OrderStatus} />
                      <p className="w-20 text-right text-sm font-semibold tabular-nums">{formatINR(o.totalAmount)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Best-selling products</CardTitle>
            <CardDescription>By units sold in the period</CardDescription>
          </CardHeader>
          <CardContent>
            {m.bestSellers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales in this period yet.</p>
            ) : (
              <ol className="space-y-3">
                {m.bestSellers.map((b, i) => (
                  <li key={String(b._id)} className="flex items-center gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{b.name}</span>
                    <span className="text-muted-foreground">{b.quantity} sold</span>
                    {showMoney && <span className="w-20 text-right font-semibold tabular-nums">{formatINR(b.revenue)}</span>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Low-stock alerts</CardTitle>
            <Link href="/admin/inventory" className="text-sm font-semibold text-primary">Inventory</Link>
          </CardHeader>
          <CardContent>
            {lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">All products are above their low-stock thresholds.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {lowStock.map((p: { _id: string; name: string; sku: string; stock: number; lowStockThreshold: number }) => (
                  <li key={String(p._id)} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/products/${p._id}`} className="min-w-0 truncate hover:text-primary">{p.name}</Link>
                    <span className={p.stock === 0 ? "font-semibold text-danger" : "font-semibold text-warning"}>{p.stock === 0 ? "Out" : `${p.stock} left`}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent registrations</CardTitle>
          </CardHeader>
          <CardContent>
            {m.recentCustomers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No customers yet.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {m.recentCustomers.map((c) => (
                  <li key={String(c._id)} className="flex items-center justify-between gap-2">
                    <Link href={`/admin/customers/${c._id}`} className="min-w-0 truncate hover:text-primary">{c.name || (showPii ? (c.phoneNumber ?? c.email) : maskPhone(c.phoneNumber) || "Google customer")}</Link>
                    <span className="shrink-0 text-xs text-subtle-foreground">{formatDateTime(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent admin activity</CardTitle>
            {can(admin.role, "audit:view") && <Link href="/admin/audit-logs" className="text-sm font-semibold text-primary">Audit log</Link>}
          </CardHeader>
          <CardContent>
            {m.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {m.recentActivity.map((a) => (
                  <li key={String(a._id)}>
                    <p><span className="font-medium">{a.adminName ?? "System"}</span> <span className="text-muted-foreground">· {a.action}</span></p>
                    <p className="text-xs text-subtle-foreground">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
