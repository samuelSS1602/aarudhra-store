import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { getClientIp, getUserAgent } from "@/lib/security/request";
import { createCustomerSession } from "@/lib/auth/session";
import { CUSTOMER_COOKIE, setSessionCookie } from "@/lib/auth/cookies";
import { signInWithFirebaseToken } from "@/services/auth.service";

export const runtime = "nodejs";

const schema = z.object({ idToken: z.string().min(100).max(4096) });

/** Exchanges a verified Firebase phone ID token for the store's own session cookie. */
export const POST = route(async (req) => {
  const { idToken } = await readJson(req, schema, 8 * 1024);
  const ip = getClientIp(req);
  const { user, isNew } = await signInWithFirebaseToken({ idToken, ip });
  const { token, maxAge } = await createCustomerSession(user._id, { ip, userAgent: getUserAgent(req) });
  const res = json({ ok: true, isNew, user: { id: String(user._id), name: user.name ?? "", phoneNumber: user.phoneNumber } });
  setSessionCookie(res, CUSTOMER_COOKIE, token, maxAge);
  return res;
});
