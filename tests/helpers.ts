import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { Types } from "mongoose";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import type { CurrentCustomer } from "@/lib/auth/session";
import { createAdminSession } from "@/lib/auth/admin-session";
import { createCustomerSession } from "@/lib/auth/session";
import { ADMIN_COOKIE, CUSTOMER_COOKIE } from "@/lib/auth/cookies";
import { hashPassword } from "@/lib/security/crypto";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { AdminUser, type AdminRole } from "@/models/AdminUser";
import type { CheckoutInput } from "@/lib/validation/schemas";

export async function makeCategory(name = "Notebooks") {
  return Category.create({ name, slug: name.toLowerCase().replace(/\s+/g, "-") + "-" + randomUUID().slice(0, 6), status: "active" });
}

export async function makeProduct(over: Partial<{ name: string; price: number; originalPrice: number; stock: number; categoryId: Types.ObjectId; variants: { name: string; sku: string; stock: number; price?: number }[]; costPrice: number; gstRate: number; inclusive: boolean }> = {}) {
  const categoryId = over.categoryId ?? (await makeCategory())._id;
  const id = randomUUID().slice(0, 8);
  return Product.create({
    name: over.name ?? `Test product ${id}`,
    slug: `test-${id}`,
    sku: `SKU-${id}`.toUpperCase(),
    categoryId,
    price: over.price ?? 5000,
    originalPrice: over.originalPrice,
    costPrice: over.costPrice,
    stock: over.stock ?? 10,
    variants: over.variants ?? [],
    tax: { gstRate: over.gstRate ?? 18, inclusive: over.inclusive ?? true },
    status: "active",
  });
}

export async function makeCustomer(phone = "+919811100001"): Promise<CurrentCustomer & { _id: Types.ObjectId }> {
  const u = await User.create({ phoneNumber: phone, phoneVerified: true, name: "Test Customer" });
  return { _id: u._id, id: String(u._id), name: u.name!, phoneNumber: u.phoneNumber!, email: null, contactPhone: null, authProvider: "phone", accountStatus: "active" };
}

export async function makeAdmin(role: AdminRole = "owner", email = `${role}-${randomUUID().slice(0, 6)}@store.test`, password = "Correct-Horse-9-Battery"): Promise<CurrentAdmin> {
  const a = await AdminUser.create({ name: `Test ${role}`, email, role, passwordHash: await hashPassword(password) });
  return { id: String(a._id), name: a.name, email: a.email, role };
}

export async function customerCookie(userId: string) {
  const { token } = await createCustomerSession(userId, {});
  return `${CUSTOMER_COOKIE}=${token}`;
}

export async function adminCookie(adminId: string) {
  const { token } = await createAdminSession(adminId, {});
  return `${ADMIN_COOKIE}=${token}`;
}

export function request(url: string, opts: { method?: string; body?: unknown; cookie?: string; headers?: Record<string, string>; rawBody?: string } = {}) {
  const headers: Record<string, string> = { origin: "https://store.test", host: "store.test", "x-forwarded-for": "203.0.113.10", ...opts.headers };
  if (opts.cookie) headers.cookie = opts.cookie;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new NextRequest(new URL(url, "https://store.test"), {
    method: opts.method ?? (opts.body !== undefined || opts.rawBody !== undefined ? "POST" : "GET"),
    headers,
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
}

export const noParams = { params: Promise.resolve({}) } as { params: Promise<Record<string, string>> };
export const withId = (id: string) => ({ params: Promise.resolve({ id }) });

export function checkoutInput(items: { productId: string; variantId?: string | null; quantity: number }[], over: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: randomUUID(),
    items: items.map((i) => ({ ...i, variantId: i.variantId ?? null })),
    couponCode: null,
    deliveryOptionId: "standard",
    paymentMethod: "cod",
    customerName: "Test Customer",
    email: undefined,
    address: {
      fullName: "Test Customer",
      phone: "+919811100001",
      line1: "12 Main Road",
      line2: "",
      landmark: "Near bus stand",
      city: "Palani",
      district: "Dindigul",
      state: "Tamil Nadu",
      pincode: "624601",
    },
    instructions: "",
    saveAddress: false,
    whatsappOptIn: false,
    ...over,
  };
}
