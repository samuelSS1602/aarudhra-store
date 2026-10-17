import "server-only";
import { getEnv, isProduction } from "@/lib/env";
import { logger } from "@/lib/logger";

export class SmsProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public retryable = true,
  ) {
    super(message);
    this.name = "SmsProviderError";
  }
}

export interface OtpProvider {
  name: string;
  /** Managed providers generate and verify codes themselves (Twilio Verify). */
  managed: boolean;
  /** Sends the OTP. Must throw SmsProviderError when the provider did not accept the message. */
  send(phoneE164: string, code: string | null, ttlMinutes: number): Promise<void>;
  verify?(phoneE164: string, code: string): Promise<boolean>;
}

const TIMEOUT_MS = 10_000;

async function readBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 300) };
  }
}

/** MSG91 OTP API — https://docs.msg91.com/otp */
const msg91: OtpProvider = {
  name: "msg91",
  managed: false,
  async send(phone, code, ttlMinutes) {
    const env = getEnv();
    const url = new URL("https://control.msg91.com/api/v5/otp");
    url.searchParams.set("template_id", env.SMS_TEMPLATE_ID!);
    url.searchParams.set("mobile", phone.replace(/^\+/, ""));
    url.searchParams.set("otp", code!);
    url.searchParams.set("otp_expiry", String(ttlMinutes));
    if (env.SMS_SENDER_ID) url.searchParams.set("sender", env.SMS_SENDER_ID);
    const res = await fetch(url, {
      method: "POST",
      headers: { authkey: env.SMS_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
      body: "{}",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await readBody(res);
    if (!res.ok || body.type !== "success") {
      throw new SmsProviderError(`MSG91 rejected the request: ${String(body.message ?? res.status)}`, "msg91");
    }
  },
};

/** Fast2SMS — OTP route by default, DLT route when a sender ID + template ID are configured. */
const fast2sms: OtpProvider = {
  name: "fast2sms",
  managed: false,
  async send(phone, code) {
    const env = getEnv();
    if (!phone.startsWith("+91")) throw new SmsProviderError("Fast2SMS only supports Indian numbers", "fast2sms", false);
    const numbers = phone.slice(3);
    const payload =
      env.SMS_SENDER_ID && env.SMS_TEMPLATE_ID
        ? { route: "dlt", sender_id: env.SMS_SENDER_ID, message: env.SMS_TEMPLATE_ID, variables_values: code, numbers, flash: 0 }
        : { route: "otp", variables_values: code, numbers, flash: 0 };
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { authorization: env.SMS_API_KEY!, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await readBody(res);
    if (!res.ok || body.return !== true) {
      const msg = Array.isArray(body.message) ? body.message.join(", ") : String(body.message ?? res.status);
      throw new SmsProviderError(`Fast2SMS rejected the request: ${msg}`, "fast2sms");
    }
  },
};

function twilioAuth() {
  const env = getEnv();
  return "Basic " + Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64");
}

/** Twilio Verify — Twilio generates, delivers and checks the code. */
const twilio: OtpProvider = {
  name: "twilio",
  managed: true,
  async send(phone) {
    const env = getEnv();
    const res = await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/Verifications`, {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Channel: "sms" }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await readBody(res);
    if (!res.ok || (body.status !== "pending" && body.status !== "approved")) {
      throw new SmsProviderError(`Twilio Verify rejected the request: ${String(body.message ?? res.status)}`, "twilio");
    }
  },
  async verify(phone, code) {
    const env = getEnv();
    const res = await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SERVICE_SID}/VerificationCheck`, {
      method: "POST",
      headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: phone, Code: code }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 404) return false; // expired, already approved, or never created
    const body = await readBody(res);
    if (!res.ok) throw new SmsProviderError(`Twilio Verify check failed: ${String(body.message ?? res.status)}`, "twilio");
    return body.status === "approved";
  },
};

/**
 * Development-only provider: prints the OTP to the server console. Refuses to run
 * in production even if misconfigured (env validation also rejects it).
 */
const consoleProvider: OtpProvider = {
  name: "console",
  managed: false,
  async send(phone, code) {
    if (isProduction()) throw new SmsProviderError("Console SMS provider is disabled in production", "console", false);
    logger.warn("[DEV OTP] SMS not sent — development console provider in use", { phoneNumber: phone });
    // Deliberately bypasses the redacting logger: this is the developer's only way to see the code.
    console.warn(`\n  ┌──────────────────────────────────────────┐\n  │  DEV OTP for ${phone.padEnd(15)} → ${code}  │\n  └──────────────────────────────────────────┘\n`);
  },
};

const providers: Record<string, OtpProvider> = { msg91, fast2sms, twilio, console: consoleProvider };

let override: OtpProvider | null = null;
/** Tests only. */
export function setOtpProviderForTests(p: OtpProvider | null) {
  override = p;
}

export function getOtpProvider(): OtpProvider {
  if (override) return override;
  return providers[getEnv().SMS_PROVIDER]!;
}
