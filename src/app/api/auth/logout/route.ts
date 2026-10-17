import { json, route } from "@/lib/api";
import { destroyCustomerSession } from "@/lib/auth/session";
import { clearSessionCookie, CUSTOMER_COOKIE } from "@/lib/auth/cookies";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  await destroyCustomerSession(req.cookies.get(CUSTOMER_COOKIE)?.value);
  const res = json({ ok: true });
  clearSessionCookie(res, CUSTOMER_COOKIE);
  return res;
});
