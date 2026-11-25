# Admin password reset with Google

Date: 2026-11-25 · Size: small change

## Intent
If an admin forgets their password, they can reset it from the admin sign-in page by proving with Google that they own the account's email. No terminal and no other owner are needed. The main user is the store owner (aarudhrasmartstore@gmail.com, username `aarudhra`).

## Goals
- A "Forgot password?" link on `/admin/login` opens a reset view: **Verify with Google**, then **set a new password**.
- It works for any active staff account whose email is a Google account (Gmail or Google Workspace).
- After the reset, all existing sessions for that account are signed out, the lockout is cleared, and the user is signed straight in.

## Non-goals
- Google is not becoming a normal way to sign in to the admin. Username/email + password stays the login.
- No reset links by email, and no SMS or WhatsApp codes. The project has no email service and WhatsApp isn't connected.

## Anti-goals (failure even if it "works")
- A customer's Google sign-in must never grant admin access or change an admin password.
- It must not reveal anything about other accounts. The only answer a non-staff Google account gets is "this Google account isn't a staff account".

## Constraints
- Reuses the existing Firebase Google popup (`signInWithGoogle` in `src/lib/firebase-client.ts`) and server check (`verifyFirebaseToken` in `src/lib/firebase-verify.ts`). That check accepts only Google-verified emails and tokens from the last 10 minutes.
- The Firebase project `aarudra-58574` needs the Google sign-in provider enabled, and the live domain added under Authorized domains. That's already on the to-do list. If Firebase isn't configured, the link is hidden.
- Passwords follow the existing rule (12+ characters, upper- and lower-case letters, a number).

## Approaches
1. **Verify with Google (chosen by the owner).** Free, and works today with no new service.
2. Email reset link: needs a new email service, an API key, and sending setup.
3. WhatsApp/SMS code: WhatsApp isn't connected and would need an approved template. It also goes against the deliberate separation of staff login from customer OTP.

## Design
- **UI** (`admin-login-form.tsx`): a "Forgot password?" link under Sign in switches the card to a reset view.
  - Step 1: "Verify with Google" opens the Google account picker in a popup.
  - Step 2: "Verified as you@gmail.com". New password + confirm, then "Set password & sign in".
  - "Back to sign in" returns to the normal form.
- **API**: `POST /api/admin/auth/reset-password` with `{ idToken, password }`:
  - Rate-limited per IP.
  - Verifies the Google token. Phone tokens are rejected.
  - Finds an **active** staff account with that exact email. Otherwise 403 with "This Google account isn't linked to a staff account".
  - Validates the password, then saves the new hash and `passwordChangedAt`, and clears failed-login count and lockout.
  - Revokes all sessions, writes the audit entry `admin.password_reset_google`, then creates a new session cookie.
- **Tests**:
  - Matching staff resets: new password works, old password fails, old sessions are revoked.
  - A non-staff Google account gets 403.
  - A disabled account gets 403.
  - A weak password gets 400.
  - A phone token is rejected.

## Builder's calls (Claude's, open to correction)
- Popup only, with no full-page redirect fallback. If the popup is blocked, a message asks the user to allow popups.
- One API call at the end rather than a separate "check" step. A non-matching Google account is reported when the user submits.
- The user is signed in right after the reset instead of being sent back to the sign-in form.
