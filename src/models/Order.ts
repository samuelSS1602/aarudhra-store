import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import { ActorSchema } from "./shared";

import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from "@/lib/constants";

export { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES };
export type { OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/constants";

/** Immutable snapshot of what was bought, at the price paid. */
const OrderItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId },
    name: { type: String, required: true },
    variantName: String,
    sku: { type: String, required: true },
    slug: String,
    image: String,
    unitPrice: { type: Number, required: true },
    originalPrice: Number,
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true },
    gstRate: { type: Number, default: 0 },
    taxInclusive: { type: Boolean, default: true },
  },
  { _id: false },
);

const StatusEntrySchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: () => new Date() },
    by: ActorSchema,
    note: { type: String, maxlength: 500 },
  },
  { _id: false },
);

const InternalNoteSchema = new Schema({
  note: { type: String, maxlength: 2000, required: true },
  adminId: Schema.Types.ObjectId,
  adminName: String,
  at: { type: Date, default: () => new Date() },
});

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: String,
    },
    items: { type: [OrderItemSchema], required: true },
    shippingAddress: {
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: String,
      landmark: String,
      city: { type: String, required: true },
      district: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      instructions: String,
    },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    tax: { type: Number, default: 0 }, // GST added on top (tax-exclusive items)
    taxIncluded: { type: Number, default: 0 }, // GST already contained in prices (informational)
    deliveryCharge: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    deliveryOption: { id: String, label: String, etaText: String },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },
    paymentDetails: {
      provider: String,
      reference: String,
      paidAt: Date,
    },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: "pending" },
    couponSnapshot: {
      code: String,
      discountType: { type: String, enum: ["percent", "fixed"] },
      discountValue: Number,
      discountAmount: Number,
    },
    statusHistory: { type: [StatusEntrySchema], default: [] },
    internalNotes: { type: [InternalNoteSchema], default: [] },
    cancellation: { reason: String, at: Date, by: ActorSchema },
    refund: { amount: Number, reason: String, reference: String, at: Date, by: ActorSchema },
    whatsappOptIn: { type: Boolean, default: false },
    ownerNotificationStatus: {
      type: String,
      enum: ["pending", "queued", "sent", "delivered", "read", "failed", "disabled"],
      default: "pending",
    },
    idempotencyKey: { type: String },
    inventoryRestored: { type: Boolean, default: false },
    deliveredAt: Date,
  },
  { timestamps: true },
);

OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ orderStatus: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ "customerSnapshot.phone": 1 });
OrderSchema.index({ "couponSnapshot.code": 1, userId: 1 });
OrderSchema.index({ "items.productId": 1 });
OrderSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } },
);

export type OrderDoc = InferSchemaType<typeof OrderSchema> & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export const Order: Model<OrderDoc> = (models.Order as Model<OrderDoc>) || model<OrderDoc>("Order", OrderSchema);
