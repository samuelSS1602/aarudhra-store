# Admin Password Reset with Google: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Forgot password?" option on `/admin/login`. The admin verifies with Google that they own the staff email, sets a new password, and is signed in.

**Architecture:** The browser gets a Google ID token through the existing Firebase popup helper. One new API route verifies the token with the existing `verifyFirebaseToken`, matches an active staff account by email, sets the password, revokes old sessions, audits the change, and issues a fresh admin session cookie. The login form gains a two-step reset view.

**Tech Stack:** Next.js 15 (App Router), React 19, Mongoose, Zod 3, Firebase Auth (client), jose (server JWT verify), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-admin-google-password-reset-design.md`

## Global Constraints

- Password rule: reuse `passwordSchema` from `src/lib/validation/schemas.ts` (12+ characters, upper- and lower-case letters, a number). Don't write a new rule.
- Google tokens are verified only by `verifyFirebaseToken` in `src/lib/firebase-verify.ts`. It already enforces Google-verified email and a 10-minute token age.
- Only an **active** `AdminUser` whose `email` equals the Google email may reset. Customers (`User`) are never consulted.
- Non-matching or disabled accounts get the same 403 message: `This Google account (<email>) isn't linked to a staff account. Choose the Google account that uses your staff email.`
- Audit action name: `admin.password_reset_google`.
- Popup only. No redirect fallback.
- If Firebase isn't configured, the "Forgot password?" link is not rendered.
- Do not commit. The user commits on request only, and the working tree already holds uncommitted username-login work. Leave all changes uncommitted.

## Review Focus

1. **The user lingers on step 2 for more than 10 minutes:** the token is stale and the server returns 401 `INVALID_TOKEN`. The UI must drop back to step 1 with "Google verification expired. Verify with Google again.", not show a dead end. (Server test in Task 1; UI behaviour in Task 2.)
2. **The account is locked after 5 failed sign-ins:** the reset must still work and must clear `lockedUntil` and `failedLoginCount`. (Test in Task 1.)
3. **Google returns the email in different case** (`Shop@Store.Test`): it still matches the stored lower-case email. (Test in Task 1.)
4. **The Google email is not verified** (`email_verified: false`): reject with 401 and change nothing. (Test in Task 1.)
5. **The popup is blocked or closed:** show a friendly message. Add `auth/popup-blocked` → `"Your browser blocked the Google window. Allow pop-ups for this site and try again."` to `firebaseErrorMessage`. (Task 2, checked manually.)

---

### Task 1: Reset API (server + tests)

**Files:**
- Modify: `src/lib/validation/schemas.ts`. Add `adminGoogleResetSchema` next to `adminCreateSchema` (after `passwordSchema`).
- Modify: `src/services/admin-users.service.ts`. Add `resetAdminPasswordWithGoogle`.
- Create: `src/app/api/admin/auth/reset-password/route.ts`
- Test: `tests/firebase.test.ts`. Add a new `describe("Admin password reset with Google")` block that reuses the file's existing `token()` helper and key setup.

**Interfaces:**
- Consumes: `verifyFirebaseToken(idToken): Promise<FirebaseIdentity>`, `hashPassword`, `revokeAdminSessions(adminId)`, `createAdminSession(adminId, { ip, userAgent })`, `setSessionCookie(res, ADMIN_COOKIE, token, maxAge)`, `audit(actor, action, resourceType, resourceId, metadata)`, `enforceRateLimit(key, limit, windowSeconds, message)`, `forbidden(message)`.
- Produces:
  - `adminGoogleResetSchema = z.object({ idToken: z.string().min(100).max(4096), password: passwordSchema })`
  - `resetAdminPasswordWithGoogle(input: { idToken: string; password: string; ip: string }): Promise<HydratedDocument<AdminUserDoc>>`
  - `POST /api/admin/auth/reset-password` with body `{ idToken, password }`. Returns 200 `{ ok: true, admin: { name, role } }` and sets the admin session cookie. Errors: 400 (validation), 401 `INVALID_TOKEN`, 403 `FORBIDDEN`, 429.

