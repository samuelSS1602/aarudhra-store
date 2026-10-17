import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth/admin-session";
import { can } from "@/lib/permissions";
import { settingsUpdateSchema } from "@/lib/validation/settings";
import { updateSettingsSection } from "@/services/settings.service";
import { audit } from "@/services/audit.service";

export const runtime = "nodejs";

export const PATCH = route(async (req) => {
  const admin = await requireAdmin(req, "settings:write");
  const body = await readJson(req, settingsUpdateSchema, 64 * 1024);

  // Notification recipients/templates and payment toggles are security-sensitive.
  const sensitive = body.section === "notifications" || body.section === "commerce";
  if (sensitive && !can(admin.role, "settings:security")) {
    throw forbidden("Only administrators can change commerce and notification settings.");
  }

  await updateSettingsSection(body.section, body.data as never, admin.id);
  await audit(admin, `settings.update.${body.section}`, "settings", body.section, body.section === "notifications" ? { recipients: (body.data as { ownerWhatsappNumbers: string[] }).ownerWhatsappNumbers.length } : {});
  invalidate(TAGS.settings);
  return json({ ok: true });
});
