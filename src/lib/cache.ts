import "server-only";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { logger } from "@/lib/logger";

/**
 * Data-cache tags. Storefront pages read rarely-changing data (settings, the
 * category list, homepage collections) from Next's data cache instead of hitting
 * MongoDB on every request. Every admin write or stock change invalidates the
 * relevant tag immediately, so customers never see stale prices or settings
 * for longer than one request. Product pages and listings stay fully live.
 */
export const TAGS = {
  settings: "settings",
  catalog: "catalog", // products, categories, stock-dependent collections
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

export function cached<Args extends unknown[], R>(fn: (...args: Args) => Promise<R>, key: string, tags: CacheTag[], revalidate: number) {
  // The Next.js data cache only exists inside a Next server; unit tests call through directly.
  if (process.env.VITEST) return fn;
  return unstable_cache(fn, [key], { tags, revalidate });
}

/** Invalidates cached storefront data after a write. Safe to call outside a request (no-op). */
export function invalidate(...tags: CacheTag[]) {
  try {
    for (const t of tags) revalidateTag(t);
    revalidatePath("/", "layout");
  } catch (err) {
    logger.warn("Cache invalidation skipped", { error: err instanceof Error ? err.message : String(err) });
  }
}
