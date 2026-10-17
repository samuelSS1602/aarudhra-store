import "server-only";
import { Types, type ClientSession } from "mongoose";
import { connectDB, withTransaction } from "@/lib/mongodb";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { ORDER_STATUS_LABELS, ORDER_TRANSITIONS, type OrderStatus } from "@/lib/constants";
import { can } from "@/lib/permissions";
import { escapeRegex, formatINR } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import type { CurrentCustomer } from "@/lib/auth/session";
import type { CheckoutInput } from "@/lib/validation/schemas";
import { toQuoteDTO, buildQuote } from "./pricing.service";
import { applyStockChange, InsufficientStockError } from "./inventory.service";
import { redeemCoupon, releaseCoupon } from "./coupons.service";
import { getSettingsFresh } from "./settings.service";
import { audit } from "./audit.service";
import { Order, type OrderDoc } from "@/models/Order";
import { Product } from "@/models/Product";
import { User } from "@/models/User";
import { Counter, InventoryLog } from "@/models/misc";

type Actor = { type: "system" | "customer" | "admin"; id?: Types.ObjectId; name?: string };

/** AAS-YYMMDD-NNNN, numbered per day (IST). Gaps are possible and harmless. */
async function nextOrderNumber() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const ymd = ist.toISOString().slice(2, 10).replace(/-/g, "");
  const c = await Counter.findOneAndUpdate({ _id: `order:${ymd}` }, { $inc: { seq: 1 } }, { upsert: true, new: true }).lean();
  return `AAS-${ymd}-${String(c!.seq).padStart(4, "0")}`;
}

export type CreateOrderResult = { order: OrderDoc; duplicate: boolean };

/**
 * Creates an order atomically:
 *  - totals are recomputed from current DB prices inside the transaction,
 *  - stock is decremented with conditional updates (no overselling),
 *  - coupon redemptions respect their limits,
 *  - the (userId, idempotencyKey) unique index makes retries return the same order.
 * When the deployment does not support transactions, every applied side effect is
 * compensated if a later step fails.
 */
