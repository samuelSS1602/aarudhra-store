import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { setWhatsAppFetchForTests, sanitizeTemplateParam, verifyWebhookSignature } from "@/lib/whatsapp/client";
import { createOrder } from "@/services/orders.service";
import { handleWhatsAppWebhook, notifyNewOrder, processDueNotifications, retryNotification } from "@/services/notifications.service";
import { NotificationLog } from "@/models/NotificationLog";
import { Order } from "@/models/Order";
import { ownerTextMessage } from "@/lib/whatsapp/templates";
import { GET as webhookVerify, POST as webhookPost } from "@/app/api/webhooks/whatsapp/route";
import { GET as cronRoute } from "@/app/api/cron/notifications/route";
import { checkoutInput, makeAdmin, makeCustomer, makeProduct, request } from "./helpers";

type Call = { url: string; body: Record<string, unknown> };

function mockWhatsApp(responses: (() => Response)[]) {
  const calls: Call[] = [];
  let i = 0;
  setWhatsAppFetchForTests((async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return r();
  }) as typeof fetch);
  return calls;
}
const ok = (id = "wamid.TEST1") => () => new Response(JSON.stringify({ messaging_product: "whatsapp", contacts: [{ wa_id: "919876500001" }], messages: [{ id }] }), { status: 200 });
const fail = (status = 500, code = 131000) => () => new Response(JSON.stringify({ error: { message: "Something went wrong", code } }), { status });

afterEach(() => setWhatsAppFetchForTests(null));

async function placeOrder() {
  const c = await makeCustomer();
  const p = await makeProduct({ name: "Ruled Notebook", price: 4500, stock: 10 });
  const { order } = await createOrder(c, checkoutInput([{ productId: String(p._id), quantity: 2 }]));
  return order;
}

describe("Owner WhatsApp notification", () => {
  it("sends the approved template to the owner and records the provider response", async () => {
    const calls = mockWhatsApp([ok("wamid.ABC")]);
    const order = await placeOrder();
    await notifyNewOrder(order._id);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain("/1234567890/messages");
    const body = calls[0]!.body as { to: string; type: string; template: { name: string; components: { parameters: { text: string }[] }[] } };
    expect(body.to).toBe("919876500001");
    expect(body.type).toBe("template");
    expect(body.template.name).toBe("new_order_alert");
    const params = body.template.components[0]!.parameters.map((p) => p.text);
    expect(params).toHaveLength(14);
    expect(params[0]).toBe(order.orderNumber);
    expect(params[3]).toContain("2 × Ruled Notebook");
    expect(params[8]).toBe("130.00"); // ₹90 + ₹40 delivery
    expect(params.every((p) => !/[\n\t]/.test(p))).toBe(true);
    expect(params[13]).toBe(`https://store.test/admin/orders/${order._id}`);

    const log = await NotificationLog.findOne({ orderId: order._id }).lean();
    expect(log).toMatchObject({ status: "sent", providerMessageId: "wamid.ABC", attempts: 1 });
    expect((await Order.findById(order._id).lean())?.ownerNotificationStatus).toBe("sent");
  });

  it("keeps the order and queues a retry when WhatsApp fails", async () => {
    mockWhatsApp([fail(503)]);
    const order = await placeOrder();
    await notifyNewOrder(order._id);
    expect(await Order.exists({ _id: order._id })).toBeTruthy();
    const log = await NotificationLog.findOne({ orderId: order._id }).lean();
    expect(log).toMatchObject({ status: "queued", attempts: 1, errorCode: "131000" });
    expect(log!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("retries safely via the cron worker and does not resend once sent", async () => {
    const calls = mockWhatsApp([fail(503), ok("wamid.RETRY")]);
    const order = await placeOrder();
    await notifyNewOrder(order._id);
    // Not due yet — nothing happens.
    expect((await processDueNotifications()).processed).toBe(0);
    await NotificationLog.updateMany({}, { $set: { nextAttemptAt: new Date(Date.now() - 1000) } });
    const res = await cronRoute(request("/api/cron/notifications", { headers: { authorization: "Bearer test-cron-secret" } }));
    expect(res.status).toBe(200);
    const log = await NotificationLog.findOne({ orderId: order._id }).lean();
    expect(log).toMatchObject({ status: "sent", attempts: 2, providerMessageId: "wamid.RETRY" });
    await processDueNotifications();
    expect(calls).toHaveLength(2);
  });

  it("rejects cron calls without the secret", async () => {
    const res = await cronRoute(request("/api/cron/notifications"));
    expect(res.status).toBe(401);
  });

  it("marks non-retryable errors as failed and allows a manual retry", async () => {
    const calls = mockWhatsApp([fail(400, 132001), ok("wamid.MANUAL")]);
    const order = await placeOrder();
    await notifyNewOrder(order._id);
    const log = await NotificationLog.findOne({ orderId: order._id }).lean();
    expect(log?.status).toBe("failed");
    expect((await Order.findById(order._id).lean())?.ownerNotificationStatus).toBe("failed");
    const admin = await makeAdmin("manager");
    const retried = await retryNotification(String(log!._id), admin);
    expect(retried.status).toBe("sent");
    await expect(retryNotification(String(log!._id), admin)).rejects.toMatchObject({ status: 409 });
    expect(calls).toHaveLength(2);
  });

  it("avoids duplicate notifications when the order event is replayed", async () => {
    const calls = mockWhatsApp([ok("wamid.ONE")]);
    const order = await placeOrder();
    await Promise.all([notifyNewOrder(order._id), notifyNewOrder(order._id), notifyNewOrder(order._id)]);
    expect(calls).toHaveLength(1);
    expect(await NotificationLog.countDocuments({ orderId: order._id })).toBe(1);
  });

  it("sanitises template parameters (no newlines / tabs / long space runs)", () => {
    expect(sanitizeTemplateParam("a\nb\t c      d")).toBe("a | b | c   d");
    expect(sanitizeTemplateParam("")).toBe("-");
  });
});

describe("WhatsApp webhooks", () => {
  const sign = (raw: string) => `sha256=${createHmac("sha256", "test-app-secret").update(raw).digest("hex")}`;
  const statusPayload = (id: string, status: string) => JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ value: { statuses: [{ id, status, timestamp: String(Math.floor(Date.now() / 1000)) }] } }] }] });

  it("verifies the subscription handshake token", async () => {
    const good = await webhookVerify(request("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=test-verify-token&hub.challenge=42"));
    expect(good.status).toBe(200);
    expect(await good.text()).toBe("42");
    const bad = await webhookVerify(request("/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"));
    expect(bad.status).toBe(403);
  });

  it("rejects callbacks with an invalid signature", async () => {
    const raw = statusPayload("wamid.X", "delivered");
    expect(verifyWebhookSignature(raw, sign(raw), "test-app-secret")).toBe(true);
    expect(verifyWebhookSignature(raw, "sha256=deadbeef", "test-app-secret")).toBe(false);
    const res = await webhookPost(request("/api/webhooks/whatsapp", { rawBody: raw, headers: { "x-hub-signature-256": "sha256=00" } }));
    expect(res.status).toBe(401);
  });

  it("processes verified delivery receipts idempotently and monotonically", async () => {
    mockWhatsApp([ok("wamid.DLV")]);
    const order = await placeOrder();
    await notifyNewOrder(order._id);

    const delivered = statusPayload("wamid.DLV", "delivered");
    const r1 = await webhookPost(request("/api/webhooks/whatsapp", { rawBody: delivered, headers: { "x-hub-signature-256": sign(delivered) } }));
    expect(r1.status).toBe(200);
    let log = await NotificationLog.findOne({ providerMessageId: "wamid.DLV" }).lean();
    expect(log?.status).toBe("delivered");
    expect(log?.deliveredAt).toBeTruthy();
    expect((await Order.findById(order._id).lean())?.ownerNotificationStatus).toBe("delivered");

    // Replayed callback → no duplicate history entries.
    const historyLen = log!.history.length;
    await handleWhatsAppWebhook(JSON.parse(delivered));
    log = await NotificationLog.findOne({ providerMessageId: "wamid.DLV" }).lean();
    expect(log!.history.length).toBe(historyLen);

    // A late "sent" callback must not downgrade "delivered".
    await handleWhatsAppWebhook(JSON.parse(statusPayload("wamid.DLV", "sent")));
    expect((await NotificationLog.findOne({ providerMessageId: "wamid.DLV" }).lean())?.status).toBe("delivered");

    await handleWhatsAppWebhook(JSON.parse(statusPayload("wamid.DLV", "read")));
    expect((await NotificationLog.findOne({ providerMessageId: "wamid.DLV" }).lean())?.status).toBe("read");
  });
});

