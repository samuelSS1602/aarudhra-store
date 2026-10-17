import { z } from "zod";
import {
  imageSchema,
  objectId,
  optionalEmail,
  optionalRupeesToPaise,
  phoneSchema,
  pincodeSchema,
  requiredText,
  rupeesToPaise,
  slugSchema,
  trimmed,
} from "./common";
import { ORDER_STATUSES } from "@/lib/constants";

/* --------------------------------- Auth --------------------------------- */

export const otpRequestSchema = z.object({ phone: z.string().trim().min(1, "Mobile number is required").max(20) });
export const otpVerifySchema = z.object({
  phone: z.string().trim().min(1).max(20),
  code: z.string().trim().regex(/^\d{4,8}$/, "Enter the 6-digit code"),
});
export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(200),
  password: z.string().min(1, "Password is required").max(200),
});

/* ------------------------------- Customer ------------------------------- */

export const addressSchema = z.object({
  label: trimmed(40).optional().default("Home"),
  fullName: requiredText("Full name", 100),
  phone: phoneSchema,
  line1: requiredText("Address", 200),
  line2: trimmed(200).optional().default(""),
  landmark: trimmed(120).optional().default(""),
  city: requiredText("Town / city", 80),
  district: requiredText("District", 80),
  state: requiredText("State", 80),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional().default(false),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const profileSchema = z.object({
  name: requiredText("Name", 100),
  email: optionalEmail,
  contactPhone: z.union([z.literal(""), phoneSchema]).optional(),
  preferences: z
    .object({
      whatsappOrderUpdates: z.boolean().optional(),
      marketingOptIn: z.boolean().optional(),
    })
    .optional(),
});

/* --------------------------------- Cart --------------------------------- */

export const cartItemSchema = z.object({
  productId: objectId,
  variantId: objectId.optional().nullable(),
  quantity: z.coerce.number().int().min(1).max(99),
});
export const cartSchema = z.object({
  items: z.array(cartItemSchema).max(100),
  couponCode: trimmed(32).optional().nullable(),
});
export const quoteSchema = cartSchema.extend({
  deliveryOptionId: trimmed(40).optional().nullable(),
});

/* ------------------------------- Checkout ------------------------------- */

export const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid("Invalid checkout token"),
  items: z.array(cartItemSchema).min(1, "Your cart is empty").max(100),
  couponCode: trimmed(32).optional().nullable(),
  deliveryOptionId: requiredText("Delivery option", 40),
  paymentMethod: z.enum(["cod", "online"]),
  customerName: requiredText("Name", 100),
  email: optionalEmail,
  address: addressSchema.omit({ isDefault: true, label: true }),
  instructions: trimmed(300).optional().default(""),
  saveAddress: z.boolean().optional().default(false),
  whatsappOptIn: z.boolean().optional().default(false),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/* -------------------------------- Products ------------------------------- */

const variantInput = z.object({
  _id: objectId.optional(),
  name: requiredText("Variant name", 120),
  sku: requiredText("Variant SKU", 64).transform((s) => s.toUpperCase()),
  options: z.array(z.object({ name: trimmed(40), value: trimmed(60) })).max(5).default([]),
  price: optionalRupeesToPaise,
  originalPrice: optionalRupeesToPaise,
  stock: z.coerce.number().int().min(0, "Stock cannot be negative").max(1_000_000).default(0),
  barcode: trimmed(64).optional(),
  status: z.enum(["active", "inactive"]).default("active"),
});

const optionalPositive = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0).max(1_000_000)])
  .transform((v) => (typeof v === "number" ? v : undefined));

export const productInputSchema = z
  .object({
    name: requiredText("Product name", 160),
    slug: slugSchema.optional().or(z.literal("")),
    sku: requiredText("SKU", 64).transform((s) => s.toUpperCase()),
    description: trimmed(5000).default(""),
    categoryId: objectId,
    brand: trimmed(80).default(""),
    images: z.array(imageSchema).max(10).default([]),
    price: rupeesToPaise,
    originalPrice: optionalRupeesToPaise,
    costPrice: optionalRupeesToPaise,
    tax: z
      .object({
        gstRate: z.coerce.number().refine((v) => [0, 5, 12, 18, 28].includes(v), "Invalid GST rate"),
        inclusive: z.boolean().default(true),
        hsnCode: trimmed(12).default(""),
      })
      .default({ gstRate: 18, inclusive: true, hsnCode: "" }),
    stock: z.coerce.number().int().min(0, "Stock cannot be negative").max(1_000_000).default(0),
    lowStockThreshold: z.coerce.number().int().min(0).max(100_000).default(5),
    variants: z.array(variantInput).max(50).default([]),
    barcode: trimmed(64).optional(),
    weightGrams: optionalPositive,
    dimensions: z
      .object({ lengthCm: optionalPositive, widthCm: optionalPositive, heightCm: optionalPositive })
      .optional(),
    specifications: z.array(z.object({ label: requiredText("Label", 60), value: requiredText("Value", 200) })).max(30).default([]),
    tags: z.array(trimmed(40)).max(20).default([]),
    featured: z.boolean().default(false),
    status: z.enum(["active", "draft", "archived"]).default("active"),
    seo: z.object({ title: trimmed(70).default(""), description: trimmed(170).default("") }).default({}),
  })
  .superRefine((p, ctx) => {
    if (p.originalPrice !== undefined && p.originalPrice > 0 && p.originalPrice < p.price) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["originalPrice"], message: "Original price must be at least the selling price" });
    }
    if (p.price <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["price"], message: "Selling price must be greater than zero" });
    const skus = new Set<string>([p.sku]);
    p.variants.forEach((v, i) => {
      if (skus.has(v.sku)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["variants", i, "sku"], message: "SKU must be unique" });
      skus.add(v.sku);
    });
  });
