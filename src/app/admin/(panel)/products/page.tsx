import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/utils";
import { listAdminProducts } from "@/services/products.service";
import { listAllCategories } from "@/services/categories.service";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, TableCard, Table, Td, Th, hrefWith } from "@/components/admin/ui";
import { SearchFilter, SelectFilter } from "@/components/admin/filters";
import { ProductImage } from "@/components/products/product-image";

export const metadata = { title: "Products" };

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SP }) {
  const admin = await requireAdminPage("products:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const stock = sp.stock === "low" || sp.stock === "out" ? sp.stock : undefined;
  const [{ items, total }, categories] = await Promise.all([
    listAdminProducts({ q: sp.q, status: sp.status, categoryId: sp.categoryId, stock, page, pageSize: 20 }),
    listAllCategories(),
  ]);

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"}`}
        actions={can(admin.role, "products:write") && (
          <Button asChild><Link href="/admin/products/new"><Plus /> Add product</Link></Button>
        )}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchFilter placeholder="Search name, SKU, brand, barcode…" />
        <SelectFilter param="categoryId" label="All categories" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectFilter param="status" label="Active & draft" options={[{ value: "active", label: "Active" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }]} />
        <SelectFilter param="stock" label="Any stock" options={[{ value: "low", label: "Low stock" }, { value: "out", label: "Out of stock" }]} />
      </div>
      {items.length === 0 ? (
        <TableCard>
          <EmptyState icon={Package} title="No products found" description="Try different filters, or add your first product." />
        </TableCard>
      ) : (
        <>
        <ul className="space-y-2.5 md:hidden">
          {items.map((p) => (
            <li key={p.id}>
              <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-3 shadow-soft active:bg-surface-muted">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-[var(--radius-md)] border border-border">
                  <ProductImage image={p.images[0] ?? null} name={p.name} sizes="56px" className="size-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 font-medium">{p.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{p.sku} · {p.category?.name ?? "—"}</p>
                  <div className="mt-1 flex items-center gap-2 text-sm">
                    <span className="font-semibold tabular-nums">{formatINR(p.price)}</span>
                    <span className={p.stock === 0 ? "text-xs font-semibold text-danger" : p.stock <= p.lowStockThreshold ? "text-xs font-semibold text-warning" : "text-xs text-muted-foreground"}>
                      {p.stock === 0 ? "Out of stock" : `${p.stock} in stock`}
                    </span>
                  </div>
                </div>
                <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "neutral"} className="capitalize">{p.status}</Badge>
              </Link>
            </li>
          ))}
        </ul>
        <TableCard className="hidden md:block">
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th>Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="hover:bg-surface-muted/50">
                  <Td>
                    <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3">
                      <div className="relative size-10 shrink-0 overflow-hidden rounded-[var(--radius-sm)] border border-border">
                        <ProductImage image={p.images[0] ?? null} name={p.name} sizes="40px" className="size-full" />
                      </div>
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium hover:text-primary">{p.name}</span>
                        <span className="flex gap-1.5 text-xs text-muted-foreground">
                          {p.brand}
                          {p.featured && <Badge tone="accent" className="px-1.5 py-0">Featured</Badge>}
                          {p.isDemo && <Badge className="px-1.5 py-0">Demo</Badge>}
                          {p.variants.length > 0 && <span>· {p.variants.length} variants</span>}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="font-mono text-xs">{p.sku}</Td>
                  <Td className="text-muted-foreground">{p.category?.name ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{formatINR(p.price)}</Td>
                  <Td className="text-right tabular-nums">
                    <span className={p.stock === 0 ? "font-semibold text-danger" : p.stock <= p.lowStockThreshold ? "font-semibold text-warning" : ""}>{p.stock}</span>
                  </Td>
                  <Td>
                    <Badge tone={p.status === "active" ? "success" : p.status === "draft" ? "warning" : "neutral"} className="capitalize">{p.status}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
        </>
      )}
      <Pagination page={page} total={total} pageSize={20} buildHref={(p) => hrefWith("/admin/products", sp, { page: p })} />
    </div>
  );
}
