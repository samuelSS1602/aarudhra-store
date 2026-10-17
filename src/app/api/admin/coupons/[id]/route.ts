import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { couponInputSchema } from "@/lib/validation/schemas";
import { deleteCoupon, updateCoupon } from "@/services/coupons.service";

export const runtime = "nodejs";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "coupons:write");
  const id = await idParam(params, "Coupon");
  const input = await readJson(req, couponInputSchema, 4096);
  await updateCoupon(id, input, admin);
  return json({ ok: true });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "coupons:write");
  return json(await deleteCoupon(await idParam(params, "Coupon"), admin));
});
