import { describe, expect, it } from "vitest";
import { checkoutSchema } from "@/lib/validation/schemas";
import { createOrder, getCustomerOrder, updateOrderStatusAsAdmin, cancelOrderAsCustomer } from "@/services/orders.service";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { Coupon } from "@/models/Coupon";
import { InventoryLog } from "@/models/misc";
import { GET as orderRoute } from "@/app/api/orders/[id]/route";
import { POST as checkoutRoute } from "@/app/api/checkout/route";
import { checkoutInput, customerCookie, makeAdmin, makeCustomer, makeProduct, request, withId, noParams } from "./helpers";

describe("Checkout & order creation", () => {
  it("places an order with server-computed totals and decrements stock", async () => {
    const c = await makeCustomer();
    const a = await makeProduct({ price: 4500, stock: 10, gstRate: 12 }); // ₹45
    const b = await makeProduct({ price: 12000, stock: 3 }); // ₹120
    const { order } = await createOrder(c, checkoutInput([{ productId: String(a._id), quantity: 2 }, { productId: String(b._id), quantity: 1 }]));
    expect(order.subtotal).toBe(21000);
    expect(order.deliveryCharge).toBe(4000); // default standard delivery ₹40 (below ₹499 free threshold)
    expect(order.totalAmount).toBe(25000);
    expect(order.orderStatus).toBe("pending");
    expect(order.orderNumber).toMatch(/^AAS-\d{6}-\d{4}$/);
    expect((await Product.findById(a._id).lean())?.stock).toBe(8);
    expect((await Product.findById(b._id).lean())?.stock).toBe(2);
    expect(await InventoryLog.countDocuments({ orderId: order._id, adjustmentType: "order" })).toBe(2);
    expect((await Product.findById(a._id).lean())?.salesCount).toBe(2);
  });

  it("ignores prices, totals and user ids sent by the browser", () => {
    const parsed = checkoutSchema.parse({
      ...checkoutInput([{ productId: "a".repeat(24), quantity: 1 }]),
      items: [{ productId: "a".repeat(24), quantity: 1, price: 1 }],
      totalAmount: 1,
      discount: 99999,
      userId: "b".repeat(24),
      paymentStatus: "paid",
    });
    expect(parsed).not.toHaveProperty("totalAmount");
    expect(parsed).not.toHaveProperty("userId");
    expect(parsed).not.toHaveProperty("paymentStatus");
    expect(parsed.items[0]).not.toHaveProperty("price");
  });

  it("applies free delivery above the threshold", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ price: 50000, stock: 5 });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    expect(order.deliveryCharge).toBe(0);
    expect(order.totalAmount).toBe(50000);
  });

  it("adds GST for tax-exclusive products", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ price: 10000, stock: 5, gstRate: 18, inclusive: false });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    expect(order.tax).toBe(1800);
    expect(order.totalAmount).toBe(10000 + 1800 + 4000);
  });

  it("validates stock and rejects orders exceeding it without touching inventory", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ stock: 2 });
    await expect(createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 3 }]))).rejects.toMatchObject({ status: 409, code: "CART_CHANGED" });
    expect((await Product.findById(p._id).lean())?.stock).toBe(2);
    expect(await Order.countDocuments()).toBe(0);
  });

  it("never oversells under concurrent checkouts", async () => {
    const p = await makeProduct({ stock: 2 });
    const customers = await Promise.all([1, 2, 3, 4].map((i) => makeCustomer(`+91981110000${i}`)));
    const results = await Promise.allSettled(customers.map((c) => createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]))));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(2);
    expect((await Product.findById(p._id).lean())?.stock).toBe(0);
    expect(await Order.countDocuments()).toBe(2);
  });

  it("prevents duplicate orders for the same idempotency key", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ stock: 10 });
    const input = checkoutInput([{ productId: String(p._id), quantity: 2 }]);
    const first = await createOrder(c, input);
    const second = await createOrder(c, input);
    expect(second.duplicate).toBe(true);
    expect(String(second.order._id)).toBe(String(first.order._id));
    // Concurrent retries too.
    const input2 = checkoutInput([{ productId: String(p._id), quantity: 1 }]);
    const both = await Promise.all([createOrder(c, input2), createOrder(c, input2)]);
    expect(String(both[0].order._id)).toBe(String(both[1].order._id));
    expect(await Order.countDocuments()).toBe(2);
    expect((await Product.findById(p._id).lean())?.stock).toBe(7);
  });

  it("rejects invalid, expired and exhausted coupons and applies valid ones", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ price: 20000, stock: 10 });
    await expect(createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }], { couponCode: "NOPE" }))).rejects.toMatchObject({ status: 400 });
    await Coupon.create({ code: "OLD", discountType: "percent", discountValue: 10, expiryDate: new Date(Date.now() - 1000) });
    await expect(createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }], { couponCode: "OLD" }))).rejects.toMatchObject({ status: 400 });

    await Coupon.create({ code: "SAVE10", discountType: "percent", discountValue: 10, maximumDiscount: 1500, usageLimit: 1, perCustomerLimit: 1 });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }], { couponCode: "save10" }));
    expect(order.discount).toBe(1500); // 10% of ₹200 = ₹20, capped at ₹15
    expect(order.couponSnapshot?.code).toBe("SAVE10");
    expect((await Coupon.findOne({ code: "SAVE10" }).lean())?.usedCount).toBe(1);

    const other = await makeCustomer("+919811100009");
    await expect(createOrder(other, checkoutInput([{ productId: String(p._id), quantity: 1 }], { couponCode: "SAVE10" }))).rejects.toMatchObject({ status: 400 });
  });

  it("refuses online payment because no gateway is integrated", async () => {
    const c = await makeCustomer();
    const p = await makeProduct();
    await expect(createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }], { paymentMethod: "online" }))).rejects.toMatchObject({ status: 400 });
  });

  it("preserves item and price snapshots after the product is edited", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ name: "Original name", price: 3000, stock: 5 });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    await Product.updateOne({ _id: p._id }, { $set: { name: "Renamed", price: 9999 } });
    const saved = await Order.findById(order._id).lean();
    expect(saved?.items[0]).toMatchObject({ name: "Original name", unitPrice: 3000, sku: p.sku });
  });

  it("restricts customers to their own orders", async () => {
    const alice = await makeCustomer("+919811100011");
    const bob = await makeCustomer("+919811100012");
    const p = await makeProduct();
    const { order } = await createOrder(alice, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    expect(await getCustomerOrder(String(order._id), bob.id)).toBeNull();
    const res = await orderRoute(request(`/api/orders/${order._id}`, { cookie: await customerCookie(bob.id) }), withId(String(order._id)));
    expect(res.status).toBe(404);
    const own = await orderRoute(request(`/api/orders/${order._id}`, { cookie: await customerCookie(alice.id) }), withId(String(order._id)));
    expect(own.status).toBe(200);
  });

  it("requires a signed-in customer to check out", async () => {
    const p = await makeProduct();
    const res = await checkoutRoute(request("/api/checkout", { body: checkoutInput([{ productId: String(p._id), quantity: 1 }]) }), noParams);
    expect(res.status).toBe(401);
  });
});

