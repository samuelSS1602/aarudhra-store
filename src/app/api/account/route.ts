import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { profileSchema } from "@/lib/validation/schemas";
import { getProfile, updateProfile } from "@/services/customers.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const customer = await requireCustomer(req);
  return json({ profile: await getProfile(customer.id) }, { headers: { "Cache-Control": "no-store" } });
});

export const PATCH = route(async (req) => {
  const customer = await requireCustomer(req);
  const body = await readJson(req, profileSchema, 4096);
  return json({ profile: await updateProfile(customer.id, body) });
});
