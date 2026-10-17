import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { resetEnvCache } from "@/lib/env";
import { setFirebaseKeysForTests } from "@/lib/firebase-verify";
import { User } from "@/models/User";
import { POST as firebaseRoute } from "@/app/api/auth/firebase/route";
import { POST as otpRequestRoute } from "@/app/api/auth/otp/request/route";
import { checkoutInput, makeProduct, noParams, request } from "./helpers";
import { createOrder } from "@/services/orders.service";
import { getCustomerFromToken, createCustomerSession } from "@/lib/auth/session";

const PROJECT = "aarudhra-test";
let privateKey: CryptoKey;
let otherKey: CryptoKey;
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const k of ["SMS_PROVIDER", "LOGIN_METHODS", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID"]) saved[k] = process.env[k];
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

type Claims = Partial<{ aud: string; iss: string; phone: string | null; provider: string; authTime: number; iat: number; key: CryptoKey; email: string; emailVerified: boolean; name: string; sub: string }>;

async function token(c: Claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {
    auth_time: c.authTime ?? now,
    firebase: { sign_in_provider: c.provider ?? "phone", identities: {} },
  };
  if (c.provider === "google.com") {
    payload.email = c.email ?? "shopper@gmail.com";
    payload.email_verified = c.emailVerified ?? true;
    payload.name = c.name ?? "Priya Shopper";
  } else if (c.phone !== null) payload.phone_number = c.phone ?? "+919876543210";
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: "test-kid" })
    .setIssuer(c.iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(c.aud ?? PROJECT)
    .setSubject(c.sub ?? "firebase-uid-123")
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


describe("Google sign-in", () => {
  const withMethods = (m: string) => {
    process.env.LOGIN_METHODS = m;
    resetEnvCache();
  };
  afterAll(() => withMethods("phone"));

  it("creates a customer from a verified Google account (no phone needed)", async () => {
    withMethods("google");
    const res = await signIn(await token({ provider: "google.com", sub: "g-1", email: "Priya@Gmail.com" }));
    expect(res.status).toBe(200);
    const u = await User.findOne({ firebaseUid: "g-1" }).lean();
    expect(u).toMatchObject({ email: "priya@gmail.com", name: "Priya Shopper", authProvider: "google" });
    expect(u?.phoneNumber).toBeUndefined();
    // A second phone-less Google customer must not collide on the phone index.
    expect((await signIn(await token({ provider: "google.com", sub: "g-2", email: "ravi@gmail.com" }))).status).toBe(200);
    expect(await User.countDocuments({ authProvider: "google" })).toBe(2);
    // Signing in again reuses the same account.
    await signIn(await token({ provider: "google.com", sub: "g-1", email: "priya@gmail.com" }));
    expect(await User.countDocuments({ firebaseUid: "g-1" })).toBe(1);
  });

  it("rejects Google accounts whose email is not verified", async () => {
    withMethods("google");
    expect((await signIn(await token({ provider: "google.com", emailVerified: false }))).status).toBe(401);
  });

  it("refuses Google sign-in when it is turned off, and phone sign-in when only Google is on", async () => {
    withMethods("phone");
    expect((await signIn(await token({ provider: "google.com" }))).status).toBe(400);
    withMethods("google");
    expect((await signIn(await token()))).toHaveProperty("status", 400);
  });

  it("links an existing account with the same email on first Google sign-in", async () => {
    withMethods("google,phone");
    const existing = await User.create({ phoneNumber: "+919811122233", phoneVerified: true, email: "link@gmail.com", name: "Existing" });
    expect((await signIn(await token({ provider: "google.com", sub: "g-link", email: "link@gmail.com" }))).status).toBe(200);
    const u = await User.findById(existing._id).lean();
    expect(u?.firebaseUid).toBe("g-link");
    expect(u?.phoneNumber).toBe("+919811122233");
    expect(await User.countDocuments()).toBe(1);
  });

  it("lets a Google customer check out; the delivery phone is used and remembered", async () => {
    withMethods("google");
    await signIn(await token({ provider: "google.com", sub: "g-buyer", email: "buyer@gmail.com" }));
    const user = await User.findOne({ firebaseUid: "g-buyer" }).lean();
    const { token: sessionToken } = await createCustomerSession(user!._id, {});
    const customer = (await getCustomerFromToken(sessionToken))!;
    expect(customer.phoneNumber).toBeNull();
    const p = await makeProduct({ stock: 5 });
    const { order } = await createOrder(customer, checkoutInput([{ productId: String(p._id), quantity: 1 }], { address: { ...checkoutInput([]).address, phone: "9840012345" } }));
    expect(order.customerSnapshot?.phone).toBe("+919840012345");
    expect(order.customerSnapshot?.email).toBe("buyer@gmail.com");
    expect((await User.findById(user!._id).lean())?.contactPhone).toBe("+919840012345");
  });
});
