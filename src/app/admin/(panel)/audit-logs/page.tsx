import { ScrollText } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { formatDateTime } from "@/lib/utils";
import { listAuditLogs } from "@/services/audit.service";
import { EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { SearchFilter, SelectFilter } from "@/components/admin/filters";

export const metadata = { title: "Audit logs" };

export default async function AuditLogsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage("audit:view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listAuditLogs({ page, pageSize: 40, resourceType: sp.resourceType, q: sp.q });
  return (
    <div>
      <PageHeader title="Audit logs" description="Every sensitive staff action, with secrets redacted. Retained for two years." />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchFilter placeholder="Filter by action, e.g. order.status…" />
        <SelectFilter param="resourceType" label="All resources" options={["order", "product", "category", "customer", "coupon", "settings", "admin", "notification", "image"].map((r) => ({ value: r, label: r }))} />
      </div>
      <TableCard>
        {items.length === 0 ? (
          <EmptyState icon={ScrollText} title="No audit entries" />
        ) : (
          <Table>
            <thead><tr><Th>When</Th><Th>Staff</Th><Th>Action</Th><Th>Resource</Th><Th>Details</Th><Th>IP</Th></tr></thead>
            <tbody>
              {items.map((a) => (
                <tr key={String(a._id)}>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(a.createdAt)}</Td>
                  <Td>{a.adminName ?? "System"}<p className="text-xs capitalize text-muted-foreground">{a.adminRole}</p></Td>
                  <Td className="font-mono text-xs">{a.action}</Td>
                  <Td className="text-xs">{a.resourceType}<p className="font-mono text-subtle-foreground">{a.resourceId}</p></Td>
                  <Td className="max-w-80"><code className="line-clamp-3 break-all text-[11px] text-muted-foreground">{JSON.stringify(a.sanitizedMetadata ?? {})}</code></Td>
                  <Td className="font-mono text-xs text-subtle-foreground">{a.ip ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </TableCard>
      <Pagination page={page} total={total} pageSize={40} buildHref={(p) => hrefWith("/admin/audit-logs", sp, { page: p })} />
    </div>
  );
}
