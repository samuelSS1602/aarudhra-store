import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { conflict, notFound } from "@/lib/errors";
import type { OrderStatus } from "@/lib/constants";
import type { StoreSettings } from "@/lib/settings-defaults";
import { sendTemplateMessage, sendTextMessage, WhatsAppError, type SendResult } from "@/lib/whatsapp/client";
import {
  customerConfirmationParams,
  ownerTemplateParams,
  ownerTextMessage,
  statusUpdateParams,
  type OrderForMessage,
} from "@/lib/whatsapp/templates";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { NotificationLog, type NotificationLogDoc, type NotificationType } from "@/models/NotificationLog";
import { Order, type OrderDoc } from "@/models/Order";
import { WebhookEvent } from "@/models/misc";
import { getSettingsFresh, resolveOwnerRecipients } from "./settings.service";
import { audit } from "./audit.service";

const LOCK_MS = 60_000;

function appUrl(path: string) {
  return new URL(path, getEnv().NEXT_PUBLIC_APP_URL).toString();
}

function templateConfig(settings: StoreSettings) {
  const env = getEnv();
  const n = settings.notifications;
  return {
    owner: n.ownerTemplateName || env.WHATSAPP_TEMPLATE_NAME || "",
    customer: n.customerTemplateName || env.WHATSAPP_CUSTOMER_TEMPLATE_NAME || "",
    status: n.statusTemplateName || env.WHATSAPP_STATUS_TEMPLATE_NAME || "",
    language: n.templateLanguage || env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
  };
}

async function syncOwnerStatus(orderId: Types.ObjectId | null | undefined) {
  if (!orderId) return;
  const logs = await NotificationLog.find({ orderId, type: "owner_new_order" }).select("status").lean();
  if (!logs.length) return;
  const rank = ["failed", "pending", "queued", "sent", "delivered", "read"];
  // An order's owner-alert status is the best status among its recipients.
  const best = logs.map((l) => l.status).sort((a, b) => rank.indexOf(b) - rank.indexOf(a))[0]!;
  await Order.updateOne({ _id: orderId }, { $set: { ownerNotificationStatus: best } });
}

/** Idempotent: the unique dedupeKey prevents duplicate notifications for one event. */
async function upsertLog(fields: {
  orderId: Types.ObjectId;
  orderNumber: string;
  type: NotificationType;
  recipient: string;
  template: string;
  dedupeKey: string;
  maxAttempts: number;
}) {
  try {
    return await NotificationLog.findOneAndUpdate(
      { dedupeKey: fields.dedupeKey },
      { $setOnInsert: { ...fields, status: "pending", attempts: 0, nextAttemptAt: new Date(), history: [{ status: "pending", detail: "Notification recorded" }] } },
      { upsert: true, new: true },
    ).lean();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) return NotificationLog.findOne({ dedupeKey: fields.dedupeKey }).lean();
    throw err;
  }
}

/** Records owner + customer notifications for a freshly created order. Safe to call repeatedly. */
export async function recordOrderNotifications(orderId: Types.ObjectId | string) {
  await connectDB();
  const order = await Order.findById(orderId).lean();
  if (!order) return [];
  const settings = await getSettingsFresh();
  const t = templateConfig(settings);
  const n = settings.notifications;
  const created: NotificationLogDoc[] = [];

  if (n.ownerNewOrder) {
    const recipients = resolveOwnerRecipients(settings);
    if (!recipients.length) {
      await Order.updateOne({ _id: order._id }, { $set: { ownerNotificationStatus: "disabled" } });
      logger.warn("No owner WhatsApp recipient configured; owner alert skipped", { orderNumber: order.orderNumber });
    }
    for (const recipient of recipients) {
      const log = await upsertLog({
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: "owner_new_order",
        recipient,
        template: n.ownerMessageMode === "text" ? "text:new_order" : t.owner,
        dedupeKey: `order:${order._id}:owner_new_order:${recipient}`,
        maxAttempts: n.maxAttempts,
      });
      if (log) created.push(log);
    }
  } else {
    await Order.updateOne({ _id: order._id }, { $set: { ownerNotificationStatus: "disabled" } });
  }

  // Customer confirmations need explicit opt-in and an approved template.
  if (n.customerOrderConfirmation && order.whatsappOptIn && t.customer) {
    const log = await upsertLog({
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "customer_order_confirmation",
      recipient: order.customerSnapshot!.phone,
      template: t.customer,
      dedupeKey: `order:${order._id}:customer_order_confirmation`,
      maxAttempts: n.maxAttempts,
    });
    if (log) created.push(log);
  }
  return created;
}

