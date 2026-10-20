import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** All monetary values are stored as integer paise (₹1 = 100 paise). */
export const toPaise = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paise: number) => paise / 100;

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatINR(paise: number | null | undefined): string {
  return inrFormatter.format(toRupees(paise ?? 0));
}

/** Plain amount without symbol, always two decimals — used in WhatsApp messages ("₹{{amount}}"). */
export function formatAmount(paise: number): string {
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(toRupees(paise));
}

export function discountPercent(price: number, originalPrice?: number | null): number {
  if (!originalPrice || originalPrice <= price) return 0;
  return Math.round(((originalPrice - price) / originalPrice) * 100);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

const IST = "Asia/Kolkata";

export function formatDate(d: Date | string | number, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: IST, ...opts }).format(new Date(d));
}

export function formatDateTime(d: Date | string | number): string {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: IST }).format(
    new Date(d),
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Masks a phone number for display in low-privilege contexts: +91 98•••••210 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 5)}${"•".repeat(Math.max(0, phone.length - 8))}${phone.slice(-3)}`;
}

/** wa.me links need digits only. */
/** JPEG URL for a stored photo. WhatsApp previews and image messages accept only JPEG/PNG. */
export function jpegImageUrl(url: string): string {
  return url.replace(/^(.*\/media\/[a-f0-9]{24})\.webp$/i, "$1.jpg");
}

export function whatsappLink(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Escapes user input for safe use inside a MongoDB $regex (prevents ReDoS / pattern injection). */
export function escapeRegex(s: string): string {
  return s.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
