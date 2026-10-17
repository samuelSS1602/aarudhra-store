import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const NOTIFICATION_TYPES = ["owner_new_order", "customer_order_confirmation", "customer_status_update"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * pending  – recorded, not yet attempted
 * queued   – claimed by a worker / waiting for retry
 * sent     – accepted by the WhatsApp API ("sent to provider"); NOT proof of delivery
 * delivered/read – confirmed by Meta webhook callbacks
 * failed   – permanently failed or retries exhausted (or reported failed by webhook)
 */
export const NOTIFICATION_STATUSES = ["pending", "queued", "sent", "delivered", "read", "failed"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

const NotificationLogSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    orderNumber: String,
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    recipient: { type: String, required: true },
    channel: { type: String, enum: ["whatsapp"], default: "whatsapp" },
    template: String,
    // Prevents duplicate notifications for the same event (e.g. retried checkout requests).
    dedupeKey: { type: String, required: true, unique: true },
    providerMessageId: { type: String },
    status: { type: String, enum: NOTIFICATION_STATUSES, default: "pending" },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: () => new Date() },
    lockedUntil: Date,
    errorCode: String,
    errorMessage: String,
    params: { type: [String], default: [] },
    sentAt: Date,
    deliveredAt: Date,
    readAt: Date,
    failedAt: Date,
    history: {
      type: [new Schema({ status: String, at: { type: Date, default: () => new Date() }, detail: String }, { _id: false })],
      default: [],
    },
  },
  { timestamps: true },
);
NotificationLogSchema.index({ providerMessageId: 1 }, { sparse: true });
NotificationLogSchema.index({ status: 1, nextAttemptAt: 1 });
NotificationLogSchema.index({ createdAt: -1 });

export type NotificationLogDoc = InferSchemaType<typeof NotificationLogSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};
export const NotificationLog: Model<NotificationLogDoc> =
  (models.NotificationLog as Model<NotificationLogDoc>) ||
  model<NotificationLogDoc>("NotificationLog", NotificationLogSchema);