- [ ] **Step 1: Write the failing tests** in `tests/firebase.test.ts`.

Import `POST as resetRoute` from `@/app/api/admin/auth/reset-password/route`, `POST as adminLoginRoute` from `@/app/api/admin/auth/login/route`, `AdminUser` and `AdminSession` from `@/models/...`, and `makeAdmin` and `adminCookie` from `./helpers`. Define `const NEW_PW = "New-Store-Pass-2026"` and `const reset = (idToken: string, password = NEW_PW) => resetRoute(request("/api/admin/auth/reset-password", { body: { idToken, password } }), noParams)`. Tests:

```ts
it("resets a staff password after Google verification and signs them in", async () => {
  const a = await makeAdmin("owner", "shop@store.test", "Correct-Horse-9-Battery");
  await adminCookie(a.id); // an existing session that must be revoked
  const res = await reset(await token({ provider: "google.com", email: "shop@store.test" }));
  expect(res.status).toBe(200);
  expect((res.headers.get("set-cookie") ?? "").toLowerCase()).toContain("httponly");
  expect(await AdminSession.countDocuments({ adminId: a.id })).toBe(1); // only the new one
  const oldPw = await adminLoginRoute(request("/api/admin/auth/login", { body: { login: "shop@store.test", password: "Correct-Horse-9-Battery" } }), noParams);
  expect(oldPw.status).toBe(401);
  const newPw = await adminLoginRoute(request("/api/admin/auth/login", { body: { login: "shop@store.test", password: NEW_PW } }), noParams);
  expect(newPw.status).toBe(200);
});
it("matches the Google email case-insensitively", ...)        // token email "Shop2@Store.Test", admin "shop2@store.test" → 200
it("clears a sign-in lockout", ...)                           // set lockedUntil = +15 min, failedLoginCount = 3 → 200; doc has no lockedUntil, failedLoginCount 0
it("refuses Google accounts that aren't staff", ...)          // no admin with that email → 403; body error.message contains "isn't linked to a staff account"; no User created
it("refuses disabled staff accounts", ...)                    // admin status "disabled" → 403; passwordHash unchanged
it("rejects unverified Google emails", ...)                   // emailVerified: false → 401
it("rejects phone tokens", ...)                               // token() default (phone provider) → 401
it("rejects stale Google tokens", ...)                        // authTime and iat = now − 11 min → 401
it("rejects weak passwords", ...)                             // password "short" → 400; passwordHash unchanged
```

