import { json, readJson, route } from "@/lib/api";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { adminLoginSchema } from "@/lib/validation/schemas";
import { createAdminSession } from "@/lib/auth/admin-session";
import { ADMIN_COOKIE, setSessionCookie } from "@/lib/auth/cookies";
import { authenticateAdmin } from "@/services/admin-users.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const { email, password } = await readJson(req, adminLoginSchema, 2048);
  const ip = getClientIp(req);
  const admin = await authenticateAdmin(email, password, ip);
  const { token, maxAge } = await createAdminSession(admin._id, { ip, userAgent: getUserAgent(req) });
  const res = json({ ok: true, admin: { name: admin.name, role: admin.role } });
  setSessionCookie(res, ADMIN_COOKIE, token, maxAge);
  return res;
});
