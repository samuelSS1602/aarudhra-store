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

export async function verifyFirebasePhoneToken(idToken: string): Promise<{ phoneNumber: string; uid: string }> {
  const projectId = getEnv().NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new AppError(503, "NOT_CONFIGURED", "Phone sign-in is not configured.");
  const invalid = () => new AppError(401, "INVALID_TOKEN", "Phone verification failed. Please request a new OTP.");

  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, jwks, {
      algorithms: ["RS256"],
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      maxTokenAge: "10 minutes", // only accept a freshly completed OTP sign-in
      clockTolerance: 30,
    }));
  } catch {
    throw invalid();
  }

  const authTime = typeof payload.auth_time === "number" ? payload.auth_time : 0;
  const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
  const phone = typeof payload.phone_number === "string" ? payload.phone_number : "";
  if (!payload.sub || authTime * 1000 > Date.now() + 30_000 || firebase?.sign_in_provider !== "phone" || !phone) {
    throw invalid();
  }
  return { phoneNumber: phone, uid: payload.sub };
}
