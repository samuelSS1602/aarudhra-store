import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export const DEFAULT_COUNTRY: CountryCode = "IN";

/**
 * Normalizes user-entered phone numbers to E.164 (e.g. "+919876543210").
 * Indian (+91) numbers are the default; other countries are accepted when entered
 * with an explicit "+<country code>" prefix, keeping the logic extensible.
 * Returns null for anything that is not a plausible mobile number.
 */
export function normalizePhone(input: string, country: CountryCode = DEFAULT_COUNTRY): string | null {
  const raw = (input ?? "").trim().replace(/[\s\-().]/g, "");
  if (!raw || raw.length > 20) return null;
  const parsed = parsePhoneNumberFromString(raw, country);
  if (!parsed || !parsed.isValid()) return null;
  // Indian mobile numbers are 10 digits starting with 6–9 (landlines can't receive OTP SMS).
  if (parsed.country === "IN" && !/^[6-9]\d{9}$/.test(parsed.nationalNumber)) return null;
  return parsed.number;
}

export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
