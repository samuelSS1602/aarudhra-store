import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Official WhatsApp Business Platform (Cloud API) client.
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/messages
 */

export class WhatsAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public httpStatus?: number,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

export type SendResult = { messageId: string; waId?: string };

// Meta error codes that are worth retrying automatically.
const RETRYABLE_CODES = new Set([1, 2, 4, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

/** Template parameters may not contain newlines, tabs or more than 4 consecutive spaces. */
export function sanitizeTemplateParam(value: string, max = 900): string {
  const clean = value
    .replace(/[ ]*[\r\n\t]+[ ]*/g, " | ")
    .replace(/ {4,}/g, "   ")
    .replace(/\s*\|\s*(\|\s*)+/g, " | ")
    .trim();
  const text = clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  return text || "-";
}

/** Cloud API expects the recipient as digits with country code, no "+". */
export const toWaRecipient = (e164: string) => e164.replace(/\D/g, "");

let fetchImpl: typeof fetch = (...args) => fetch(...args);
/** Tests only. */
export function setWhatsAppFetchForTests(f: typeof fetch | null) {
  fetchImpl = f ?? ((...args) => fetch(...args));
}

async function post(payload: Record<string, unknown>): Promise<SendResult> {
  const env = getEnv();
  if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
    throw new WhatsAppError("WhatsApp Cloud API credentials are not configured", "NOT_CONFIGURED", false);
  }
  const url = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new WhatsAppError(`Network error contacting WhatsApp: ${err instanceof Error ? err.message : String(err)}`, "NETWORK", true);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok) {
    const e = (body.error ?? {}) as { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } };
    const code = e.code ?? res.status;
    const retryable = res.status >= 500 || res.status === 429 || RETRYABLE_CODES.has(Number(code));
    const detail = e.error_data?.details ? ` (${e.error_data.details})` : "";
    throw new WhatsAppError(`${e.message ?? `HTTP ${res.status}`}${detail}`.slice(0, 500), String(code), retryable, res.status);
  }

  const messages = body.messages as { id?: string }[] | undefined;
  const contacts = body.contacts as { wa_id?: string }[] | undefined;
  const messageId = messages?.[0]?.id;
  if (!messageId) throw new WhatsAppError("WhatsApp API response did not include a message id", "NO_MESSAGE_ID", true, res.status);
  return { messageId, waId: contacts?.[0]?.wa_id };
}

export function sendTemplateMessage(opts: { to: string; templateName: string; language: string; bodyParams: string[] }) {
  return post({
    to: toWaRecipient(opts.to),
    type: "template",
    template: {
      name: opts.templateName,
      language: { code: opts.language },
      components: opts.bodyParams.length
        ? [{ type: "body", parameters: opts.bodyParams.map((p) => ({ type: "text", text: sanitizeTemplateParam(p) })) }]
        : [],
    },
  });
}

/**
 * Free-form text. Only deliverable inside the 24-hour customer-service window
 * (i.e. the recipient messaged the business number in the last 24h). Used for the
 * owner alert when `ownerMessageMode` is "text".
 */
export function sendTextMessage(opts: { to: string; body: string }) {
  return post({ to: toWaRecipient(opts.to), type: "text", text: { preview_url: false, body: opts.body.slice(0, 4096) } });
}

/** Photo with a caption. `link` must be a public HTTPS JPEG/PNG URL. Same 24-hour window rule as text. */
export function sendImageMessage(opts: { to: string; link: string; caption?: string }) {
  return post({ to: toWaRecipient(opts.to), type: "image", image: { link: opts.link, ...(opts.caption ? { caption: opts.caption.slice(0, 1024) } : {}) } });
}

/** Verifies Meta's X-Hub-Signature-256 header (HMAC-SHA256 of the raw body with the app secret). */
export function verifyWebhookSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header || !header.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const given = header.slice("sha256=".length);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(expected, "hex"));
}