export async function createOrder(customer: CurrentCustomer, input: CheckoutInput): Promise<CreateOrderResult> {
  await connectDB();
  const userId = new Types.ObjectId(customer.id);

  const existing = await Order.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean();
  if (existing) return { order: existing, duplicate: true };

  await enforceRateLimit(`checkout:${customer.id}`, 8, 10 * 60, "Too many order attempts. Please wait a few minutes.");

  const settings = await getSettingsFresh();
  if (input.paymentMethod === "online") {
    // No payment gateway is integrated yet; never pretend online payment works.
    throw badRequest("Online payment is not available yet. Please choose Cash on Delivery.");
  }
  if (input.paymentMethod === "cod" && !settings.commerce.codEnabled) throw badRequest("Cash on Delivery is currently unavailable.");

  const shippingPhone = normalizePhone(input.address.phone);
  if (!shippingPhone) throw badRequest("Enter a valid phone number for delivery.");
  const orderNumber = await nextOrderNumber();

  const run = async (session: ClientSession | null) => {
    const applied: { productId: string; variantId: string | null; qty: number }[] = [];
    let couponRedeemed: string | null = null;
    let createdOrderId: Types.ObjectId | null = null;

    try {
      const quote = await buildQuote({
        items: input.items,
        settings,
        couponCode: input.couponCode,
        deliveryOptionId: input.deliveryOptionId,
        userId: customer.id,
        session,
      });

      const problems = quote.lines.filter((l) => l.issue);
      if (problems.length || quote.itemCount === 0) {
        throw new AppError(409, "CART_CHANGED", "Some items in your cart changed. Please review your cart and try again.", {
          quote: toQuoteDTO(quote),
        });
      }
      if (input.couponCode && quote.couponError) throw badRequest(quote.couponError, { field: "couponCode" });
      if (quote.issues.includes("MIN_ORDER")) {
        throw badRequest(`The minimum order value is ${formatINR(settings.commerce.minimumOrderValue)}.`);
      }
      if (!quote.deliveryOption || quote.deliveryOption.id !== input.deliveryOptionId) {
        throw badRequest("Please choose an available delivery option.", { field: "deliveryOptionId" });
      }
      if (!quote.codAvailable) throw badRequest("Cash on Delivery isn't available for this order value.");

      // 1) Reserve stock atomically.
      for (const line of quote.lines) {
        try {
          const res = await applyStockChange({ productId: line.productId, variantId: line.variantId, quantityChange: -line.quantity }, session);
          applied.push({ productId: line.productId, variantId: line.variantId, qty: line.quantity });
          Object.assign(line, { _prev: res.previousStock, _new: res.newStock });
        } catch (err) {
          if (err instanceof InsufficientStockError) {
            throw new AppError(409, "OUT_OF_STOCK", `Sorry, “${line.name}” just went out of stock. Please update your cart.`);
          }
          throw err;
        }
      }

      // 2) Redeem coupon.
      if (quote.couponDoc) {
        const ok = await redeemCoupon(quote.couponDoc._id, session);
        if (!ok) throw badRequest("This coupon has reached its usage limit.", { field: "couponCode" });
        couponRedeemed = quote.couponDoc.code;
      }

      // 3) Persist the order with immutable item/price snapshots.
      const [order] = await Order.create(
        [
          {
            orderNumber,
            userId,
            customerSnapshot: { name: input.customerName, phone: customer.phoneNumber ?? shippingPhone, email: input.email ?? customer.email ?? undefined },
            items: quote.lines.map((l) => ({
              productId: new Types.ObjectId(l.productId),
              variantId: l.variantId ? new Types.ObjectId(l.variantId) : undefined,
              name: l.name,
              variantName: l.variantName ?? undefined,
              sku: l.sku,
              slug: l.slug,
              image: l.image?.url,
              unitPrice: l.unitPrice,
              originalPrice: l.originalPrice ?? undefined,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
              gstRate: l.gstRate,
              taxInclusive: l.taxInclusive,
            })),
            shippingAddress: { ...input.address, phone: shippingPhone, instructions: input.instructions },
            subtotal: quote.subtotal,
            discount: quote.discount,
            tax: quote.tax,
            taxIncluded: quote.taxIncluded,
            deliveryCharge: quote.deliveryCharge,
            totalAmount: quote.total,
            deliveryOption: { id: quote.deliveryOption.id, label: quote.deliveryOption.label, etaText: quote.deliveryOption.etaText },
            paymentMethod: input.paymentMethod,
            paymentStatus: "pending",
            orderStatus: "pending",
            couponSnapshot: quote.couponDoc
              ? { code: quote.couponDoc.code, discountType: quote.couponDoc.discountType, discountValue: quote.couponDoc.discountValue, discountAmount: quote.discount }
              : undefined,
            statusHistory: [{ status: "pending", at: new Date(), by: { type: "customer", id: userId, name: input.customerName }, note: "Order placed" }],
            whatsappOptIn: input.whatsappOptIn,
            idempotencyKey: input.idempotencyKey,
          },
        ],
        { session: session ?? undefined },
      );
      createdOrderId = order!._id;

      // 4) Inventory history + real sales counters.
      await InventoryLog.insertMany(
        quote.lines.map((l) => {
          const x = l as typeof l & { _prev: number; _new: number };
          return {
            productId: new Types.ObjectId(l.productId),
            variantId: l.variantId ? new Types.ObjectId(l.variantId) : undefined,
            sku: l.sku,
            productName: l.name,
            adjustmentType: "order",
            quantityChange: -l.quantity,
            previousStock: x._prev,
            newStock: x._new,
            reason: `Order ${orderNumber}`,
            orderId: order!._id,
          };
        }),
        { session: session ?? undefined },
      );
      await Product.bulkWrite(
        quote.lines.map((l) => ({ updateOne: { filter: { _id: new Types.ObjectId(l.productId) }, update: { $inc: { salesCount: l.quantity } } } })),
        { session: session ?? undefined },
      );

      // 5) Customer profile conveniences.
      const user = await User.findById(userId).session(session);
      if (user) {
        if (!user.name) user.name = input.customerName;
        if (!user.email && input.email) user.email = input.email;
        if (!user.phoneNumber && !user.contactPhone) user.contactPhone = shippingPhone;
        if (input.whatsappOptIn) user.set("preferences.whatsappOrderUpdates", true);
        if (input.saveAddress) {
          const a = input.address;
          const dup = user.addresses.some((x) => x.line1 === a.line1 && x.pincode === a.pincode && x.fullName === a.fullName);
          if (!dup && user.addresses.length < 10) {
            user.addresses.push({ ...a, phone: shippingPhone, label: "Home", isDefault: user.addresses.length === 0 });
          }
        }
        await user.save({ session: session ?? undefined });
      }

      return order!;
    } catch (err) {
      if (!session) {
        // Compensation for deployments without transactions.
        for (const a of applied.reverse()) {
          await applyStockChange({ productId: a.productId, variantId: a.variantId, quantityChange: a.qty }, null).catch(() => undefined);
        }
        if (couponRedeemed) await releaseCoupon(couponRedeemed, null).catch(() => undefined);
        if (createdOrderId) {
          await Order.deleteOne({ _id: createdOrderId }).catch(() => undefined);
          await InventoryLog.deleteMany({ orderId: createdOrderId }).catch(() => undefined);
        }
      }
      throw err;
    }
  };

  try {
    const order = await withTransaction(run);
    return { order: (order as unknown as { toObject: () => OrderDoc }).toObject?.() ?? (order as OrderDoc), duplicate: false };
  } catch (err) {
    // A concurrent retry with the same idempotency key already created the order.
    if ((err as { code?: number }).code === 11000) {
      const dup = await Order.findOne({ userId, idempotencyKey: input.idempotencyKey }).lean();
      if (dup) return { order: dup, duplicate: true };
    }
    throw err;
  }
}

