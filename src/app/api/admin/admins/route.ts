import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { adminCreateSchema } from "@/lib/validation/schemas";
import { createAdminUser } from "@/services/admin-users.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const actor = await requireAdmin(req, "admins:manage");
  const input = await readJson(req, adminCreateSchema, 2048);
  const admin = await createAdminUser(input, actor);
  return json({ admin: { id: String(admin._id), email: admin.email, role: admin.role } }, { status: 201 });
});
