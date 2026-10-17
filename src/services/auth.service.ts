import "server-only";
import { connectDB } from "@/lib/mongodb";
import { getEnv, isOtpDevMode } from "@/lib/env";
import { verifyFirebasePhoneToken } from "@/lib/firebase-verify";
import { normalizePhone } from "@/lib/phone";
import { hmacHash, randomNumericCode, safeEqual } from "@/lib/security/crypto";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AppError, badRequest, forbidden, tooManyRequests } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getOtpProvider, SmsProviderError } from "@/lib/sms";
import { OtpChallenge } from "@/models/OtpChallenge";
import { User } from "@/models/User";

export const OTP_LENGTH = 6;
export const OTP_TTL_MINUTES = 5;
export const OTP_RESEND_SECONDS = 45;
export const OTP_MAX_ATTEMPTS = 5;
const OTP_MAX_PER_PHONE_PER_DAY = 10;

const hashOtp = (phone: string, code: string) => hmacHash(`otp:${phone}:${code}`, getEnv().AUTH_SECRET);

function requirePhone(input: string): string {
  const phone = normalizePhone(input);
  if (!phone) throw new AppError(400, "INVALID_PHONE", "Please enter a valid 10-digit mobile number.");
  return phone;
}

export type OtpRequestResult = {
  phoneNumber: string;
  expiresInSeconds: number;
  resendInSeconds: number;
  /** Only ever present in local development with the console provider / OTP_DEV_MODE. */
  devCode?: string;
};

function assertServerOtp() {
  // With Firebase, the browser talks to Firebase directly; these endpoints are unused.
  if (getEnv().SMS_PROVIDER === "firebase") throw badRequest("Phone sign-in uses Firebase on this store. Please refresh the page.");
}

export async function requestOtp(input: { phone: string; ip: string }): Promise<OtpRequestResult> {
  assertServerOtp();
  const phone = requirePhone(input.phone);
  await connectDB();

  // Abuse prevention: per IP, per phone (short window) and per phone (daily).
  await enforceRateLimit(`otp:req:ip:${input.ip}`, 15, 60 * 60, "Too many OTP requests from this network. Please try later.");
  await enforceRateLimit(`otp:req:phone:${phone}`, 5, 60 * 60, "Too many OTP requests for this number. Please try later.");
  const sentToday = await OtpChallenge.countDocuments({
    phoneNumber: phone,
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
  });
  if (sentToday >= OTP_MAX_PER_PHONE_PER_DAY) throw tooManyRequests("Daily OTP limit reached for this number. Please try tomorrow.");

  const now = new Date();
  const latest = await OtpChallenge.findOne({ phoneNumber: phone }).sort({ createdAt: -1 }).lean();
  if (latest && !latest.consumedAt && !latest.invalidatedAt && latest.resendAfter > now) {
    const wait = Math.ceil((latest.resendAfter.getTime() - now.getTime()) / 1000);
    throw tooManyRequests(`Please wait ${wait}s before requesting a new OTP.`, wait);
  }

  const provider = getOtpProvider();
  const code = provider.managed ? null : randomNumericCode(OTP_LENGTH);

  // Only one live challenge per phone number.
  await OtpChallenge.updateMany(
    { phoneNumber: phone, consumedAt: { $exists: false }, invalidatedAt: { $exists: false } },
    { $set: { invalidatedAt: now } },
  );

  const challenge = await OtpChallenge.create({
    phoneNumber: phone,
    otpHash: code ? hashOtp(phone, code) : "",
    provider: provider.name,
    expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000),
    resendAfter: new Date(now.getTime() + OTP_RESEND_SECONDS * 1000),
    maxAttempts: OTP_MAX_ATTEMPTS,
    ip: input.ip,
  });

  try {
    await provider.send(phone, code, OTP_TTL_MINUTES);
  } catch (err) {
    // Never pretend the OTP was sent. Invalidate the challenge but keep it for rate limiting.
    await OtpChallenge.updateOne({ _id: challenge._id }, { $set: { invalidatedAt: new Date() } });
    logger.error("OTP delivery failed", {
      provider: provider.name,
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof SmsProviderError || err instanceof Error) {
      throw new AppError(502, "OTP_SEND_FAILED", "We couldn't send the OTP right now. Please try again in a minute.");
    }
    throw err;
  }

  return {
    phoneNumber: phone,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
    resendInSeconds: OTP_RESEND_SECONDS,
    // Only the dev console provider (never available in production) echoes the code back.
    ...(provider.name === "console" && isOtpDevMode() && code ? { devCode: code } : {}),
  };
}

