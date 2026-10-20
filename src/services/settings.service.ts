import "server-only";
import { cache } from "react";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getEnv } from "@/lib/env";
import { normalizePhone } from "@/lib/phone";
import { DEFAULT_SETTINGS, type StoreSettings } from "@/lib/settings-defaults";
import type { SettingsSection } from "@/lib/validation/settings";
import { Settings } from "@/models/Settings";
import { cached, TAGS } from "@/lib/cache";

const KEY = "store";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Deep-merges stored values over defaults; arrays are replaced, not merged. */
function merge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) return (override === undefined ? base : (override as T)) ?? base;
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(override)) {
    if (!(k in base)) continue; // ignore unknown/legacy keys
    const bv = (base as Record<string, unknown>)[k];
    out[k] = isPlainObject(bv) ? merge(bv, v) : v === undefined ? bv : v;
  }
  return out as T;
}

/** Fills in the default for every setting missing from `stored` (new settings, older saves). */
export function withDefaults(stored: unknown): StoreSettings {
  return merge(structuredClone(DEFAULT_SETTINGS), stored ?? {});
}

async function loadSettings(): Promise<StoreSettings> {
  await connectDB();
  const doc = await Settings.findOne({ key: KEY }).lean();
  return withDefaults(doc?.data);
}

// Settings change rarely: serve from the data cache (invalidated on every admin save).
const loadSettingsCached = cached(loadSettings, "store-settings", [TAGS.settings], 300);

/**
 * Cached across requests and memoised per render. Use getSettingsFresh for writes/checkout.
 * Defaults are merged in again after the cache: an entry cached before a new setting
 * existed (e.g. carried over from the previous deploy) still gets that setting's default.
 */
export const getSettings = cache(async () => withDefaults(await loadSettingsCached()));

/** Uncached read, used by background jobs and tests. */
export const getSettingsFresh = loadSettings;

export async function updateSettingsSection<S extends SettingsSection>(
  section: S,
  data: StoreSettings[S],
  adminId: string,
): Promise<StoreSettings> {
  await connectDB();
  await Settings.updateOne(
    { key: KEY },
    { $set: { [`data.${section}`]: data, updatedBy: new Types.ObjectId(adminId) }, $setOnInsert: { key: KEY } },
    { upsert: true },
  );
  return loadSettings();
}

/** WhatsApp recipients for owner alerts: admin-configured numbers, else WHATSAPP_OWNER_NUMBER. */
export function resolveOwnerRecipients(settings: StoreSettings): string[] {
  const configured = settings.notifications.ownerWhatsappNumbers.filter(Boolean);
  if (configured.length) return configured;
  const envNumber = getEnv().WHATSAPP_OWNER_NUMBER;
  const normalized = envNumber ? normalizePhone(envNumber) : null;
  return normalized ? [normalized] : [];
}

export function storeAddressLines(settings: StoreSettings): string[] {
  const a = settings.general.address;
  return [a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, a.country].filter(Boolean);
}
