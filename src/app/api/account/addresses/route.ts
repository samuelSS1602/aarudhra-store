import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { addressSchema } from "@/lib/validation/schemas";
import { addAddress } from "@/services/customers.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const customer = await requireCustomer(req);
  const body = await readJson(req, addressSchema, 4096);
  return json({ addresses: await addAddress(customer.id, body) }, { status: 201 });
});
