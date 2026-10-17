import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

export const ADMIN_ROLES = ["owner", "admin", "manager", "staff"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

const AdminUserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 200 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ADMIN_ROLES, required: true, default: "staff" },
    status: { type: String, enum: ["active", "disabled"], default: "active" },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
    lastLoginAt: Date,
    passwordChangedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
  },
  { timestamps: true },
);

export type AdminUserDoc = InferSchemaType<typeof AdminUserSchema> & { _id: Types.ObjectId };
export const AdminUser: Model<AdminUserDoc> =
  (models.AdminUser as Model<AdminUserDoc>) || model<AdminUserDoc>("AdminUser", AdminUserSchema);
