import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";

/**
 * Verifies a Firebase Authentication ID token (RS256) against Google's published
 * keys, per https://firebase.google.com/docs/auth/admin/verify-id-tokens — without
 * the Admin SDK or a service-account key.
 */
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

let jwks: JWTVerifyGetKey = createRemoteJWKSet(new URL(JWKS_URL), { cacheMaxAge: 6 * 60 * 60 * 1000 });

/** Tests only. */
export function setFirebaseKeysForTests(keys: JWTVerifyGetKey | null) {
  jwks = keys ?? createRemoteJWKSet(new URL(JWKS_URL));
}

export type FirebaseIdentity =
  | { provider: "phone"; uid: string; phoneNumber: string }
  | { provider: "google"; uid: string; email: string; name: string };

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseIdentity> {
  const projectId = getEnv().NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new AppError(503, "NOT_CONFIGURED", "Sign-in is not configured.");
  const invalid = () => new AppError(401, "INVALID_TOKEN", "Sign-in could not be verified. Please try again.");

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      maxTokenAge: "10 minutes", // only accept a freshly completed sign-in
      clockTolerance: 30,
    }));
  } catch {
    throw invalid();
  }

  const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
  if (!payload.sub || authTime * 1000 > Date.now() + 30_000) throw invalid();
  const signInProvider = (payload.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider;

  if (signInProvider === "phone") {
    const phone = typeof payload.phone_number === "string" ? payload.phone_number : "";
    if (!phone) throw invalid();
    return { provider: "phone", uid: payload.sub, phoneNumber: phone };
  }

  if (signInProvider === "google.com") {
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    // Only accept Google accounts whose email Google itself has verified.
    if (!email || payload.email_verified !== true) throw invalid();
    const name = typeof payload.name === "string" ? payload.name.slice(0, 100) : "";
    return { provider: "google", uid: payload.sub, email, name };
  }

  throw invalid();
}

/** Back-compat helper for phone-only callers. */
export async function verifyFirebasePhoneToken(idToken: string) {
  const id = await verifyFirebaseToken(idToken);
  if (id.provider !== "phone") throw new AppError(401, "INVALID_TOKEN", "Sign-in could not be verified. Please try again.");
  return { phoneNumber: id.phoneNumber, uid: id.uid };
}
