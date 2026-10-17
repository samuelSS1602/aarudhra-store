import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { runAfterResponse } from "@/lib/background";
import { checkoutSchema } from "@/lib/validation/schemas";
import { createOrder } from "@/services/orders.service";
import { clearCart } from "@/services/cart.service";
import { notifyNewOrder } from "@/services/notifications.service";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Places an order. The customer identity comes from the session cookie, and all
 * prices, discounts and totals are recalculated server-side. Retrying with the
 * same idempotencyKey returns the original order instead of creating another.
 */
export const POST = route(async (req) => {
  const customer = await requireCustomer(req);
  const input = await readJson(req, checkoutSchema, 32 * 1024);
  const { order, duplicate } = await createOrder(customer, input);

  if (!duplicate) {
    await clearCart(customer.id);
    // The order is committed; WhatsApp alerts run after the response and are retried by cron on failure.
    runAfterResponse(() => notifyNewOrder(order._id));
    invalidate(TAGS.catalog); // stock changed
  }
  return json({ ok: true, duplicate, order: { id: String(order._id), orderNumber: order.orderNumber } }, { status: duplicate ? 200 : 201 });
});
