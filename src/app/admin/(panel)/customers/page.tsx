import Link from "next/link";
import { Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { can } from "@/lib/permissions";
import { formatDate, formatINR, maskPhone } from "@/lib/utils";
import { formatPhoneForDisplay } from "@/lib/phone";
import { listCustomers } from "@/services/customers.service";
import { Badge, EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { SearchFilter, SelectFilter } from "@/components/admin/filters";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const admin = await requireAdminPage("customers:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listCustomers({ q: sp.q, status: sp.status, sort: sp.sort, page, pageSize: 25 });
  const pii = can(admin.role, "customers:pii");

  return (
    <div>
      <PageHeader title="Customers" description={`${total} registered customer${total === 1 ? "" : "s"} (verified by OTP)`} />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchFilter placeholder="Name, phone or email…" />
        <SelectFilter param="status" label="Any status" options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
        <SelectFilter param="sort" label="Newest first" options={[{ value: "orders", label: "Most orders" }, { value: "value", label: "Highest value" }]} />
      </div>
      {items.length > 0 && (
        <ul className="space-y-2.5 md:hidden">
          {items.map((c) => (
            <li key={String(c._id)}>
              <Link href={`/admin/customers/${c._id}`} className="block rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-soft active:bg-surface-muted">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-primary">{c.name || "Unnamed customer"}</p>
                    <p className="truncate text-xs text-muted-foreground">{pii ? formatPhoneForDisplay(c.phoneNumber) : maskPhone(c.phoneNumber)}</p>
                  </div>
                  <Badge tone={c.accountStatus === "active" ? "success" : "danger"} className="capitalize">{c.accountStatus}</Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {c.orderCount} order{c.orderCount === 1 ? "" : "s"} · {formatINR(c.totalValue)} · joined {formatDate(c.createdAt)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TableCard className={items.length > 0 ? "hidden md:block" : ""}>
        {items.length === 0 ? (
          <EmptyState icon={Users} title="No customers found" description="Customers appear here after signing in with their mobile number." />
        ) : (
          <Table>
            <thead><tr><Th>Customer</Th><Th>Registered</Th><Th className="text-right">Orders</Th><Th className="text-right">Order value</Th><Th>Last order</Th><Th>Status</Th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={String(c._id)} className="hover:bg-surface-muted/50">
                  <Td>
                    <Link href={`/admin/customers/${c._id}`} className="font-medium text-primary hover:underline">{c.name || "Unnamed customer"}</Link>
                    <p className="text-xs text-muted-foreground">{pii ? formatPhoneForDisplay(c.phoneNumber) : maskPhone(c.phoneNumber)}{c.email ? ` · ${c.email}` : ""}</p>
                  </Td>
                  <Td className="text-muted-foreground">{formatDate(c.createdAt)}</Td>
                  <Td className="text-right tabular-nums">{c.orderCount}</Td>
                  <Td className="text-right tabular-nums">{formatINR(c.totalValue)}</Td>
                  <Td className="text-muted-foreground">{c.lastOrderAt ? formatDate(c.lastOrderAt) : "—"}</Td>
                  <Td><Badge tone={c.accountStatus === "active" ? "success" : "danger"} className="capitalize">{c.accountStatus}</Badge></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>
      <Pagination page={page} total={total} pageSize={25} buildHref={(p) => hrefWith("/admin/customers", sp, { page: p })} />
    </div>
  );
}
