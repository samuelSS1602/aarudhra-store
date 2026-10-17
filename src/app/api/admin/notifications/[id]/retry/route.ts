import { json, idParam, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { retryNotification } from "@/services/notifications.service";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "notifications:retry");
  const log = await retryNotification(await idParam(params, "Notification"), admin);
  return json({ ok: true, status: log.status, errorMessage: log.errorMessage ?? null });
});
