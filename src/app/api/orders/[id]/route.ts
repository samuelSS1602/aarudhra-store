import { json, route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireCustomer } from "@/lib/auth/session";
import { toOrderDTO } from "@/lib/serialize";
import { getCustomerOrder } from "@/services/orders.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const customer = await requireCustomer(req);
  const { id } = await params;
  const order = await getCustomerOrder(id, customer.id);
  if (!order) throw notFound("Order not found.");
  return json({ order: toOrderDTO(order) }, { headers: { "Cache-Control": "no-store" } });
});
