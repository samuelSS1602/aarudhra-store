import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const AddressSchema = new Schema(
  {
    label: { type: String, trim: true, maxlength: 40, default: "Home" },
    fullName: { type: String, required: true, trim: true, maxlength: 100 },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200, default: "" },
    landmark: { type: String, trim: true, maxlength: 120, default: "" },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    district: { type: String, required: true, trim: true, maxlength: 80 },
    state: { type: String, required: true, trim: true, maxlength: 80 },
    pincode: { type: String, required: true, trim: true, match: /^[1-9][0-9]{5}$/ },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const NoteSchema = new Schema(
  {
    note: { type: String, required: true, maxlength: 2000 },
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    adminName: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

const UserSchema = new Schema(
  {
    name: { type: String, trim: true, maxlength: 100, default: "" },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
    email: { type: String, trim: true, lowercase: true, maxlength: 200 },
    // Customer accounts only. Staff live in AdminUser and never authenticate via SMS OTP.
    // The field is immutable and never accepted from request bodies.
    role: { type: String, enum: ["customer"], default: "customer", immutable: true },
    addresses: { type: [AddressSchema], default: [] },
    wishlist: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    accountStatus: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    preferences: {
      whatsappOrderUpdates: { type: Boolean, default: false },
      marketingOptIn: { type: Boolean, default: false },
    },
    internalNotes: { type: [NoteSchema], default: [] },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ name: 1 });

export type UserDoc = InferSchemaType<typeof UserSchema> & { _id: Types.ObjectId };
export const User: Model<UserDoc> = (models.User as Model<UserDoc>) || model<UserDoc>("User", UserSchema);
