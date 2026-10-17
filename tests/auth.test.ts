import { afterEach, describe, expect, it } from "vitest";
import { setOtpProviderForTests, SmsProviderError, type OtpProvider } from "@/lib/sms";
import { requestOtp, verifyOtp } from "@/services/auth.service";
import { OtpChallenge } from "@/models/OtpChallenge";
import { User } from "@/models/User";
import { POST as verifyRoute } from "@/app/api/auth/otp/verify/route";
import { POST as requestRoute } from "@/app/api/auth/otp/request/route";
import { GET as meRoute } from "@/app/api/auth/me/route";
import { POST as createProductRoute } from "@/app/api/admin/products/route";
import { PATCH as settingsRoute } from "@/app/api/admin/settings/route";
import { POST as adminLoginRoute } from "@/app/api/admin/auth/login/route";
import { adminCookie, customerCookie, makeAdmin, makeCustomer, noParams, request } from "./helpers";

/** Captures codes instead of sending SMS. */
function captureProvider() {
  const sent: { phone: string; code: string | null }[] = [];
  const p: OtpProvider = { name: "test", managed: false, send: async (phone, code) => void sent.push({ phone, code }) };
  setOtpProviderForTests(p);
  return sent;
}

afterEach(() => setOtpProviderForTests(null));

const PHONE = "98765 43210";
const E164 = "+919876543210";

describe("OTP request", () => {
  it("normalizes the phone, stores only a hash and sends the code", async () => {
    const sent = captureProvider();
    const res = await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    expect(res.phoneNumber).toBe(E164);
    expect(sent).toHaveLength(1);
    const code = sent[0]!.code!;
    expect(code).toMatch(/^\d{6}$/);
    const ch = await OtpChallenge.findOne({ phoneNumber: E164 }).lean();
    expect(ch?.otpHash).toBeTruthy();
    expect(ch?.otpHash).not.toContain(code);
    expect(JSON.stringify(ch)).not.toContain(`"${code}"`);
  });

  it("rejects invalid phone numbers", async () => {
    captureProvider();
    await expect(requestOtp({ phone: "12345", ip: "1.1.1.1" })).rejects.toMatchObject({ status: 400, code: "INVALID_PHONE" });
    await expect(requestOtp({ phone: "0441234567", ip: "1.1.1.1" })).rejects.toMatchObject({ status: 400 }); // landline
  });

  it("enforces the resend cooldown", async () => {
    captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    await expect(requestOtp({ phone: PHONE, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 429 });
  });

  it("rate-limits OTP requests per phone number", async () => {
    captureProvider();
    for (let i = 0; i < 5; i++) {
      await requestOtp({ phone: PHONE, ip: `10.0.0.${i}` });
      await OtpChallenge.updateMany({}, { $set: { resendAfter: new Date(0) } }); // skip cooldown
    }
    await expect(requestOtp({ phone: PHONE, ip: "10.0.0.99" })).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });

  it("never pretends an OTP was sent when the provider fails", async () => {
    setOtpProviderForTests({ name: "broken", managed: false, send: async () => { throw new SmsProviderError("down", "broken"); } });
    await expect(requestOtp({ phone: PHONE, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 502, code: "OTP_SEND_FAILED" });
    const ch = await OtpChallenge.findOne({ phoneNumber: E164 }).lean();
    expect(ch?.invalidatedAt).toBeTruthy();
  });

  it("does not expose dev codes through the API response in production-like mode", async () => {
    captureProvider();
    const res = await requestRoute(request("/api/auth/otp/request", { body: { phone: PHONE } }), noParams);
    const body = await res.json();
    expect(res.status).toBe(200);
    // Test provider is not the console provider; the code is never echoed back.
    expect(body.devCode).toBeUndefined();
  });

  it("isolates the dev console provider: code shown in development, refused in production", async () => {
    setOtpProviderForTests(null); // SMS_PROVIDER=console in the test env
    const res = await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    expect(res.devCode).toMatch(/^\d{6}$/);

    const { getOtpProvider } = await import("@/lib/sms");
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string>).NODE_ENV = "production";
    try {
      await expect(getOtpProvider().send(E164, "123456", 5)).rejects.toThrow(/disabled in production/);
    } finally {
      (process.env as Record<string, string>).NODE_ENV = prev!;
    }
  });
});

describe("OTP verification", () => {
  it("verifies a valid OTP, creates the customer and sets a session cookie", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    const res = await verifyRoute(request("/api/auth/otp/verify", { body: { phone: PHONE, code: sent[0]!.code } }), noParams);
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/aas_session=/);
    expect(cookie.toLowerCase()).toContain("httponly");
    expect(cookie.toLowerCase()).toContain("samesite=lax");
    const user = await User.findOne({ phoneNumber: E164 }).lean();
    expect(user?.phoneVerified).toBe(true);
    expect(user?.role).toBe("customer");

    const token = cookie.split(";")[0]!;
    const me = await meRoute(request("/api/auth/me", { cookie: token }), noParams);
    expect((await me.json()).user.phoneNumber).toBe(E164);
  });

  it("rejects an invalid OTP and counts attempts", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    const wrong = sent[0]!.code === "000000" ? "111111" : "000000";
    await expect(verifyOtp({ phone: PHONE, code: wrong, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 400, code: "OTP_INCORRECT", details: { attemptsRemaining: 4 } });
  });

  it("locks the challenge after the maximum number of attempts (brute-force protection)", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    const wrong = sent[0]!.code === "000000" ? "111111" : "000000";
    for (let i = 0; i < 4; i++) await expect(verifyOtp({ phone: PHONE, code: wrong, ip: "1.1.1.1" })).rejects.toMatchObject({ code: "OTP_INCORRECT" });
    await expect(verifyOtp({ phone: PHONE, code: wrong, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 429 });
    // Even the correct code no longer works.
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" })).rejects.toMatchObject({ status: expect.any(Number) });
  });

  it("rejects an expired OTP", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    await OtpChallenge.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 400, code: "OTP_EXPIRED" });
  });

  it("prevents OTP reuse", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    await verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" })).rejects.toMatchObject({ code: "OTP_EXPIRED" });
  });

  it("only the newest OTP is valid after a resend", async () => {
    const sent = captureProvider();
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    await OtpChallenge.updateMany({}, { $set: { resendAfter: new Date(0) } });
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    if (sent[0]!.code !== sent[1]!.code) {
      await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" })).rejects.toMatchObject({ code: "OTP_INCORRECT" });
    }
    await expect(verifyOtp({ phone: PHONE, code: sent[1]!.code!, ip: "1.1.1.1" })).resolves.toBeTruthy();
  });

  it("blocks suspended accounts", async () => {
    const sent = captureProvider();
    await User.create({ phoneNumber: E164, accountStatus: "suspended" });
    await requestOtp({ phone: PHONE, ip: "1.1.1.1" });
    await expect(verifyOtp({ phone: PHONE, code: sent[0]!.code!, ip: "1.1.1.1" })).rejects.toMatchObject({ status: 403 });
  });
});

