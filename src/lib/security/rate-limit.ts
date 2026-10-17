import "server-only";
import { connectDB } from "@/lib/mongodb";
import { tooManyRequests } from "@/lib/errors";
import { RateLimit } from "@/models/misc";

/**
 * Fixed-window rate limiter backed by MongoDB, so limits hold across serverless
 * instances (in-memory counters would reset on every cold start).
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number) {
  await connectDB();
  const now = Date.now();
  const windowStart = Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000;
  const windowKey = `${key}:${windowStart}`;
  const expiresAt = new Date(windowStart + windowSeconds * 1000);

  const bump = () =>
    RateLimit.findOneAndUpdate(
      { key: windowKey },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
      { upsert: true, new: true, lean: true },
    );

  let doc;
  try {
    doc = await bump();
  } catch (err) {
    // Two concurrent upserts can race on the unique index; the retry hits the existing doc.
    if ((err as { code?: number }).code === 11000) doc = await bump();
    else throw err;
  }
  const count = doc?.count ?? 1;
  const retryAfter = Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000));
  return { ok: count <= limit, remaining: Math.max(0, limit - count), retryAfter };
}

export async function enforceRateLimit(key: string, limit: number, windowSeconds: number, message?: string) {
  const r = await hitRateLimit(key, limit, windowSeconds);
  if (!r.ok) throw tooManyRequests(message ?? "Too many requests. Please wait a moment and try again.", r.retryAfter);
  return r;
}
