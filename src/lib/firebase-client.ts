"use client";

import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";

export type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId?: string };

/**
 * Firebase Phone Auth for the login page. The SDK is imported lazily so it never
 * weighs down other pages. Firebase sends the SMS, enforces code expiry/attempts and
 * runs invisible reCAPTCHA; we only keep its ID token long enough to exchange it for
 * the store's own session.
 */
async function getAuthInstance(config: FirebaseWebConfig) {
  const [{ initializeApp, getApps }, { getAuth }] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  auth.languageCode = "en";
  return auth;
}

let verifier: RecaptchaVerifier | null = null;

export async function sendFirebaseOtp(config: FirebaseWebConfig, phoneE164: string, recaptchaContainerId: string): Promise<ConfirmationResult> {
  const auth = await getAuthInstance(config);
  const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
  if (!verifier) verifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: "invisible" });
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (err) {
    // A used/expired reCAPTCHA must be recreated before the next attempt.
    verifier.clear();
    verifier = null;
    throw err;
  }
}

export async function confirmFirebaseOtp(confirmation: ConfirmationResult, code: string, config: FirebaseWebConfig): Promise<string> {
  const cred = await confirmation.confirm(code);
  const idToken = await cred.user.getIdToken();
  // The store uses its own session cookie; drop the Firebase browser session.
  const auth = await getAuthInstance(config);
  await auth.signOut().catch(() => undefined);
  return idToken;
}

/** Maps Firebase error codes to friendly messages. */
export function firebaseErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/invalid-phone-number": "Please enter a valid 10-digit mobile number.",
    "auth/too-many-requests": "Too many attempts. Please wait a while and try again.",
    "auth/quota-exceeded": "OTP service is busy right now. Please try again later.",
    "auth/invalid-verification-code": "Incorrect OTP. Please check the code and try again.",
    "auth/code-expired": "This OTP has expired. Please request a new one.",
    "auth/missing-verification-code": "Enter the 6-digit code.",
    "auth/captcha-check-failed": "Security check failed. Please refresh the page and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "Phone sign-in is not enabled for this store yet.",
    "auth/billing-not-enabled": "Phone sign-in is not enabled for this store yet.",
    "auth/unauthorized-domain": "This website address is not authorised for phone sign-in.",
  };
  return map[code] ?? "We couldn't complete phone verification. Please try again.";
}
