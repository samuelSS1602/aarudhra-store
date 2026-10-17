import "server-only";
import { Types, type ClientSession } from "mongoose";
import type { z } from "zod";
import { connectDB } from "@/lib/mongodb";
import { conflict, notFound } from "@/lib/errors";
import { formatINR } from "@/lib/utils";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import type { couponInputSchema } from "@/lib/validation/schemas";
import { Coupon, type CouponDoc } from "@/models/Coupon";
import { Order } from "@/models/Order";
import { audit } from "./audit.service";

export type CouponEvaluation =
  | { ok: true; coupon: CouponDoc; discountAmount: number }
  | { ok: false; error: string };

export function computeCouponDiscount(coupon: Pick<CouponDoc, "discountType" | "discountValue" | "maximumDiscount">, subtotal: number) {
  let amount =
    coupon.discountType === "percent" ? Math.floor((subtotal * coupon.discountValue) / 100) : Math.round(coupon.discountValue);
  if (coupon.discountType === "percent" && coupon.maximumDiscount) amount = Math.min(amount, coupon.maximumDiscount);
  return Math.max(0, Math.min(amount, subtotal));
}

/** Validates a coupon against current database state. Never trusts client-side discount values. */
export async function evaluateCoupon(
  rawCode: string,
  subtotal: number,
  userId: string | null,
  session: ClientSession | null = null,
): Promise<CouponEvaluation> {
  await connectDB();
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) return { ok: false, error: "This coupon code is not valid." };
  const coupon = await Coupon.findOne({ code }).session(session).lean();
  const now = new Date();
  if (!coupon || coupon.status !== "active") return { ok: false, error: "This coupon code is not valid." };
  if (coupon.startDate && coupon.startDate > now) return { ok: false, error: "This coupon is not active yet." };
  if (coupon.expiryDate && coupon.expiryDate < now) return { ok: false, error: "This coupon has expired." };
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return { ok: false, error: "This coupon has reached its usage limit." };
  if (coupon.minimumOrderValue && subtotal < coupon.minimumOrderValue) {
    return { ok: false, error: `Add items worth ${formatINR(coupon.minimumOrderValue - subtotal)} more to use this coupon.` };
  }
  if (coupon.perCustomerLimit && userId) {
    const used = await Order.countDocuments({
      userId: new Types.ObjectId(userId),
      "couponSnapshot.code": code,
      orderStatus: { $nin: ["cancelled"] },
    }).session(session);
    if (used >= coupon.perCustomerLimit) return { ok: false, error: "You have already used this coupon." };
  }
  const discountAmount = computeCouponDiscount(coupon, subtotal);
  if (discountAmount <= 0) return { ok: false, error: "This coupon doesn't apply to your cart." };
  return { ok: true, coupon, discountAmount };
}

/** Atomically consumes one redemption, respecting the global usage limit. */
export async function redeemCoupon(couponId: Types.ObjectId, session: ClientSession | null) {
  const res = await Coupon.updateOne(
    {
      _id: couponId,
      status: "active",
      $or: [{ usageLimit: { $exists: false } }, { usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }],
    },
    { $inc: { usedCount: 1 } },
    { session: session ?? undefined },
  );
  return res.modifiedCount === 1;
}

export async function releaseCoupon(code: string, session: ClientSession | null) {
  await Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }, { session: session ?? undefined });
}

/* ---------------------------------- Admin --------------------------------- */

type CouponInput = z.infer<typeof couponInputSchema>;

export async function listCoupons() {
  await connectDB();
  return Coupon.find().sort({ createdAt: -1 }).limit(500).lean();
}

export async function createCoupon(input: CouponInput, admin: CurrentAdmin) {
  await connectDB();
  if (await Coupon.exists({ code: input.code })) throw conflict("A coupon with this code already exists.", { field: "code" });
  const c = await Coupon.create(input);
  await audit(admin, "coupon.create", "coupon", c._id, { code: c.code, type: c.discountType, value: c.discountValue });
  return c.toObject();
}

export async function updateCoupon(id: string, input: CouponInput, admin: CurrentAdmin) {
  await connectDB();
  const c = await Coupon.findById(id);
  if (!c) throw notFound("Coupon not found.");
  if (input.code !== c.code && (await Coupon.exists({ code: input.code }))) throw conflict("A coupon with this code already exists.", { field: "code" });
  const unset: Record<string, 1> = {};
  for (const k of ["minimumOrderValue", "maximumDiscount", "startDate", "expiryDate", "usageLimit", "perCustomerLimit"] as const) {
    if (input[k] === undefined) unset[k] = 1;
  }
  await Coupon.updateOne({ _id: c._id }, { $set: input, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  await audit(admin, "coupon.update", "coupon", c._id, { code: input.code, status: input.status });
  return Coupon.findById(id).lean();
}

export async function deleteCoupon(id: string, admin: CurrentAdmin) {
  await connectDB();
  const c = await Coupon.findById(id).lean();
  if (!c) throw notFound("Coupon not found.");
  if (c.usedCount > 0) {
    // Keep history intact for redeemed coupons; deactivate instead.
    await Coupon.updateOne({ _id: c._id }, { $set: { status: "inactive" } });
    await audit(admin, "coupon.deactivate", "coupon", c._id, { code: c.code });
    return { deactivated: true };
  }
  await Coupon.deleteOne({ _id: c._id });
  await audit(admin, "coupon.delete", "coupon", c._id, { code: c.code });
  return { deleted: true };
}