Use a distinct email per test, because `makeAdmin` emails are unique.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npx vitest run tests/firebase.test.ts -t "Admin password reset"`
Expected: FAIL. The import of `@/app/api/admin/auth/reset-password/route` cannot be resolved.

- [ ] **Step 3: Add `adminGoogleResetSchema`** to `schemas.ts` (signature above).

- [ ] **Step 4: Implement `resetAdminPasswordWithGoogle`** in `admin-users.service.ts`, in this order:
  1. `connectDB()`.
  2. `enforceRateLimit(\`admin-reset:ip:${ip}\`, 10, 15 * 60, "Too many reset attempts. Please wait 15 minutes.")`.
  3. `verifyFirebaseToken`. If `identity.provider !== "google"`, throw `new AppError(401, "INVALID_TOKEN", "Sign-in could not be verified. Please try again.")`.
  4. `AdminUser.findOne({ email: identity.email, status: "active" })`. If none, throw `forbidden(<Global Constraints message with identity.email>)`.
  5. Set `passwordHash`, `passwordChangedAt = new Date()`, `failedLoginCount = 0`, `lockedUntil = undefined`, then `save()`.
  6. `revokeAdminSessions(admin._id)`.
  7. `audit({ id, name, role, ip }, "admin.password_reset_google", "admin", admin._id, { email })`.
  8. Return the admin.

- [ ] **Step 5: Create the route** `src/app/api/admin/auth/reset-password/route.ts`. Mirror `src/app/api/admin/auth/login/route.ts`: `runtime = "nodejs"`, `readJson(req, adminGoogleResetSchema, 8 * 1024)`, call the service, then `createAdminSession` + `setSessionCookie(res, ADMIN_COOKIE, ...)`, and return `json({ ok: true, admin: { name, role } })`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npx vitest run tests/firebase.test.ts`
Expected: PASS, all tests including the 9 new ones.

---

### Task 2: Reset view on the admin login page

**Files:**
- Modify: `src/lib/env.ts`. Extract `getFirebaseWebConfig()`, which returns the web config whenever `NEXT_PUBLIC_FIREBASE_PROJECT_ID` is set, else `null`. `getFirebaseClientConfig()` keeps its customer-usage check and then delegates to it.
- Modify: `src/lib/firebase-client.ts`. Add the `auth/popup-blocked` message (Review Focus 5).
- Modify: `src/components/storefront/google-login.tsx`. `export` the existing `GoogleIcon`.
- Modify: `src/app/admin/login/page.tsx`. Pass `firebase={getFirebaseWebConfig()}` to the form.
- Modify: `src/components/admin/admin-login-form.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/auth/reset-password` (Task 1), `signInWithGoogle(config): Promise<string>`, `firebaseErrorMessage(err)`, `ApiError` (`.status`, `.code`).
- Produces: `AdminLoginForm({ next, firebase }: { next: string; firebase: FirebaseWebConfig | null })`.

- [ ] **Step 1: Wire the config.** Add `getFirebaseWebConfig()`, the page prop and the `GoogleIcon` export. Run `npx tsc --noEmit -p .` and expect errors only for the not-yet-accepted `firebase` prop on `AdminLoginForm`.

- [ ] **Step 2: Build the reset view** in `admin-login-form.tsx`. Use `view: "login" | "reset"` and, inside reset, `idToken: string | null` and `verifiedEmail: string | null`.
  - Under Sign in, show a link-style button "Forgot password?", only when `firebase` is set.
  - **Reset step 1:** title "Reset password". Text: "Verify with the Google account that uses your staff email." A button with `GoogleIcon` and "Verify with Google" calls `signInWithGoogle(firebase)`. For display only, decode the email from the token payload: `JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))`.
  - **Reset step 2:** "✓ Verified as {verifiedEmail}". Fields "New password" and "Confirm password", both `autoComplete="new-password"`. Hint: "At least 12 characters, with upper- and lower-case letters and a number." Button "Set password & sign in".
  - Mismatched confirm → "Passwords do not match." (client-side, no request).
  - Submit → `apiFetch("/api/admin/auth/reset-password", { body: { idToken, password } })`, then `router.replace(next)` + `router.refresh()`.
  - On `ApiError` 401 `INVALID_TOKEN`: return to step 1 with "Google verification expired. Verify with Google again." (Review Focus 1).
  - On 403: show the server message plus a "Use a different Google account" button that returns to step 1.
  - Other errors: show the message.
  - A "Back to sign in" link is shown in both reset steps.

- [ ] **Step 3: Type check and full tests**

Run: `npx tsc --noEmit -p .` → no output.
Run: `npx vitest run` → all test files pass.

- [ ] **Step 4: Check the page renders cleanly**

With the dev server on :3000, run headless Chrome against `http://localhost:3000/admin/login` with `--enable-logging=stderr --dump-dom`. Expected: the DOM contains "Forgot password?", and the log has no `CONSOLE` error or hydration lines.

- [ ] **Step 5: Manual check (user)**

The Google popup can't be automated. Ask the user to:
1. Click Forgot password?, then Verify with Google, and pick aarudhrasmartstore@gmail.com.
2. Set a password and confirm they land on `/admin`.
3. Try a non-staff Google account and see the 403 message.

This needs the Google provider enabled in Firebase project `aarudra-58574`.