describe("owner WhatsApp order message", () => {
  const photoId = "a".repeat(24);
  const order = {
    orderNumber: "AAS-1",
    customerSnapshot: { name: "Test", phone: "+919876500001" },
    items: [
      { name: "Notebook", variantName: "Blue", quantity: 2, unitPrice: 5000, lineTotal: 10000, image: `/media/${photoId}.webp` },
      { name: "Pen", quantity: 1, lineTotal: 1000 },
    ],
    subtotal: 11000,
    discount: 0,
    deliveryCharge: 0,
    tax: 0,
    totalAmount: 11000,
    paymentMethod: "cod",
    paymentStatus: "pending",
    shippingAddress: { fullName: "Test", phone: "+919876500001", line1: "1 Main St", city: "Palani", district: "Dindigul", state: "Tamil Nadu", pincode: "624601" },
    createdAt: new Date(),
  };

  it("lists each item with its price and a direct link to its photo", () => {
    const msg = ownerTextMessage(order, "https://shop.example/admin/orders/1", "https://shop.example");
    expect(msg).toContain("*1. Notebook* _(Blue)_");
    expect(msg).toContain("2 × ₹50.00 = *₹100.00*");
    expect(msg).toContain(`🖼️ Photo: https://shop.example/media/${photoId}.jpg`);
    expect(msg).toContain("1 × ₹10.00 = *₹10.00*");
    expect(msg.match(/🖼️/g)).toHaveLength(1); // items without a photo get no link
    expect(msg).toContain("*Items* (3 pieces)");
    expect(msg).toContain("💰 *TOTAL: ₹110.00*");
  });

  it("hides zero discount/GST lines and shows free delivery", () => {
    const msg = ownerTextMessage(order, "https://shop.example/admin/orders/1", "https://shop.example");
    expect(msg).not.toContain("Discount");
    expect(msg).not.toContain("GST");
    expect(msg).toContain("Delivery: FREE");
    const withCharges = ownerTextMessage({ ...order, discount: 500, tax: 900, deliveryCharge: 3000 }, "https://shop.example/admin/orders/1");
    expect(withCharges).toContain("Discount: −₹5.00");
    expect(withCharges).toContain("GST: ₹9.00");
    expect(withCharges).toContain("Delivery: ₹30.00");
  });

  it("omits photo links when no site URL is given", () => {
    expect(ownerTextMessage(order, "http://localhost:3000/admin/orders/1")).not.toContain("🖼️");
  });
});
