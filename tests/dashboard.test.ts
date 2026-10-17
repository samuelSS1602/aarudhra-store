import { describe, expect, it } from "vitest";
import { createOrder, updateOrderStatusAsAdmin } from "@/services/orders.service";
import { getDashboardMetrics } from "@/services/analytics.service";
import { getCustomerForAdmin, listCustomers, updateCustomerAsAdmin } from "@/services/customers.service";
import { getCustomerFromToken, createCustomerSession } from "@/lib/auth/session";
import { AuditLog } from "@/models/misc";
import { checkoutInput, makeAdmin, makeCustomer, makeProduct } from "./helpers";

const range = () => ({ from: new Date(Date.now() - 24 * 3600 * 1000), to: new Date(Date.now() + 60_000) });

describe("Dashboard metrics come from real records", () => {
  it("returns zeros with no data (nothing fabricated)", async () => {
    const m = await getDashboardMetrics(range());
    expect(m.totals).toMatchObject({ grossOrderValue: 0, realizedRevenue: 0, orders: 0 });
    expect(m.bestSellers).toHaveLength(0);
    expect(m.customers.total).toBe(0);
  });

  it("separates gross order value from realized revenue and excludes cancellations", async () => {
    const admin = await makeAdmin("owner");
    const c = await makeCustomer();
    const p = await makeProduct({ price: 60000, stock: 10 }); // ₹600 each, free delivery
    const a = (await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]))).order;
    const b = (await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]))).order;
    const d = (await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]))).order;

    for (const s of ["confirmed", "packed", "shipped", "delivered"] as const) await updateOrderStatusAsAdmin(String(a._id), { status: s }, admin);
    await updateOrderStatusAsAdmin(String(b._id), { status: "cancelled", note: "Customer request" }, admin);
    void d;

    let m = await getDashboardMetrics(range());
    expect(m.totals.orders).toBe(3);
    expect(m.totals.grossOrderValue).toBe(120000); // a + d (b cancelled)
    expect(m.totals.realizedRevenue).toBe(60000); // only a was paid (COD delivered)
    expect(m.byStatus).toMatchObject({ delivered: 1, cancelled: 1, pending: 1 });
    expect(m.bestSellers[0]).toMatchObject({ quantity: 2 });

    // Refund half of the delivered order.
    await updateOrderStatusAsAdmin(String(a._id), { status: "returned", note: "Damaged" }, admin);
    await updateOrderStatusAsAdmin(String(a._id), { status: "refunded", refundAmount: 30000, note: "Partial" }, admin);
    m = await getDashboardMetrics(range());
    expect(m.totals.realizedRevenue).toBe(30000);
    expect(m.totals.refunds).toBe(30000);
    expect(await AuditLog.countDocuments({ action: "order.status" })).toBeGreaterThan(0);
  });
});

describe("Customer management", () => {
  it("shows order counts and values per customer", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ price: 10000, stock: 10 });
    await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 2 }]));
    const { items } = await listCustomers({ page: 1, pageSize: 10 });
    expect(items[0]).toMatchObject({ orderCount: 1, totalValue: 24000 });
    const detail = await getCustomerForAdmin(c.id);
    expect(detail?.stats.orderCount).toBe(1);
    expect(JSON.stringify(detail)).not.toMatch(/otp|tokenHash|passwordHash/i);
  });

  it("suspending a customer revokes their sessions and is audited", async () => {
    const admin = await makeAdmin("admin");
    const c = await makeCustomer();
    const { token } = await createCustomerSession(c.id, {});
    expect(await getCustomerFromToken(token)).not.toBeNull();
    await updateCustomerAsAdmin(c.id, { accountStatus: "suspended" }, admin);
    expect(await getCustomerFromToken(token)).toBeNull();
    expect(await AuditLog.exists({ action: "customer.suspend", resourceId: c.id })).toBeTruthy();
  });
});
