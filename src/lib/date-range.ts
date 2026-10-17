/** Date ranges in India Standard Time (UTC+05:30, no DST). */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const RANGE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "custom", label: "Custom" },
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number]["id"];

/** Start of the IST calendar day containing `d`, as a UTC Date. */
export function istStartOfDay(d: Date): Date {
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - IST_OFFSET_MS);
}

/** Parses "YYYY-MM-DD" as an IST calendar date. */
function parseIstDate(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00+05:30`);
  return isNaN(d.getTime()) ? null : d;
}

export function resolveRange(preset: string | undefined, fromStr?: string, toStr?: string) {
  const now = new Date();
  const today = istStartOfDay(now);
  const day = 24 * 60 * 60 * 1000;
  switch (preset) {
    case "today":
      return { preset: "today" as const, from: today, to: now };
    case "yesterday":
      return { preset: "yesterday" as const, from: new Date(today.getTime() - day), to: new Date(today.getTime() - 1) };
    case "7d":
      return { preset: "7d" as const, from: new Date(today.getTime() - 6 * day), to: now };
    case "custom": {
      const from = parseIstDate(fromStr);
      const toStart = parseIstDate(toStr);
      if (from && toStart && toStart >= from && toStart.getTime() - from.getTime() <= 366 * day) {
        return { preset: "custom" as const, from, to: new Date(toStart.getTime() + day - 1) };
      }
      return { preset: "30d" as const, from: new Date(today.getTime() - 29 * day), to: now };
    }
    case "30d":
    default:
      return { preset: "30d" as const, from: new Date(today.getTime() - 29 * day), to: now };
  }
}

export function toIstDateInput(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}