export async function verifyOtp(input: { phone: string; code: string; ip: string }) {
  assertServerOtp();
  const phone = requirePhone(input.phone);
  const code = input.code.trim();
  if (!/^\d{4,8}$/.test(code)) throw badRequest("Enter the 6-digit code sent to your phone.");
  await connectDB();

  await enforceRateLimit(`otp:verify:ip:${input.ip}`, 40, 60 * 60, "Too many attempts. Please try again later.");

  const now = new Date();
  // Atomically claim an attempt so concurrent guesses can't exceed maxAttempts.
  const challenge = await OtpChallenge.findOneAndUpdate(
    {
      phoneNumber: phone,
      consumedAt: { $exists: false },
      invalidatedAt: { $exists: false },
      expiresAt: { $gt: now },
      $expr: { $lt: ["$attemptCount", "$maxAttempts"] },
    },
    { $inc: { attemptCount: 1 } },
    { new: true, sort: { createdAt: -1 } },
  );

  if (!challenge) {
    const exhausted = await OtpChallenge.exists({
      phoneNumber: phone,
      consumedAt: { $exists: false },
      invalidatedAt: { $exists: false },
      expiresAt: { $gt: now },
    });
    if (exhausted) throw tooManyRequests("Too many incorrect attempts. Please request a new OTP.");
    throw new AppError(400, "OTP_EXPIRED", "This OTP has expired or is no longer valid. Please request a new one.");
  }

  let valid = false;
  const provider = getOtpProvider();
  if (challenge.otpHash) {
    valid = safeEqual(challenge.otpHash, hashOtp(phone, code));
  } else if (provider.managed && provider.verify && provider.name === challenge.provider) {
    try {
      valid = await provider.verify(phone, code);
    } catch (err) {
      logger.error("OTP verification provider error", { error: err instanceof Error ? err.message : String(err) });
      throw new AppError(502, "OTP_VERIFY_FAILED", "We couldn't verify the OTP right now. Please try again.");
    }
  }

  if (!valid) {
    const remaining = Math.max(0, challenge.maxAttempts - challenge.attemptCount);
    if (remaining === 0) {
      await OtpChallenge.updateOne({ _id: challenge._id }, { $set: { invalidatedAt: new Date() } });
      throw tooManyRequests("Too many incorrect attempts. Please request a new OTP.");
    }
    throw new AppError(400, "OTP_INCORRECT", `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`, {
      attemptsRemaining: remaining,
    });
  }

  // One-time consumption: only the first concurrent verifier wins.
  const consumed = await OtpChallenge.updateOne(
    { _id: challenge._id, consumedAt: { $exists: false } },
    { $set: { consumedAt: new Date() } },
  );
  if (consumed.modifiedCount !== 1) {
    throw new AppError(400, "OTP_EXPIRED", "This OTP has already been used. Please request a new one.");
  }

  return signInVerifiedPhone(phone);
}

/** Creates or loads the customer for a phone number that has just been verified. */
async function signInVerifiedPhone(phone: string) {
  const user = await User.findOneAndUpdate(
    { phoneNumber: phone },
    { $setOnInsert: { phoneNumber: phone }, $set: { phoneVerified: true, lastLoginAt: new Date() } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  if (user.accountStatus !== "active") throw forbidden("This account has been suspended. Please contact the store.");
  const isNew = Math.abs(user.createdAt.getTime() - Date.now()) < 5000 && !user.name;
  return { user, isNew };
}

/**
 * Firebase Phone Auth: the browser completes the SMS OTP with Firebase (which
 * enforces expiry, attempts and reCAPTCHA) and sends us the resulting ID token.
 * We verify its signature, audience, freshness and that it came from phone sign-in.
 */
export async function signInWithFirebaseToken(input: { idToken: string; ip: string }) {
  if (getEnv().SMS_PROVIDER !== "firebase") throw badRequest("Firebase sign-in is not enabled.");
  await connectDB();
  await enforceRateLimit(`firebase:verify:ip:${input.ip}`, 40, 60 * 60, "Too many attempts. Please try again later.");
  const { phoneNumber } = await verifyFirebasePhoneToken(input.idToken);
  const phone = normalizePhone(phoneNumber);
  if (!phone) throw new AppError(400, "INVALID_PHONE", "This phone number is not supported.");
  return signInVerifiedPhone(phone);
}
