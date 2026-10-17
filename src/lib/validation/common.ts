import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");

export const trimmed = (max: number) => z.string().trim().max(max);
export const requiredText = (label: string, max: number) =>
  z.string({ required_error: `${label} is required` }).trim().min(1, `${label} is required`).max(max, `${label} is too long`);

/** Rupee amount entered by a person → stored as integer paise. */
export const rupeesToPaise = z.coerce
  .number({ invalid_type_error: "Enter a valid amount" })
  .min(0, "Amount cannot be negative")
  .max(10_000_000, "Amount is too large")
  .transform((v) => Math.round(v * 100));

export const optionalRupeesToPaise = z
  .union([z.literal(""), z.null(), z.undefined(), rupeesToPaise])
  .transform((v) => (typeof v === "number" ? v : undefined));

export const phoneSchema = z
  .string({ required_error: "Mobile number is required" })
  .trim()
  .max(20)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
      return z.NEVER;
    }
    return n;
  });

export const pincodeSchema = z
  .string({ required_error: "PIN code is required" })
  .trim()
  .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code");

export const optionalEmail = z
  .union([z.literal(""), z.string().trim().toLowerCase().email("Enter a valid email address").max(200)])
  .optional()
  .transform((v) => (v ? v : undefined));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
  .max(120);

export const pageQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};

export const imageSchema = z.object({
  url: z
    .string()
    .url()
    .max(1000)
    .refine((u) => u.startsWith("https://res.cloudinary.com/") || u.startsWith("/"), "Images must be uploaded to the store's image storage"),
  publicId: trimmed(300).optional(),
  alt: trimmed(200).optional().default(""),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
