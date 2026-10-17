import { json, route } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { getWishlistIds } from "@/services/customers.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const customer = await getCustomerFromRequest(req);
  if (!customer) return json({ user: null, wishlist: [] }, { headers: { "Cache-Control": "no-store" } });
  const wishlist = await getWishlistIds(customer.id);
  return json(
    { user: { id: customer.id, name: customer.name, phoneNumber: customer.phoneNumber, email: customer.email }, wishlist },
    { headers: { "Cache-Control": "no-store" } },
  );
});