describe("Order status workflow", () => {
  it("validates transitions on the server", async () => {
    const admin = await makeAdmin("staff");
    const c = await makeCustomer();
    const p = await makeProduct();
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    const id = String(order._id);
    await expect(updateOrderStatusAsAdmin(id, { status: "delivered" }, admin)).rejects.toMatchObject({ status: 400 });
    await updateOrderStatusAsAdmin(id, { status: "confirmed" }, admin);
    await updateOrderStatusAsAdmin(id, { status: "packed" }, admin);
    await updateOrderStatusAsAdmin(id, { status: "shipped" }, admin);
    await updateOrderStatusAsAdmin(id, { status: "delivered" }, admin);
    const saved = await Order.findById(id).lean();
    expect(saved?.orderStatus).toBe("delivered");
    expect(saved?.paymentStatus).toBe("paid"); // COD collected on delivery
    expect(saved?.statusHistory.map((h) => h.status)).toEqual(["pending", "confirmed", "packed", "shipped", "delivered"]);
  });

  it("only privileged roles may override or cancel", async () => {
    const staff = await makeAdmin("staff");
    const admin = await makeAdmin("admin");
    const c = await makeCustomer();
    const p = await makeProduct({ stock: 5 });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 2 }]));
    const id = String(order._id);
    await expect(updateOrderStatusAsAdmin(id, { status: "cancelled", note: "x" }, staff)).rejects.toMatchObject({ status: 403 });
    await expect(updateOrderStatusAsAdmin(id, { status: "shipped", override: true, note: "fix" }, staff)).rejects.toMatchObject({ status: 400 });
    await updateOrderStatusAsAdmin(id, { status: "shipped", override: true, note: "Handed to courier offline" }, admin);
    expect((await Order.findById(id).lean())?.orderStatus).toBe("shipped");
  });

  it("restores inventory when an order is cancelled, exactly once", async () => {
    const c = await makeCustomer();
    const p = await makeProduct({ stock: 5 });
    const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 3 }]));
    expect((await Product.findById(p._id).lean())?.stock).toBe(2);
    await cancelOrderAsCustomer(String(order._id), c, "Ordered by mistake");
    expect((await Product.findById(p._id).lean())?.stock).toBe(5);
    await expect(cancelOrderAsCustomer(String(order._id), c, "again")).rejects.toBeTruthy();
    expect((await Product.findById(p._id).lean())?.stock).toBe(5);
  });

  it("does not let a customer cancel someone else's order", async () => {
    const alice = await makeCustomer("+919811100021");
    const bob = await makeCustomer("+919811100022");
    const p = await makeProduct();
    const { order } = await createOrder(alice, checkoutInput([{ productId: String(p._id), quantity: 1 }]));
    await expect(cancelOrderAsCustomer(String(order._id), bob, "")).rejects.toMatchObject({ status: 404 });
  });
});
