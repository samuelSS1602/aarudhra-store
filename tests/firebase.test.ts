import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { resetEnvCache } from "@/lib/env";
import { setFirebaseKeysForTests } from "@/lib/firebase-verify";
import { User } from "@/models/User";
import { POST as firebaseRoute } from "@/app/api/auth/firebase/route";
import { POST as otpRequestRoute } from "@/app/api/auth/otp/request/route";
import { noParams, request } from "./helpers";

const PROJECT = "aarudhra-test";
let privateKey: CryptoKey;
let otherKey: CryptoKey;
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const k of ["SMS_PROVIDER", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) saved[k] = process.env[k];
  Object.assign(process.env, {
    SMS_PROVIDER: "firebase",
    NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: `${PROJECT}.firebaseapp.com`,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: PROJECT,
  });
  resetEnvCache();
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  otherKey = (await generateKeyPair("RS256")).privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "test-kid", alg: "RS256", use: "sig" };
  setFirebaseKeysForTests(createLocalJWKSet({ keys: [jwk] }));
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  resetEnvCache();
  setFirebaseKeysForTests(null);
});

type Claims = Partial<{ aud: string; iss: string; phone: string | null; provider: string; authTime: number; iat: number; key: CryptoKey }>;

async function token(c: Claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    auth_time: c.authTime ?? now,
    firebase: { sign_in_provider: c.provider ?? "phone", identities: {} },
  };
  if (c.phone !== null) payload.phone_number = c.phone ?? "+919876543210";
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(c.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(c.aud ?? PROJECT)
    .setSubject("firebase-uid-123")
    .setIssuedAt(c.iat ?? now)
    .setExpirationTime((c.iat ?? now) + 3600)
    .sign(c.key ?? privateKey);
}

const signIn = async (idToken: string) => firebaseRoute(request("/api/auth/firebase", { body: { idToken } }), noParams);

describe("Firebase phone sign-in", () => {
  it("exchanges a valid Firebase phone token for a store session", async () => {
    const res = await signIn(await token());
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie") ?? "").toMatch(/aas_session=.*HttpOnly/i);
    const user = await User.findOne({ phoneNumber: "+919876543210" }).lean();
    expect(user?.phoneVerified).toBe(true);
  });

  it("rejects tokens signed with the wrong key", async () => {
    expect((await signIn(await token({ key: otherKey }))).status).toBe(401);
  });

  it("rejects tokens for another Firebase project", async () => {
    expect((await signIn(await token({ aud: "someone-else" }))).status).toBe(401);
    expect((await signIn(await token({ iss: "https://securetoken.google.com/someone-else" }))).status).toBe(401);
  });

  it("rejects non-phone sign-ins and tokens without a phone number", async () => {
    expect((await signIn(await token({ provider: "password" }))).status).toBe(401);
    expect((await signIn(await token({ phone: null }))).status).toBe(401);
  });

  it("rejects stale tokens (sign-in must be fresh)", async () => {
    const old = Math.floor(Date.now() / 1000) - 30 * 60;
    expect((await signIn(await token({ iat: old, authTime: old }))).status).toBe(401);
  });

  it("blocks suspended accounts", async () => {
    await User.create({ phoneNumber: "+919876543210", accountStatus: "suspended" });
    expect((await signIn(await token())).status).toBe(403);
  });

  it("disables the server OTP endpoints while Firebase is active", async () => {
    const res = await otpRequestRoute(request("/api/auth/otp/request", { body: { phone: "9876543210" } }), noParams);
    expect(res.status).toBe(400);
  });
});
