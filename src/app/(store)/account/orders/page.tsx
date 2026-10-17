import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Package } from "lucide-react";
import { getCurrentCustomer } from "@/lib/auth/session";
import { toOrderDTO } from "@/lib/serialize";
import { formatDate, formatINR } from "@/lib/utils";
import { listCustomerOrders } from "@/services/orders.service";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/display";
import { OrderStatusBadge } from "@/components/orders/order-bits";
import { ProductImage } from "@/components/products/product-image";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account/orders");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const { items, total } = await listCustomerOrders(customer.id, page, 10);
  const orders = items.map(toOrderDTO);
  const pages = Math.ceil(total / 10);

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Your orders</h1>
      <p className="mt-1 text-muted-foreground">{total} order{total === 1 ? "" : "s"}</p>
      {orders.length === 0 ? (
        <Card className="mt-6">
          <EmptyState icon={Package} title="No orders yet" description="When you place an order, you can track it here." action={<Button asChild><Link href="/products">Start shopping</Link></Button>} />
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="group flex items-center gap-4 rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift">
                <div className="flex -space-x-3">
                  {o.items.slice(0, 3).map((i, idx) => (
                    <div key={idx} className="relative size-12 overflow-hidden rounded-[var(--radius-md)] border-2 border-surface">
                      <ProductImage image={i.image ? { url: i.image } : null} name={i.name} sizes="48px" className="size-full" />
                    </div>
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">{o.orderNumber}</p>
                    <OrderStatusBadge status={o.orderStatus} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} items · {formatINR(o.totalAmount)}
                  </p>
                </div>
                <ChevronRight className="size-5 text-subtle-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 && <Button asChild variant="outline" size="sm"><Link href={`?page=${page - 1}`}>Previous</Link></Button>}
          {page < pages && <Button asChild variant="outline" size="sm"><Link href={`?page=${page + 1}`}>Next</Link></Button>}
        </div>
      )}
    </div>
  );
}
