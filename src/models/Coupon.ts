import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

const CouponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 32 },
    description: { type: String, maxlength: 200, default: "" },
    discountType: { type: String, enum: ["percent", "fixed"], required: true },
    // percent: 1–100; fixed: paise
    discountValue: { type: Number, required: true, min: 0 },
    minimumOrderValue: { type: Number, min: 0, default: 0 },
    maximumDiscount: { type: Number, min: 0 }, // paise cap for percent coupons
    startDate: Date,
    expiryDate: Date,
    usageLimit: { type: Number, min: 0 }, // total redemptions; empty = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    perCustomerLimit: { type: Number, min: 0, default: 1 }, // 0 = unlimited
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

export type CouponDoc = InferSchemaType<typeof CouponSchema> & { _id: Types.ObjectId; createdAt: Date };
export const Coupon: Model<CouponDoc> = (models.Coupon as Model<CouponDoc>) || model<CouponDoc>("Coupon", CouponSchema);
