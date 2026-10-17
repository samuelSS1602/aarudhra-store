import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { safeEqual } from "@/lib/security/crypto";
import { processDueNotifications } from "@/services/notifications.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Retry worker for queued/failed-retryable WhatsApp notifications.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: NextRequest) {
  const secret = getEnv().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await processDueNotifications(50);
  return NextResponse.json({ ok: true, ...result });
}
