import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/* ----------------------------- Inventory logs ----------------------------- */

export const INVENTORY_ADJUSTMENT_TYPES = [
  "initial",
  "restock",
  "adjustment",
  "damage",
  "correction",
  "order",
  "cancellation",
  "return",
] as const;

const InventoryLogSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  variantId: { type: Schema.Types.ObjectId },
  sku: String,
  productName: String,
  adjustmentType: { type: String, enum: INVENTORY_ADJUSTMENT_TYPES, required: true },
  quantityChange: { type: Number, required: true },
  previousStock: { type: Number, required: true },
  newStock: { type: Number, required: true },
  reason: { type: String, maxlength: 300 },
  adminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  adminName: String,
  orderId: { type: Schema.Types.ObjectId, ref: "Order" },
  createdAt: { type: Date, default: () => new Date() },
});
InventoryLogSchema.index({ productId: 1, createdAt: -1 });
InventoryLogSchema.index({ createdAt: -1 });

export type InventoryLogDoc = InferSchemaType<typeof InventoryLogSchema> & { _id: Types.ObjectId };
export const InventoryLog: Model<InventoryLogDoc> =
  (models.InventoryLog as Model<InventoryLogDoc>) || model<InventoryLogDoc>("InventoryLog", InventoryLogSchema);

/* ------------------------------- Audit logs ------------------------------- */

const AuditLogSchema = new Schema({
  adminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  adminName: String,
  adminRole: String,
  action: { type: String, required: true },
  resourceType: { type: String, required: true },
  resourceId: String,
  sanitizedMetadata: { type: Schema.Types.Mixed, default: {} },
  ip: String,
  createdAt: { type: Date, default: () => new Date() },
});
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ adminId: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1 });
// Retention: audit entries are kept for two years.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60, name: "audit_retention" });

export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema> & { _id: Types.ObjectId };
export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) || model<AuditLogDoc>("AuditLog", AuditLogSchema);

/* ---------------------------------- Cart ---------------------------------- */

const CartSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: {
      type: [
        new Schema(
          {
            productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
            variantId: { type: Schema.Types.ObjectId },
            quantity: { type: Number, required: true, min: 1, max: 99 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    couponCode: String,
  },
  { timestamps: true },
);

export type CartDoc = InferSchemaType<typeof CartSchema> & { _id: Types.ObjectId };
export const Cart: Model<CartDoc> = (models.Cart as Model<CartDoc>) || model<CartDoc>("Cart", CartSchema);

/* ------------------------------- Rate limits ------------------------------ */

const RateLimitSchema = new Schema({
  key: { type: String, required: true, unique: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RateLimitDoc = InferSchemaType<typeof RateLimitSchema>;
export const RateLimit: Model<RateLimitDoc> =
  (models.RateLimit as Model<RateLimitDoc>) || model<RateLimitDoc>("RateLimit", RateLimitSchema);

/* -------------------------------- Counters -------------------------------- */

const CounterSchema = new Schema({ _id: { type: String, required: true }, seq: { type: Number, default: 0 } });
export type CounterDoc = { _id: string; seq: number };
export const Counter: Model<CounterDoc> =
  (models.Counter as Model<CounterDoc>) || model<CounterDoc>("Counter", CounterSchema);

/* ----------------------------- Webhook events ----------------------------- */

/** Dedupe store for provider callbacks; entries expire after 30 days. */
const WebhookEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  source: String,
  receivedAt: { type: Date, default: () => new Date() },
});
WebhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const WebhookEvent: Model<InferSchemaType<typeof WebhookEventSchema>> =
  (models.WebhookEvent as Model<InferSchemaType<typeof WebhookEventSchema>>) ||
  model("WebhookEvent", WebhookEventSchema);

/* ------------------------- Newsletter subscribers ------------------------- */

const SubscriberSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 200 },
  consentAt: { type: Date, default: () => new Date() },
  source: { type: String, default: "homepage" },
  status: { type: String, enum: ["subscribed", "unsubscribed"], default: "subscribed" },
});
export const Subscriber: Model<InferSchemaType<typeof SubscriberSchema>> =
  (models.Subscriber as Model<InferSchemaType<typeof SubscriberSchema>>) || model("Subscriber", SubscriberSchema);
