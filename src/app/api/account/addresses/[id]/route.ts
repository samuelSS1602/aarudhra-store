import { json, readJson, route } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireCustomer } from "@/lib/auth/session";
import { addressSchema } from "@/lib/validation/schemas";
import { objectId } from "@/lib/validation/common";
import { deleteAddress, updateAddress } from "@/services/customers.service";

export const runtime = "nodejs";

async function addressId(params: Promise<{ id: string }>) {
  const { id } = await params;
  if (!objectId.safeParse(id).success) throw notFound("Address not found.");
  return id;
}

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const customer = await requireCustomer(req);
  const id = await addressId(params);
  const body = await readJson(req, addressSchema, 4096);
  return json({ addresses: await updateAddress(customer.id, id, body) });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const customer = await requireCustomer(req);
  const id = await addressId(params);
  return json({ addresses: await deleteAddress(customer.id, id) });
});
