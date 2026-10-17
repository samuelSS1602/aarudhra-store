import { z } from "zod";
import { json, parseQuery, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { toOrderDTO } from "@/lib/serialize";
import { listCustomerOrders } from "@/services/orders.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

export const GET = route(async (req) => {
  const customer = await requireCustomer(req);
  const { page } = parseQuery(req, schema);
  const { items, total } = await listCustomerOrders(customer.id, page, 10);
  return json({ items: items.map(toOrderDTO), total, page }, { headers: { "Cache-Control": "no-store" } });
});
