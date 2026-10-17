import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { cartSchema } from "@/lib/validation/schemas";
import { mergeGuestCart } from "@/services/cart.service";

export const runtime = "nodejs";

/** Merges the browser's guest cart into the signed-in customer's saved cart. */
export const POST = route(async (req) => {
  const customer = await requireCustomer(req);
  const body = await readJson(req, cartSchema, 20 * 1024);
  return json(await mergeGuestCart(customer.id, body.items));
});
