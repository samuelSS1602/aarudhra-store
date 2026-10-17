import Link from "next/link";
import { AlertTriangle, Boxes, History, PackageX } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/utils";
import { inventorySummary, listInventoryLogs } from "@/services/inventory.service";
import { listAdminProducts } from "@/services/products.service";
import { Badge, Card, CardContent, CardHeader, CardTitle, EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, StatTile, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { SearchFilter, SelectFilter } from "@/components/admin/filters";
import { AdjustStockButton } from "@/components/admin/adjust-stock";

export const metadata = { title: "Inventory" };

const TYPE_TONE: Record<string, "success" | "danger" | "info" | "neutral" | "warning"> = {
  initial: "info",
  restock: "success",
  return: "success",
  cancellation: "success",
  order: "neutral",
  damage: "danger",
  adjustment: "warning",
  correction: "warning",
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage("inventory:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const logPage = Math.max(1, Number(sp.logPage) || 1);
  const stock = sp.stock === "low" || sp.stock === "out" ? sp.stock : undefined;
  const [summary, products, logs] = await Promise.all([
    inventorySummary(),
    listAdminProducts({ q: sp.q, stock, page, pageSize: 15 }),
    listInventoryLogs({ productId: sp.productId, type: sp.type, page: logPage, pageSize: 20 }),
  ]);
  const canAdjust = can(admin.role, "inventory:adjust");

  return (
    <div>
      <PageHeader title="Inventory" description="Stock levels, adjustments and the full movement history." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatTile label="Products tracked" value={summary.total} icon={Boxes} />
        <StatTile label="Units in stock" value={summary.units.toLocaleString("en-IN")} icon={Boxes} />
        <StatTile label="Low stock" value={summary.low} icon={AlertTriangle} href="/admin/inventory?stock=low" tone={summary.low ? "warning" : "default"} />
        <StatTile label="Out of stock" value={summary.out} icon={PackageX} href="/admin/inventory?stock=out" tone={summary.out ? "danger" : "default"} />
      </div>

      <div className="mb-4 mt-6 flex flex-wrap gap-2">
        <SearchFilter placeholder="Find product or SKU…" />
        <SelectFilter param="stock" label="All stock levels" options={[{ value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
      </div>
      <TableCard>
        <Table>
          <thead>
            <tr><Th>Product</Th><Th>SKU</Th><Th className="text-right">Stock</Th><Th className="text-right">Alert at</Th><Th className="text-right">Action</Th></tr>
          </thead>
          <tbody>
            {products.items.flatMap((p) => {
              const rows = p.variants.length
                ? p.variants.map((v) => ({ key: v.id, name: `${p.name} — ${v.name}`, sku: v.sku, stock: v.stock, variantId: v.id as string | null }))
                : [{ key: p.id, name: p.name, sku: p.sku, stock: p.stock, variantId: null as string | null }];
              return rows.map((r) => (
                <tr key={r.key}>
                  <Td><Link href={`/admin/inventory?productId=${p.id}`} className="font-medium hover:text-primary">{r.name}</Link></Td>
                  <Td className="font-mono text-xs">{r.sku}</Td>
                  <Td className="text-right tabular-nums">
                    <span className={r.stock === 0 ? "font-semibold text-danger" : r.stock <= p.lowStockThreshold ? "font-semibold text-warning" : ""}>{r.stock}</span>
                  </Td>
                  <Td className="text-right tabular-nums text-muted-foreground">{p.lowStockThreshold}</Td>
                  <Td className="text-right">{canAdjust ? <AdjustStockButton productId={p.id} variantId={r.variantId} name={r.name} current={r.stock} /> : "—"}</Td>
                </tr>
              ));
            })}
          </tbody>
        </Table>
        {products.items.length === 0 && <EmptyState icon={Boxes} title="No matching products" />}
      </TableCard>
      <Pagination page={page} total={products.total} pageSize={15} buildHref={(p) => hrefWith("/admin/inventory", sp, { page: p })} />

      <Card className="mt-8">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2"><History className="size-4" /> Stock history {sp.productId && <Link href="/admin/inventory" className="text-xs font-normal text-primary">(clear product filter)</Link>}</CardTitle>
          <SelectFilter param="type" label="All movements" options={["restock", "order", "cancellation", "return", "adjustment", "correction", "damage", "initial"].map((t) => ({ value: t, label: t }))} />
        </CardHeader>
        <CardContent className="px-0 sm:px-0">
          {logs.items.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-muted-foreground">No stock movements recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead><tr><Th>When</Th><Th>Item</Th><Th>Type</Th><Th className="text-right">Change</Th><Th className="text-right">Before → after</Th><Th>Reason / by</Th></tr></thead>
                <tbody>
                  {logs.items.map((l) => (
                    <tr key={String(l._id)}>
                      <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(l.createdAt)}</Td>
                      <Td><span className="line-clamp-1">{l.productName}</span><span className="font-mono text-xs text-subtle-foreground">{l.sku}</span></Td>
                      <Td><Badge tone={TYPE_TONE[l.adjustmentType] ?? "neutral"} className="capitalize">{l.adjustmentType}</Badge></Td>
                      <Td className={`text-right font-semibold tabular-nums ${l.quantityChange > 0 ? "text-success" : "text-danger"}`}>{l.quantityChange > 0 ? `+${l.quantityChange}` : l.quantityChange}</Td>
                      <Td className="text-right tabular-nums text-muted-foreground">{l.previousStock} → {l.newStock}</Td>
                      <Td className="text-xs text-muted-foreground">
                        {l.reason}
                        {l.adminName && <span className="block">by {l.adminName}</span>}
                        {l.orderId && <Link href={`/admin/orders/${l.orderId}`} className="block text-primary">View order</Link>}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <div className="px-5 sm:px-6">
            <Pagination page={logPage} total={logs.total} pageSize={20} buildHref={(p) => hrefWith("/admin/inventory", sp, { logPage: p })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