export async function recordStatusUpdateNotification(order: Pick<OrderDoc, "_id" | "orderNumber" | "whatsappOptIn" | "customerSnapshot">, status: OrderStatus) {
  await connectDB();
  const settings = await getSettingsFresh();
  const t = templateConfig(settings);
  const n = settings.notifications;
  if (!n.customerStatusUpdates || !order.whatsappOptIn || !t.status || !n.statusUpdateEvents.includes(status)) return null;
  return upsertLog({
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: "customer_status_update",
    recipient: order.customerSnapshot!.phone,
    template: t.status,
    dedupeKey: `order:${order._id}:status:${status}`,
    maxAttempts: n.maxAttempts,
  });
}

async function deliver(log: NotificationLogDoc, order: OrderDoc, settings: StoreSettings): Promise<SendResult> {
  const t = templateConfig(settings);
  const support = settings.general.whatsappNumber || settings.general.supportPhone;
  const msgOrder = order as unknown as OrderForMessage;
  const trackingUrl = appUrl(`/account/orders/${order._id}`);

  if (log.type === "owner_new_order") {
    const adminUrl = appUrl(`/admin/orders/${order._id}`);
    if (log.template === "text:new_order") return sendTextMessage({ to: log.recipient, body: ownerTextMessage(msgOrder, adminUrl) });
    if (!log.template) throw new WhatsAppError("Owner template name is not configured", "TEMPLATE_NOT_CONFIGURED", false);
    return sendTemplateMessage({ to: log.recipient, templateName: log.template, language: t.language, bodyParams: ownerTemplateParams(msgOrder, adminUrl) });
  }
  if (log.type === "customer_order_confirmation") {
    return sendTemplateMessage({ to: log.recipient, templateName: log.template!, language: t.language, bodyParams: customerConfirmationParams(msgOrder, trackingUrl, support) });
  }
  const status = (log.dedupeKey.split(":status:")[1] ?? order.orderStatus) as OrderStatus;
  return sendTemplateMessage({ to: log.recipient, templateName: log.template!, language: t.language, bodyParams: statusUpdateParams(msgOrder, status, trackingUrl, support) });
}

/**
 * Attempts to send one notification. The atomic claim (status + lock) guarantees a
 * message is never sent twice concurrently, and already-sent messages are never resent.
 */
