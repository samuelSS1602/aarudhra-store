import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/** Customer sessions. Only an HMAC of the cookie token is stored. */
const SessionSchema = new Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true },
    lastSeenAt: { type: Date, default: () => new Date() },
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = InferSchemaType<typeof SessionSchema> & { _id: Types.ObjectId };
export const Session: Model<SessionDoc> =
  (models.Session as Model<SessionDoc>) || model<SessionDoc>("Session", SessionSchema);