/* --------------------------- Status & lifecycle --------------------------- */

async function restoreInventory(order: OrderDoc, reason: "cancellation" | "return", session: ClientSession | null) {
  if (order.inventoryRestored) return;
  for (const item of order.items) {
    // Products may have been deleted/edited since; restore only where the item still exists.
    try {
      const res = await applyStockChange({ productId: item.productId, variantId: item.variantId ?? null, quantityChange: item.quantity }, session);
      await InventoryLog.create(
        [
          {
            productId: item.productId,
            variantId: item.variantId,
            sku: item.sku,
            productName: item.name,
            adjustmentType: reason,
            quantityChange: item.quantity,
            previousStock: res.previousStock,
            newStock: res.newStock,
            reason: `Order ${order.orderNumber} ${reason === "return" ? "returned" : "cancelled"}`,
            orderId: order._id,
          },
        ],
        { session: session ?? undefined },
      );
      await Product.updateOne({ _id: item.productId, salesCount: { $gte: item.quantity } }, { $inc: { salesCount: -item.quantity } }, { session: session ?? undefined });
    } catch (err) {
      if (!(err instanceof InsufficientStockError)) throw err;
    }
  }
}

type StatusChange = {
  status: OrderStatus;
  note?: string;
  override?: boolean;
  refundAmount?: number;
  refundReference?: string;
  markPaid?: boolean;
};

async function applyStatusChange(orderId: string, change: StatusChange, actor: Actor, opts: { allowOverride: boolean }) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) throw notFound("Order not found.");

  return withTransaction(async (session) => {
    const order = await Order.findById(orderId).session(session).lean();
    if (!order) throw notFound("Order not found.");
    const from = order.orderStatus as OrderStatus;
    const to = change.status;
    if (from === to) throw badRequest(`The order is already ${ORDER_STATUS_LABELS[to].toLowerCase()}.`);

    const normal = ORDER_TRANSITIONS[from].includes(to);
    if (!normal && !(change.override && opts.allowOverride)) {
      throw badRequest(`An order can't move from “${ORDER_STATUS_LABELS[from]}” to “${ORDER_STATUS_LABELS[to]}”.`);
    }

    const now = new Date();
    const set: Record<string, unknown> = { orderStatus: to };

    if (to === "cancelled") {
      await restoreInventory(order, "cancellation", session);
      set.inventoryRestored = true;
      set.cancellation = { reason: change.note ?? "", at: now, by: actor };
      if (order.couponSnapshot?.code) await releaseCoupon(order.couponSnapshot.code, session);
    }
    if (to === "returned") {
      await restoreInventory(order, "return", session);
      set.inventoryRestored = true;
    }
    if (to === "delivered") {
      set.deliveredAt = now;
      // Cash on delivery is collected at the door.
      if (order.paymentMethod === "cod" && (change.markPaid ?? true)) {
        set.paymentStatus = "paid";
        set["paymentDetails.paidAt"] = now;
        set["paymentDetails.provider"] = "cash";
      }
    }
    if (to === "refunded") {
      if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") {
        throw badRequest("Only paid orders can be refunded. Unpaid orders should simply be cancelled.");
      }
      const amount = change.refundAmount ?? order.totalAmount;
      if (amount <= 0 || amount > order.totalAmount) throw badRequest("Refund amount must be between ₹0 and the order total.");
      set.refund = { amount, reason: change.note ?? "", reference: change.refundReference ?? "", at: now, by: actor };
      set.paymentStatus = amount >= order.totalAmount ? "refunded" : "partially_refunded";
    }

    // Optimistic concurrency: only apply if nobody changed the status meanwhile.
    const res = await Order.updateOne(
      { _id: order._id, orderStatus: from },
      { $set: set, $push: { statusHistory: { status: to, at: now, by: actor, note: change.note } } },
      { session: session ?? undefined },
    );
    if (res.modifiedCount !== 1) throw conflict("This order was updated by someone else. Please refresh and try again.");
    return { order, from, to, overridden: !normal };
  });
}

