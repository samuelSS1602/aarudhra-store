import { z } from "zod";
import { json, readJson, route } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { connectDB } from "@/lib/mongodb";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { getSettings } from "@/services/settings.service";
import { Subscriber } from "@/models/misc";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  consent: z.literal(true, { errorMap: () => ({ message: "Please confirm you'd like to receive offers" }) }),
});

export const POST = route(async (req) => {
  const settings = await getSettings();
  if (!settings.homepage.newsletterEnabled) throw badRequest("Newsletter sign-up is not available right now.");
  const { email } = await readJson(req, schema, 1024);
  await enforceRateLimit(`newsletter:${getClientIp(req)}`, 5, 60 * 60);
  await connectDB();
  await Subscriber.updateOne(
    { email },
    { $set: { status: "subscribed", consentAt: new Date() }, $setOnInsert: { email, source: "homepage" } },
    { upsert: true },
  );
  // Same response whether or not the email already existed.
  return json({ ok: true });
});
