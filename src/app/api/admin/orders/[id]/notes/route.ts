import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { orderNoteSchema } from "@/lib/validation/schemas";
import { addOrderNote } from "@/services/orders.service";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "orders:update");
  const { note } = await readJson(req, orderNoteSchema, 4096);
  await addOrderNote(await idParam(params, "Order"), note, admin);
  return json({ ok: true }, { status: 201 });
});
