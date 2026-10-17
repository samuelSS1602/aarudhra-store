import { z } from "zod";
import { json, parseQuery, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { toAdminOrderDTO } from "@/lib/serialize";
import { listAdminOrders } from "@/services/orders.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.string().max(30).optional(),
  paymentStatus: z.string().max(30).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = route(async (req) => {
  await requireAdmin(req, "orders:view");
  const q = parseQuery(req, schema);
  const { items, total } = await listAdminOrders(q);
  return json({ items: items.map(toAdminOrderDTO), total }, { headers: { "Cache-Control": "no-store" } });
});
