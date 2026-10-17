import { requireAdminPage } from "@/lib/auth/admin-page";
import { listCoupons } from "@/services/coupons.service";
import { PageHeader } from "@/components/admin/ui";
import { CouponManager, type CouponRow } from "@/components/admin/coupon-manager";

export const metadata = { title: "Coupons" };

export default async function CouponsPage() {
  await requireAdminPage("coupons:write");
  const coupons = await listCoupons();
  const rows: CouponRow[] = coupons.map((c) => ({
    id: String(c._id),
    code: c.code,
    description: c.description ?? "",
    discountType: c.discountType as "percent" | "fixed",
    discountValue: c.discountValue,
    minimumOrderValue: c.minimumOrderValue ?? 0,
    maximumDiscount: c.maximumDiscount ?? null,
    startDate: c.startDate ? new Date(c.startDate).toISOString() : null,
    expiryDate: c.expiryDate ? new Date(c.expiryDate).toISOString() : null,
    usageLimit: c.usageLimit ?? null,
    usedCount: c.usedCount ?? 0,
    perCustomerLimit: c.perCustomerLimit ?? null,
    status: c.status as "active" | "inactive",
  }));
  return (
    <div>
      <PageHeader title="Coupons & discounts" description="Coupon codes are validated on the server at checkout — limits and dates are enforced automatically." />
      <CouponManager initial={rows} />
    </div>
  );
}
