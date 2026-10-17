import { z } from "zod";
import { normalizePhone } from "@/lib/phone";
import { ORDER_STATUSES } from "@/lib/constants";

const t = (max: number) => z.string().trim().max(max);
const paise = z.coerce.number().int().min(0).max(1_000_000_000);
const optionalUrl = z.union([z.literal(""), z.string().trim().url().max(500)]);
/** Uploaded image: a Cloudinary/HTTPS URL or a photo stored in MongoDB (/media/<id>.webp). */
const imageUrl = z.union([z.literal(""), z.string().trim().url().max(1000), z.string().trim().regex(/^\/media\/[a-f0-9]{24}\.webp$/i)]);
const internalHref = z
  .string()
  .trim()
  .max(300)
  .refine((v) => v === "" || v.startsWith("/") || v.startsWith("https://"), "Use a site path like /products or an https:// link");
const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .transform((v, ctx) => {
    if (!v) return "";
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid phone number" });
      return z.NEVER;
    }
    return n;
  });

export const generalSettingsSchema = z.object({
  storeName: t(80).min(1, "Store name is required"),
  tagline: t(120),
  logoUrl: imageUrl,
  description: t(600),
  address: z.object({
    line1: t(200).min(1),
    line2: t(200),
    city: t(80).min(1),
    district: t(80),
    state: t(80).min(1),
    pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, "Enter a valid PIN code"),
    country: t(60),
  }),
  supportPhone: optionalPhone,
  whatsappNumber: optionalPhone,
  storeHours: t(200),
  contactEmail: z.union([z.literal(""), z.string().trim().toLowerCase().email().max(200)]),
  social: z.object({ facebook: optionalUrl, instagram: optionalUrl, youtube: optionalUrl }),
  mapQuery: t(300),
});

export const commerceSettingsSchema = z.object({
  currency: z.literal("INR"),
  taxMode: z.enum(["inclusive", "exclusive"]),
  defaultGstRate: z.coerce.number().refine((v) => [0, 5, 12, 18, 28].includes(v)),
  deliveryOptions: z
    .array(
      z.object({
        id: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Use lowercase letters, numbers and hyphens"),
        label: t(60).min(1),
        description: t(160),
        charge: paise,
        etaText: t(80),
        enabled: z.boolean(),
      }),
    )
    .min(1, "Add at least one delivery option")
    .max(10),
  freeDeliveryThreshold: paise,
  minimumOrderValue: paise,
  codEnabled: z.boolean(),
  codMaxOrderValue: paise,
  lowStockThreshold: z.coerce.number().int().min(0).max(100_000),
  returnPolicy: t(3000),
  cancellationPolicy: t(3000),
  deliveryPolicy: t(3000),
  customerCancellableStatuses: z.array(z.enum(["pending", "confirmed", "processing"])).max(3),
});

export const notificationSettingsSchema = z.object({
  ownerWhatsappNumbers: z
    .array(optionalPhone)
    .max(5)
    .transform((list) => Array.from(new Set(list.filter(Boolean)))),
  ownerNewOrder: z.boolean(),
  customerOrderConfirmation: z.boolean(),
  customerStatusUpdates: z.boolean(),
  statusUpdateEvents: z.array(z.enum(ORDER_STATUSES)).max(10),
  ownerTemplateName: z.string().trim().regex(/^[a-z0-9_]{0,512}$/, "Template names use lowercase letters, numbers and _"),
  customerTemplateName: z.string().trim().regex(/^[a-z0-9_]{0,512}$/, "Template names use lowercase letters, numbers and _"),
  statusTemplateName: z.string().trim().regex(/^[a-z0-9_]{0,512}$/, "Template names use lowercase letters, numbers and _"),
  templateLanguage: z.string().trim().regex(/^([a-z]{2,3}(_[A-Z]{2})?)?$/, "Use a language code like en or en_US"),
  ownerMessageMode: z.enum(["template", "text"]),
  maxAttempts: z.coerce.number().int().min(1).max(10),
  retryBaseMinutes: z.coerce.number().int().min(1).max(120),
});

export const homepageSettingsSchema = z.object({
  announcement: z.object({ enabled: z.boolean(), text: t(160), href: internalHref }),
  hero: z.object({
    eyebrow: t(60),
    title: t(120).min(1),
    subtitle: t(300),
    ctaLabel: t(40),
    ctaHref: internalHref,
    secondaryCtaLabel: t(40),
    secondaryCtaHref: internalHref,
    imageUrl: imageUrl,
  }),
  banners: z
    .array(
      z.object({
        title: t(80).min(1),
        subtitle: t(160),
        href: internalHref,
        imageUrl: imageUrl,
        tone: z.enum(["green", "gold", "charcoal", "lime"]),
      }),
    )
    .max(6),
  featuredCategoryIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(12),
  featuredProductIds: z.array(z.string().regex(/^[a-f0-9]{24}$/i)).max(24),
  highlights: z.array(z.object({ icon: t(40), title: t(60).min(1), text: t(200) })).max(8),
  newsletterEnabled: z.boolean(),
});

export const settingsSectionSchemas = {
  general: generalSettingsSchema,
  commerce: commerceSettingsSchema,
  notifications: notificationSettingsSchema,
  homepage: homepageSettingsSchema,
} as const;

export type SettingsSection = keyof typeof settingsSectionSchemas;

export const settingsUpdateSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("general"), data: generalSettingsSchema }),
  z.object({ section: z.literal("commerce"), data: commerceSettingsSchema }),
  z.object({ section: z.literal("notifications"), data: notificationSettingsSchema }),
  z.object({ section: z.literal("homepage"), data: homepageSettingsSchema }),
]);
