import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { couponInputSchema } from "@/lib/validation/schemas";
import { createCoupon } from "@/services/coupons.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "coupons:write");
  const input = await readJson(req, couponInputSchema, 4096);
  const coupon = await createCoupon(input, admin);
  return json({ coupon: { id: String(coupon._id), code: coupon.code } }, { status: 201 });
});