export async function processNotification(logId: Types.ObjectId | string, opts: { manual?: boolean } = {}) {
  await connectDB();
  const now = new Date();
  const claimable = opts.manual ? ["pending", "queued", "failed"] : ["pending", "queued"];
  const log = await NotificationLog.findOneAndUpdate(
    {
      _id: new Types.ObjectId(String(logId)),
      status: { $in: claimable },
      $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: null }, { lockedUntil: { $lte: now } }],
      ...(opts.manual ? {} : { nextAttemptAt: { $lte: now } }),
    },
    { $set: { status: "queued", lockedUntil: new Date(now.getTime() + LOCK_MS) } },
    { new: true },
  ).lean();
  if (!log) return null;

  const order = await Order.findById(log.orderId).lean();
  if (!order) {
    await NotificationLog.updateOne({ _id: log._id }, { $set: { status: "failed", errorCode: "ORDER_MISSING", errorMessage: "Order not found", failedAt: now }, $unset: { lockedUntil: 1 } });
    return null;
  }
  const settings = await getSettingsFresh();
  const attempts = log.attempts + 1;

  try {
    const result = await deliver(log, order, settings);
    await NotificationLog.updateOne(
      { _id: log._id },
      {
        $set: { status: "sent", providerMessageId: result.messageId, sentAt: new Date(), attempts, errorCode: null, errorMessage: null },
        $unset: { lockedUntil: 1 },
        $push: { history: { status: "sent", detail: `Accepted by WhatsApp API (${result.messageId})` } },
      },
    );
    logger.info("WhatsApp notification sent to provider", { type: log.type, orderNumber: log.orderNumber, messageId: result.messageId });
  } catch (err) {
    const wa = err instanceof WhatsAppError ? err : new WhatsAppError(err instanceof Error ? err.message : String(err), "UNKNOWN", true);
    const exhausted = attempts >= (log.maxAttempts ?? 5);
    const willRetry = wa.retryable && !exhausted;
    const backoffMin = settings.notifications.retryBaseMinutes * 2 ** (attempts - 1);
    await NotificationLog.updateOne(
      { _id: log._id },
      {
        $set: {
          status: willRetry ? "queued" : "failed",
          attempts,
          errorCode: wa.code,
          errorMessage: wa.message,
          nextAttemptAt: new Date(Date.now() + backoffMin * 60_000),
          ...(willRetry ? {} : { failedAt: new Date() }),
        },
        $unset: { lockedUntil: 1 },
        $push: { history: { status: willRetry ? "queued" : "failed", detail: `Attempt ${attempts} failed: [${wa.code}] ${wa.message}`.slice(0, 500) } },
      },
    );
    logger.warn("WhatsApp notification failed", { type: log.type, orderNumber: log.orderNumber, providerErrorCode: wa.code, error: wa.message, retry: willRetry });
  }

  if (log.type === "owner_new_order") await syncOwnerStatus(log.orderId);
  return NotificationLog.findById(log._id).lean();
}

/** Records and immediately attempts all notifications for a new order. Never throws. */
export async function notifyNewOrder(orderId: Types.ObjectId | string) {
  try {
    const logs = await recordOrderNotifications(orderId);
    for (const log of logs) if (log.status === "pending") await processNotification(log._id);
    await syncOwnerStatus(new Types.ObjectId(String(orderId)));
  } catch (err) {
    logger.error("notifyNewOrder failed (order is saved; cron will retry)", { error: err instanceof Error ? err.message : String(err) });
  }
}

