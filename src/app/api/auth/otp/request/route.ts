import { json, readJson, route } from "@/lib/api";
import { getClientIp } from "@/lib/security/request";
import { otpRequestSchema } from "@/lib/validation/schemas";
import { requestOtp } from "@/services/auth.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const body = await readJson(req, otpRequestSchema, 2048);
  const result = await requestOtp({ phone: body.phone, ip: getClientIp(req) });
  return json({ ok: true, ...result });
});
