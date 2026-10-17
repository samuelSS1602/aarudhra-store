import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { objectId } from "@/lib/validation/common";
import { getWishlist, toggleWishlist } from "@/services/customers.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const customer = await requireCustomer(req);
  return json({ items: await getWishlist(customer.id) }, { headers: { "Cache-Control": "no-store" } });
});

const schema = z.object({ productId: objectId, add: z.boolean() });

export const POST = route(async (req) => {
  const customer = await requireCustomer(req);
  const body = await readJson(req, schema, 1024);
  return json({ wishlist: await toggleWishlist(customer.id, body.productId, body.add) });
});