export async function updateOrderStatusAsAdmin(orderId: string, change: StatusChange, admin: CurrentAdmin) {
  if (change.status === "cancelled" && !can(admin.role, "orders:cancel")) throw forbidden("You can't cancel orders.");
  if (change.status === "refunded" && !can(admin.role, "orders:refund")) throw forbidden("You can't record refunds.");
  const result = await applyStatusChange(
    orderId,
    change,
    { type: "admin", id: new Types.ObjectId(admin.id), name: admin.name },
    { allowOverride: can(admin.role, "orders:override") },
  );
  await audit(admin, result.overridden ? "order.status.override" : "order.status", "order", orderId, {
    orderNumber: result.order.orderNumber,
    from: result.from,
    to: result.to,
    note: change.note ?? null,
  });
  return result;
}

export async function cancelOrderAsCustomer(orderId: string, customer: CurrentCustomer, reason: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) throw notFound("Order not found.");
  const order = await Order.findOne({ _id: orderId, userId: new Types.ObjectId(customer.id) }).select("orderStatus").lean();
  if (!order) throw notFound("Order not found.");
  const settings = await getSettingsFresh();
  if (!settings.commerce.customerCancellableStatuses.includes(order.orderStatus)) {
    throw badRequest("This order can no longer be cancelled online. Please contact the store.");
  }
  return applyStatusChange(
    orderId,
    { status: "cancelled", note: reason ? `Cancelled by customer: ${reason}` : "Cancelled by customer" },
    { type: "customer", id: new Types.ObjectId(customer.id), name: customer.name },
    { allowOverride: false },
  );
}

export async function addOrderNote(orderId: string, note: string, admin: CurrentAdmin) {
  await connectDB();
  const res = await Order.updateOne(
    { _id: orderId },
    { $push: { internalNotes: { note, adminId: new Types.ObjectId(admin.id), adminName: admin.name, at: new Date() } } },
  );
  if (res.matchedCount !== 1) throw notFound("Order not found.");
  await audit(admin, "order.note", "order", orderId, { length: note.length });
}

/* --------------------------------- Queries -------------------------------- */

export async function listCustomerOrders(userId: string, page = 1, pageSize = 10) {
  await connectDB();
  const filter = { userId: new Types.ObjectId(userId) };
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total };
}

/** Ownership is enforced in the query itself: other customers' orders are simply "not found". */
export async function getCustomerOrder(orderId: string, userId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) return null;
  return Order.findOne({ _id: orderId, userId: new Types.ObjectId(userId) }).lean();
}

export async function getOrderById(orderId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) return null;
  return Order.findById(orderId).lean();
}

export async function listAdminOrders(opts: {
  q?: string;
  status?: string;
  paymentStatus?: string;
  notification?: string;
  from?: Date;
  to?: Date;
  userId?: string;
  page: number;
  pageSize: number;
}) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.orderStatus = String(opts.status);
  if (opts.paymentStatus) filter.paymentStatus = String(opts.paymentStatus);
  if (opts.notification) filter.ownerNotificationStatus = String(opts.notification);
  if (opts.userId && Types.ObjectId.isValid(opts.userId)) filter.userId = new Types.ObjectId(opts.userId);
  if (opts.from || opts.to) {
    filter.createdAt = { ...(opts.from ? { $gte: opts.from } : {}), ...(opts.to ? { $lte: opts.to } : {}) };
  }
  if (opts.q) {
    const q = opts.q.trim();
    const phone = normalizePhone(q);
    const rx = { $regex: escapeRegex(q), $options: "i" };
    filter.$or = [
      { orderNumber: rx },
      { "customerSnapshot.name": rx },
      ...(phone ? [{ "customerSnapshot.phone": phone }] : [{ "customerSnapshot.phone": rx }]),
    ];
  }
  const [items, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((opts.page - 1) * opts.pageSize).limit(opts.pageSize).lean(),
    Order.countDocuments(filter),
  ]);
  return { items, total };
}
