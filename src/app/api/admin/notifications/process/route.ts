import { json, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { processDueNotifications } from "@/services/notifications.service";
import { audit } from "@/services/audit.service";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Lets staff run the retry queue on demand (same work as the cron job). */
export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "notifications:retry");
  const result = await processDueNotifications(25);
  await audit(admin, "notification.process_queue", "notification", null, result);
  return json({ ok: true, ...result });
});
