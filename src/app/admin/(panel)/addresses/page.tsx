import Link from "next/link";
import { MapPin } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/admin-page";
import { listAllAddresses } from "@/services/customers.service";
import { EmptyState } from "@/components/ui/display";
import { PageHeader, Pagination, Table, TableCard, Td, Th, hrefWith } from "@/components/admin/ui";
import { SearchFilter } from "@/components/admin/filters";

export const metadata = { title: "Customer addresses" };

export default async function AddressesAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdminPage("customers:pii");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { items, total } = await listAllAddresses({ q: sp.q, page, pageSize: 30 });
  return (
    <div>
      <PageHeader title="Customer addresses" description="Saved delivery addresses across all customers." />
      <div className="mb-4"><SearchFilter placeholder="Name, phone, town, district or PIN…" /></div>
      <TableCard>
        {items.length === 0 ? (
          <EmptyState icon={MapPin} title="No addresses found" />
        ) : (
          <Table>
            <thead><tr><Th>Customer</Th><Th>Recipient</Th><Th>Address</Th><Th>Town / district</Th><Th>PIN</Th></tr></thead>
            <tbody>
              {items.map((r, i) => {
                const a = r.address as Record<string, string>;
                return (
                  <tr key={`${r._id}-${i}`}>
                    <Td><Link href={`/admin/customers/${r._id}`} className="font-medium text-primary hover:underline">{r.name || r.phoneNumber}</Link></Td>
                    <Td>{a.fullName}<p className="text-xs text-muted-foreground">{a.phone}</p></Td>
                    <Td className="max-w-72 text-muted-foreground">{a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? ` (near ${a.landmark})` : ""}</Td>
                    <Td>{a.city}<p className="text-xs text-muted-foreground">{a.district}, {a.state}</p></Td>
                    <Td className="font-mono">{a.pincode}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </TableCard>
      <Pagination page={page} total={total} pageSize={30} buildHref={(p) => hrefWith("/admin/addresses", sp, { page: p })} />
    </div>
  );
}