export async function notifyStatusChange(orderId: Types.ObjectId | string, status: OrderStatus) {
  try {
    await connectDB();
    const order = await Order.findById(orderId).lean();
    if (!order) return;
    const log = await recordStatusUpdateNotification(order, status);
    if (log && log.status === "pending") await processNotification(log._id);
  } catch (err) {
    logger.error("notifyStatusChange failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

/** Retry worker: picks up due pending/queued notifications (invoked by cron). */
export async function processDueNotifications(limit = 25) {
  await connectDB();
  const now = new Date();
  const due = await NotificationLog.find({
    status: { $in: ["pending", "queued"] },
    nextAttemptAt: { $lte: now },
    $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: null }, { lockedUntil: { $lte: now } }],
  })
    .sort({ nextAttemptAt: 1 })
    .limit(limit)
    .select("_id")
    .lean();
  let processed = 0;
  for (const d of due) {
    if (await processNotification(d._id)) processed++;
  }
  return { processed, found: due.length };
}

export async function retryNotification(id: string, admin: CurrentAdmin) {
  await connectDB();
  const log = await NotificationLog.findById(id).lean();
  if (!log) throw notFound("Notification not found.");
  if (["sent", "delivered", "read"].includes(log.status)) {
    throw conflict("This message was already accepted by WhatsApp. Resending would create a duplicate.");
  }
  // Allow one more attempt beyond the automatic limit.
  await NotificationLog.updateOne({ _id: log._id }, { $set: { maxAttempts: Math.max(log.maxAttempts, log.attempts + 1) } });
  const result = await processNotification(log._id, { manual: true });
  if (!result) throw conflict("This notification is being processed right now. Please refresh in a moment.");
  await audit(admin, "notification.retry", "notification", log._id, { orderNumber: log.orderNumber, type: log.type, result: result.status });
  return result;
}

/* -------------------------------- Webhooks -------------------------------- */

type WebhookStatus = {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  recipient_id?: string;
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

const STATUS_RANK: Record<string, number> = { pending: 0, queued: 0, failed: 0, sent: 1, delivered: 2, read: 3 };

/** Applies delivery-status callbacks idempotently and monotonically. */
export async function handleWhatsAppWebhook(payload: unknown) {
  await connectDB();
  const entries = ((payload as { entry?: unknown[] })?.entry ?? []) as { changes?: { value?: { statuses?: WebhookStatus[] } }[] }[];
  let applied = 0;
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      for (const s of change.value?.statuses ?? []) {
        if (!s?.id || !s.status) continue;
        const eventKey = `wa:${s.id}:${s.status}`;
        try {
          await WebhookEvent.create({ eventKey, source: "whatsapp" });
        } catch (err) {
          if ((err as { code?: number }).code === 11000) continue; // duplicate delivery of the same callback
          throw err;
        }
        const log = await NotificationLog.findOne({ providerMessageId: s.id }).lean();
        if (!log) continue;
        const at = s.timestamp ? new Date(Number(s.timestamp) * 1000) : new Date();

        if (s.status === "failed") {
          const e = s.errors?.[0];
          await NotificationLog.updateOne(
            { _id: log._id, status: { $nin: ["delivered", "read"] } },
            {
              $set: { status: "failed", failedAt: at, errorCode: String(e?.code ?? "WEBHOOK_FAILED"), errorMessage: (e?.error_data?.details ?? e?.message ?? e?.title ?? "Delivery failed").slice(0, 500) },
              $push: { history: { status: "failed", at, detail: `Provider reported failure: ${e?.title ?? ""}`.trim() } },
            },
          );
        } else if ((STATUS_RANK[s.status] ?? 0) > (STATUS_RANK[log.status] ?? 0) || log.status === "failed") {
          const field = s.status === "delivered" ? { deliveredAt: at } : s.status === "read" ? { readAt: at, deliveredAt: log.deliveredAt ?? at } : {};
          await NotificationLog.updateOne(
            { _id: log._id },
            { $set: { status: s.status, ...field }, $push: { history: { status: s.status, at, detail: "Provider callback" } } },
          );
        }
        if (log.type === "owner_new_order") await syncOwnerStatus(log.orderId);
        applied++;
      }
    }
  }
  return { applied };
}

/* ---------------------------------- Admin --------------------------------- */

export async function listNotifications(opts: { status?: string; type?: string; q?: string; page: number; pageSize: number }) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.status) filter.status = String(opts.status);
  if (opts.type) filter.type = String(opts.type);
  if (opts.q) filter.orderNumber = { $regex: `^${opts.q.replace(/[^A-Za-z0-9-]/g, "")}`, $options: "i" };
  const [items, total, counts] = await Promise.all([
    NotificationLog.find(filter).sort({ createdAt: -1 }).skip((opts.page - 1) * opts.pageSize).limit(opts.pageSize).lean(),
    NotificationLog.countDocuments(filter),
    NotificationLog.aggregate<{ _id: string; count: number }>([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);
  return { items, total, counts: Object.fromEntries(counts.map((c) => [c._id, c.count])) as Record<string, number> };
}

export async function listOrderNotifications(orderId: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(orderId)) return [];
  return NotificationLog.find({ orderId: new Types.ObjectId(orderId) }).sort({ createdAt: 1 }).lean();
}
