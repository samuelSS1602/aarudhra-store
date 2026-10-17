import { IndianRupee, Package, ReceiptIndianRupee, RotateCcw, ShoppingCart, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { resolveRange, toIstDateInput } from "@/lib/date-range";
import { PAYMENT_METHOD_LABELS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { getAnalyticsBreakdown, getDashboardMetrics } from "@/services/analytics.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/display";
import { PageHeader, StatTile, Table, Td, Th } from "@/components/admin/ui";
import { RangeFilter } from "@/components/admin/filters";
import { HBarChart, HourChart, SalesTrendChart } from "@/components/admin/charts-lazy";

export const metadata = { title: "Sales analytics" };

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdminPage("analytics:view");
  const sp = await searchParams;
  const range = resolveRange(sp.range ?? "30d", sp.from, sp.to);
  const [m, b] = await Promise.all([getDashboardMetrics(range), getAnalyticsBreakdown(range)]);

  return (
    <div>
      <PageHeader title="Sales analytics" description="All figures are computed from orders in the database. Times in IST." actions={<RangeFilter preset={range.preset} from={toIstDateInput(range.from)} to={toIstDateInput(range.to)} />} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile tone="primary" label="Realized revenue" value={formatINR(m.totals.realizedRevenue)} icon={Wallet} />
        <StatTile label="Gross order value" value={formatINR(m.totals.grossOrderValue)} icon={IndianRupee} />
        <StatTile label="Refunds" value={formatINR(m.totals.refunds)} icon={RotateCcw} />
        <StatTile label="Orders (excl. cancelled)" value={m.totals.nonCancelledOrders} icon={ShoppingCart} />
        <StatTile label="Avg. order value" value={formatINR(m.totals.averageOrderValue)} icon={ReceiptIndianRupee} />
        <StatTile label="Items sold" value={m.totals.itemsSold} icon={Package} />
      </div>

      <Card className="mt-5">
        <CardHeader>
          <CardTitle>Revenue over time</CardTitle>
          <CardDescription>
            <strong>Gross order value</strong> counts every non-cancelled order when placed. <strong>Realized revenue</strong> counts only money collected (paid orders, COD marked paid on delivery) minus refunds.
          </CardDescription>
        </CardHeader>
        <CardContent><SalesTrendChart data={m.trend} /></CardContent>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Revenue by category</CardTitle><CardDescription>Line totals before order-level discounts</CardDescription></CardHeader>
          <CardContent><HBarChart data={b.byCategory.map((c) => ({ label: c.name, value: c.revenue }))} valueFormat="inr" /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Orders by hour of day</CardTitle><CardDescription>When customers place orders</CardDescription></CardHeader>
          <CardContent><HourChart data={b.hours} /></CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle>Top products</CardTitle></CardHeader>
          <CardContent className="px-0 sm:px-0">
            <Table>
              <thead><tr><Th>Product</Th><Th className="text-right">Units</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody>
                {m.bestSellers.length === 0 && <tr><Td className="text-muted-foreground">No sales yet.</Td></tr>}
                {m.bestSellers.map((p) => (
                  <tr key={String(p._id)}><Td className="max-w-48 truncate">{p.name}</Td><Td className="text-right tabular-nums">{p.quantity}</Td><Td className="text-right tabular-nums">{formatINR(p.revenue)}</Td></tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment methods</CardTitle></CardHeader>
          <CardContent className="px-0 sm:px-0">
            <Table>
              <thead><tr><Th>Method</Th><Th className="text-right">Orders</Th><Th className="text-right">Value</Th></tr></thead>
              <tbody>
                {b.byPayment.length === 0 && <tr><Td className="text-muted-foreground">No orders yet.</Td></tr>}
                {b.byPayment.map((p) => (
                  <tr key={p._id}><Td>{PAYMENT_METHOD_LABELS[p._id as "cod"] ?? p._id}</Td><Td className="text-right tabular-nums">{p.count}</Td><Td className="text-right tabular-nums">{formatINR(p.value)}</Td></tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Coupon usage</CardTitle></CardHeader>
          <CardContent className="px-0 sm:px-0">
            <Table>
              <thead><tr><Th>Code</Th><Th className="text-right">Orders</Th><Th className="text-right">Discount given</Th></tr></thead>
              <tbody>
                {b.coupons.length === 0 && <tr><Td className="text-muted-foreground">No coupons used.</Td></tr>}
                {b.coupons.map((c) => (
                  <tr key={c._id}><Td className="font-mono">{c._id}</Td><Td className="text-right tabular-nums">{c.count}</Td><Td className="text-right tabular-nums">{formatINR(c.discount)}</Td></tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