export type ProductInput = z.infer<typeof productInputSchema>;

export const productListQuery = z.object({
  q: trimmed(100).optional(),
  category: trimmed(120).optional(),
  brand: trimmed(400).optional(), // comma separated
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  availability: z.enum(["in_stock", "all"]).optional(),
  onSale: z.enum(["1", "true"]).optional(),
  sort: z.enum(["relevance", "newest", "price_asc", "price_desc", "popular", "discount"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(48).default(24),
});
export type ProductListQuery = z.infer<typeof productListQuery>;

/* ------------------------------- Categories ------------------------------ */

export const categoryInputSchema = z.object({
  name: requiredText("Category name", 80),
  slug: slugSchema.optional().or(z.literal("")),
  description: trimmed(500).default(""),
  image: imageSchema.nullable().optional(),
  icon: trimmed(40).default(""),
  displayOrder: z.coerce.number().int().min(0).max(10_000).default(0),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const categoryDeleteSchema = z.object({ reassignTo: objectId.optional() });
export const categoryReorderSchema = z.object({ ids: z.array(objectId).min(1).max(500) });

/* ------------------------------- Inventory ------------------------------- */

export const inventoryAdjustSchema = z.object({
  productId: objectId,
  variantId: objectId.optional().nullable(),
  adjustmentType: z.enum(["restock", "adjustment", "damage", "correction", "return"]),
  quantityChange: z.coerce
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((v) => v !== 0, "Quantity change cannot be zero"),
  reason: requiredText("Reason", 300),
});

/* --------------------------------- Orders -------------------------------- */

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: trimmed(500).optional(),
  override: z.boolean().optional().default(false),
  refundAmount: optionalRupeesToPaise,
  refundReference: trimmed(120).optional(),
  markPaid: z.boolean().optional(),
});
export const orderNoteSchema = z.object({ note: requiredText("Note", 2000) });
export const customerCancelSchema = z.object({ reason: trimmed(300).optional().default("") });

/* -------------------------------- Coupons -------------------------------- */

const optionalDate = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.date()])
  .transform((v) => (v instanceof Date && !isNaN(v.getTime()) ? v : undefined));
const optionalInt = z
  .union([z.literal(""), z.null(), z.undefined(), z.coerce.number().int().min(0).max(10_000_000)])
  .transform((v) => (typeof v === "number" ? v : undefined));

export const couponInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,32}$/, "Use 3–32 letters, numbers, - or _"),
    description: trimmed(200).default(""),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.coerce.number().min(0).max(10_000_000),
    minimumOrderValue: optionalRupeesToPaise,
    maximumDiscount: optionalRupeesToPaise,
    startDate: optionalDate,
    expiryDate: optionalDate,
    usageLimit: optionalInt,
    perCustomerLimit: optionalInt,
    status: z.enum(["active", "inactive"]).default("active"),
  })
  .superRefine((c, ctx) => {
    if (c.discountType === "percent" && (c.discountValue <= 0 || c.discountValue > 100)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage must be between 1 and 100" });
    }
    if (c.discountType === "fixed" && c.discountValue <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Discount must be greater than zero" });
    }
    if (c.startDate && c.expiryDate && c.expiryDate <= c.startDate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiryDate"], message: "Expiry must be after the start date" });
    }
  })
  // Fixed discounts are entered in rupees.
  .transform((c) => ({ ...c, discountValue: c.discountType === "fixed" ? Math.round(c.discountValue * 100) : Math.round(c.discountValue) }));

/* ------------------------------ Admin users ------------------------------ */

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(200)
  .refine((p) => /[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p), "Include upper- and lower-case letters and a number");

export const adminCreateSchema = z.object({
  name: requiredText("Name", 100),
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["owner", "admin", "manager", "staff"]),
  password: passwordSchema,
});
export const adminUpdateSchema = z.object({
  role: z.enum(["owner", "admin", "manager", "staff"]).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  password: passwordSchema.optional(),
});

export const customerAdminUpdateSchema = z.object({
  name: trimmed(100).optional(),
  email: optionalEmail,
  accountStatus: z.enum(["active", "suspended"]).optional(),
});