describe("Admin authorization", () => {
  const productBody = { name: "X", sku: "X-1", categoryId: "0".repeat(24), price: 10 };

  it("rejects admin APIs without a staff session", async () => {
    const res = await createProductRoute(request("/api/admin/products", { body: productBody }), noParams);
    expect(res.status).toBe(401);
  });

  it("rejects customers calling admin APIs, even with a valid customer session", async () => {
    const c = await makeCustomer();
    const res = await createProductRoute(request("/api/admin/products", { body: productBody, cookie: await customerCookie(c.id) }), noParams);
    expect(res.status).toBe(401);
  });

  it("enforces role permissions server-side", async () => {
    const staff = await makeAdmin("staff");
    const res = await createProductRoute(request("/api/admin/products", { body: productBody, cookie: await adminCookie(staff.id) }), noParams);
    expect(res.status).toBe(403);

    const manager = await makeAdmin("manager");
    const s = await settingsRoute(
      request("/api/admin/settings", { method: "PATCH", body: { section: "notifications", data: {} }, cookie: await adminCookie(manager.id) }),
      noParams,
    );
    expect([400, 403]).toContain(s.status); // validation or permission — never 200
  });

  it("rejects wrong admin passwords and locks after repeated failures", async () => {
    const a = await makeAdmin("owner", "owner@store.test", "Correct-Horse-9-Battery");
    void a;
    for (let i = 0; i < 5; i++) {
      const r = await adminLoginRoute(request("/api/admin/auth/login", { body: { email: "owner@store.test", password: "wrong-password" } }), noParams);
      expect(r.status).toBe(401);
    }
    const locked = await adminLoginRoute(request("/api/admin/auth/login", { body: { email: "owner@store.test", password: "Correct-Horse-9-Battery" } }), noParams);
    expect(locked.status).toBe(423);
  });

  it("issues an HTTP-only admin session for valid credentials", async () => {
    await makeAdmin("owner", "boss@store.test", "Correct-Horse-9-Battery");
    const r = await adminLoginRoute(request("/api/admin/auth/login", { body: { email: "boss@store.test", password: "Correct-Horse-9-Battery" } }), noParams);
    expect(r.status).toBe(200);
    expect((r.headers.get("set-cookie") ?? "").toLowerCase()).toContain("httponly");
  });
});
