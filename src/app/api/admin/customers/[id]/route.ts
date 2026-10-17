import { json, idParam, readJson, route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth/admin-session";
import { can } from "@/lib/permissions";
import { customerAdminUpdateSchema } from "@/lib/validation/schemas";
import { updateCustomerAsAdmin } from "@/services/customers.service";

export const runtime = "nodejs";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "customers:write");
  const id = await idParam(params, "Customer");
  const input = await readJson(req, customerAdminUpdateSchema, 2048);
  if (input.accountStatus && !can(admin.role, "customers:suspend")) throw forbidden("You can't suspend or reactivate accounts.");
  await updateCustomerAsAdmin(id, input, admin);
  return json({ ok: true });
});
