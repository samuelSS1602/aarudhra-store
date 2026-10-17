import "server-only";
import { after } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Runs work after the response is sent (Vercel keeps the function alive via
 * waitUntil). Falls back to fire-and-forget outside a request scope.
 */
export function runAfterResponse(task: () => Promise<unknown>) {
  const safe = () =>
    task().catch((err) => logger.error("Background task failed", { error: err instanceof Error ? err.message : String(err) }));
  try {
    after(safe);
  } catch {
    void safe();
  }
}
