import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";

/**
 * OTP challenge. The code itself is never stored — only an HMAC keyed with
 * AUTH_SECRET. Managed providers (Twilio Verify) keep the code on their side and
 * `otpHash` is empty. Records auto-expire 24h after creation (TTL index) and are
 * kept that long only to enforce daily rate limits.
 */
const OtpChallengeSchema = new Schema({
  phoneNumber: { type: String, required: true },
  otpHash: { type: String, default: "" },
  provider: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  attemptCount: { type: Number, default: 0 },
  maxAttempts: { type: Number, default: 5 },
  resendAfter: { type: Date, required: true },
  consumedAt: Date,
  invalidatedAt: Date,
  ip: String,
  createdAt: { type: Date, default: () => new Date() },
});
OtpChallengeSchema.index({ phoneNumber: 1, createdAt: -1 });
OtpChallengeSchema.index({ ip: 1, createdAt: -1 });
OtpChallengeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });

export type OtpChallengeDoc = InferSchemaType<typeof OtpChallengeSchema> & { _id: Types.ObjectId };
export const OtpChallenge: Model<OtpChallengeDoc> =
  (models.OtpChallenge as Model<OtpChallengeDoc>) || model<OtpChallengeDoc>("OtpChallenge", OtpChallengeSchema);
