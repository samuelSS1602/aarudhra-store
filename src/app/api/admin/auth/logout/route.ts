import { json, route } from "@/lib/api";
import { destroyAdminSession } from "@/lib/auth/admin-session";
import { ADMIN_COOKIE, clearSessionCookie } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await destroyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
  const res = json({ ok: true });
  clearSessionCookie(res, ADMIN_COOKIE);
  return res;
});
