import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminUpdateSchema } from "@/lib/validation/schemas";
import { updateAdminUser } from "@/services/admin-users.service";

export const runtime = "nodejs";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const actor = await requireAdmin(req, "admins:manage");
  const input = await readJson(req, adminUpdateSchema, 2048);
  const admin = await updateAdminUser(await idParam(params, "Staff account"), input, actor);
  return json({ admin: { id: String(admin._id), role: admin.role, status: admin.status } });
});
