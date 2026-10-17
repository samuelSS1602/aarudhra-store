import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { cartSchema } from "@/lib/validation/schemas";
import { getCart, saveCart } from "@/services/cart.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const customer = await requireCustomer(req);
  return json(await getCart(customer.id), { headers: { "Cache-Control": "no-store" } });
});

export const PUT = route(async (req) => {
  const customer = await requireCustomer(req);
  const body = await readJson(req, cartSchema, 20 * 1024);
  return json(await saveCart(customer.id, body.items, body.couponCode));
});
