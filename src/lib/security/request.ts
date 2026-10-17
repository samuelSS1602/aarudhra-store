import "server-only";
import type { NextRequest } from "next/server";

/**
 * Best-effort client IP. On Vercel `x-forwarded-for` is set by the platform edge,
 * and the left-most entry is the client address.
 */
export function getClientIp(req: Request | NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim().slice(0, 64);
  return (req.headers.get("x-real-ip") ?? "unknown").slice(0, 64);
}

export function getUserAgent(req: Request | NextRequest): string {
  return (req.headers.get("user-agent") ?? "").slice(0, 300);
}
