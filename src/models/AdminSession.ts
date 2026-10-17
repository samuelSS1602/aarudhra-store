import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/** Staff sessions: absolute expiry plus an idle timeout, stored as token HMACs. */
const AdminSessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    expiresAt: { type: Date, required: true },
    idleExpiresAt: { type: Date, required: true },
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
AdminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type AdminSessionDoc = InferSchemaType<typeof AdminSessionSchema> & { _id: Types.ObjectId };
export const AdminSession: Model<AdminSessionDoc> =
  (models.AdminSession as Model<AdminSessionDoc>) || model<AdminSessionDoc>("AdminSession", AdminSessionSchema);
