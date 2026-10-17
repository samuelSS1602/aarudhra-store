import { json, readJson, route } from "@/lib/api";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { otpVerifySchema } from "@/lib/validation/schemas";
import { createCustomerSession } from "@/lib/auth/session";
import { CUSTOMER_COOKIE, setSessionCookie } from "@/lib/auth/cookies";
import { verifyOtp } from "@/services/auth.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const body = await readJson(req, otpVerifySchema, 2048);
  const ip = getClientIp(req);
  const { user, isNew } = await verifyOtp({ phone: body.phone, code: body.code, ip });
  const { token, maxAge } = await createCustomerSession(user._id, { ip, userAgent: getUserAgent(req) });
  const res = json({ ok: true, isNew, user: { id: String(user._id), name: user.name ?? "", phoneNumber: user.phoneNumber } });
  setSessionCookie(res, CUSTOMER_COOKIE, token, maxAge);
  return res;
});
