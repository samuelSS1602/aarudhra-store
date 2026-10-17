import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { orderNoteSchema } from "@/lib/validation/schemas";
import { addCustomerNote } from "@/services/customers.service";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "customers:write");
  const { note } = await readJson(req, orderNoteSchema, 4096);
  await addCustomerNote(await idParam(params, "Customer"), note, admin);
  return json({ ok: true }, { status: 201 });
});
