import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { safeEqual } from "@/lib/security/crypto";
import { verifyWebhookSignature } from "@/lib/whatsapp/client";
import { handleWhatsAppWebhook } from "@/services/notifications.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 512 * 1024;

/** Meta's one-time subscription verification handshake. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = getEnv().WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const token = p.get("hub.verify_token") ?? "";
  if (p.get("hub.mode") === "subscribe" && expected && safeEqual(token, expected)) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

/** Delivery-status callbacks. The raw body must be HMAC-verified before parsing. */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) return new NextResponse("Payload too large", { status: 413 });
  const valid = verifyWebhookSignature(raw, req.headers.get("x-hub-signature-256"), getEnv().WHATSAPP_APP_SECRET);
  if (!valid) {
    logger.warn("Rejected WhatsApp webhook with invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }
  try {
    await handleWhatsAppWebhook(payload);
  } catch (err) {
    logger.error("WhatsApp webhook processing failed", { error: err instanceof Error ? err.message : String(err) });
    // 500 makes Meta retry; processing is idempotent so retries are safe.
    return new NextResponse("Error", { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
