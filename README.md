# Aarudhra Smart Store

E-commerce storefront and admin dashboard for **Aarudhra Smart Store**: stationery, home goods and everyday essentials from New Ammumall Complex, 65/48, New Dharapuram Road, Opposite Town Police Station, Indra Nagar, Palani, Tamil Nadu 624601.

- **Storefront:** search, filters, product pages with variants, cart, wishlist, phone-OTP sign-in, checkout with Cash on Delivery, order tracking, customer accounts.
- **Admin (`/admin`):** live dashboard, products, categories, inventory with history, orders with a validated status workflow, customers, coupons, sales analytics, WhatsApp notification log, store settings, staff accounts and audit logs.
- **Integrations:** MongoDB Atlas, SMS OTP (MSG91, Fast2SMS or Twilio Verify), the official WhatsApp Business Cloud API, and Cloudinary for images.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Radix/shadcn-style UI · Framer Motion · React Hook Form + Zod · Recharts · Mongoose 8 · Vitest.

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Node.js](#2-nodejs)
3. [Install](#3-install)
4. [MongoDB Atlas setup](#4-mongodb-atlas-setup)
5. [Network access](#5-database-network-access)
6. [Database user](#6-database-user)
7. [Environment variables](#7-environment-variables)
8. [SMS OTP provider](#8-sms-otp-provider)
9. [WhatsApp Business Platform](#9-whatsapp-business-platform)
10. [WhatsApp webhook](#10-whatsapp-webhook)
11. [First admin](#11-first-admin-provisioning)
12. [Image storage](#12-image-storage-cloudinary)
13. [Local development](#13-local-development)
14. [Production build](#14-production-build)
15. [Vercel deployment](#15-vercel-deployment)
16. [Production security checklist](#16-production-security-checklist)
17. [Troubleshooting](#17-troubleshooting)
- [Architecture notes](#architecture-notes)

---

## 1. Prerequisites

- Node.js **20.11 or newer** (22 LTS recommended)
- A MongoDB Atlas account (the free M0 tier works for testing)
- An SMS provider account for OTP (MSG91, Fast2SMS or Twilio)
- A Meta Business account with WhatsApp Business Platform access
- A Cloudinary account (free tier is enough)
- A Vercel account for hosting

## 2. Node.js

Install Node from <https://nodejs.org> (LTS), or use `nvm`:

```bash
nvm install 22
nvm use 22
node -v   # v22.x
```

## 3. Install

```bash
git clone <your-repo-url> aarudhra-store
cd aarudhra-store
npm install
cp .env.example .env.local
```

## 4. MongoDB Atlas setup

1. Go to <https://cloud.mongodb.com>, create a project, and click **Create cluster**. M0 is fine to start. Choose the **Mumbai (ap-south-1)** region, close to your customers and to Vercel's `bom1` region.
2. When it's ready, click **Connect → Drivers** and copy the `mongodb+srv://…` connection string.
3. Put it in `MONGODB_URI`, replacing `<username>` and `<password>` with the database user from step 6.

Atlas clusters are replica sets, so the app uses **multi-document transactions** for checkout, cancellations and inventory changes.

## 5. Database network access

In Atlas, open **Security → Network Access → Add IP address**:

- For local development, add your current IP.
- For Vercel, add `0.0.0.0/0` (Vercel serverless functions don't have fixed IPs). Protect the database with a strong, unique user password. If you need fixed egress IPs, use Vercel Secure Compute or Atlas private endpoints (paid plans).

## 6. Database user

Open **Security → Database Access → Add new database user**:

- Authentication: password (use the generator for a long random password).
- Privileges: **Read and write to any database**, or restrict to the `aarudhra_store` database.
- If the password contains special characters, URL-encode them in the connection string.

## 7. Environment variables

Every variable is documented in [`.env.example`](.env.example). Required ones:

| Variable | Purpose |
|---|---|
| `MONGODB_URI`, `MONGODB_DB_NAME` | Database connection |
| `AUTH_SECRET`, `ADMIN_SESSION_SECRET` | Two **different** random strings of 32+ characters, used to hash sessions and OTPs |
| `NEXT_PUBLIC_APP_URL` | Public site URL, e.g. `https://aarudhrastore.in` (used for canonical URLs, the sitemap and links in WhatsApp messages) |
| `SMS_PROVIDER` + provider keys | OTP delivery |
| `WHATSAPP_*` | Order notifications |
| `CLOUDINARY_*` | Image uploads |
| `CRON_SECRET` | Protects the notification retry endpoint |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

The configuration is validated with Zod when the server starts (`src/instrumentation.ts`). In production, an invalid configuration stops the server with a clear list of what's wrong. `SMS_PROVIDER=console` is rejected in production.

Only `NEXT_PUBLIC_*` values reach the browser. All tokens and secrets stay on the server.

## 8. Customer sign-in (Google and/or phone OTP)

`LOGIN_METHODS` chooses what customers see on `/login`: `google`, `phone`, or `google,phone`.

**Google sign-in** (`LOGIN_METHODS=google`) is free and needs no SMS setup:
1. Firebase console → your project → **Build → Authentication → Get started**.
2. **Sign-in method → Add new provider → Google → Enable**, choose a support email, then **Save**.
3. **Authentication → Settings → Authorized domains:** add your live domain(s), e.g. `aarudhra-store.vercel.app`. `localhost` is already there.
4. Set `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_APP_ID` from **Project settings → Your apps → Web app**.

Google customers have no verified phone number. They enter their mobile number at checkout; it's required for delivery and WhatsApp updates, and is saved to their profile, where they can edit it. The server accepts only Google accounts whose email Google has verified. An existing customer with the same email is linked automatically.

**Phone OTP** (`LOGIN_METHODS=phone`) needs one of the SMS providers below.

### SMS OTP provider

Set `SMS_PROVIDER` to one of the following:

**Firebase Phone Auth** (`firebase`) — recommended, simplest setup
1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics is optional).
2. **Build → Authentication → Get started → Sign-in method → Phone → Enable → Save.**
3. Firebase requires the **Blaze (pay-as-you-go)** plan to send real SMS. Upgrade under the ⚙ menu → *Usage and billing*. You're charged per SMS sent; check the current India rate on Firebase's pricing page.
4. **Authentication → Settings → Authorized domains:** `localhost` is there by default. Add your live domain (and `<project>.vercel.app`).
5. **Project settings (⚙) → General → Your apps → `</>` (Web) → Register app.** Copy `apiKey`, `authDomain`, `projectId` and `appId` into:
   ```env
   SMS_PROVIDER=firebase
   NEXT_PUBLIC_FIREBASE_API_KEY=...
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
   NEXT_PUBLIC_FIREBASE_APP_ID=...
   ```
6. **Testing without real SMS:** under Authentication → Sign-in method → Phone → *Phone numbers for testing*, add e.g. `+91 99999 99999` with code `123456`.

How it works: Firebase sends the SMS, checks the code, enforces expiry and attempt limits, and runs invisible reCAPTCHA. The browser then sends Firebase's ID token to `/api/auth/firebase`. The server verifies the token's signature against Google's public keys, its audience and issuer, that it is fresh (under 10 minutes) and that it came from phone sign-in, then issues the store's own HTTP-only session cookie. No service-account key is needed. MongoDB Atlas only stores the account; it doesn't send OTPs.

**MSG91** (`msg91`)
1. Register at <https://msg91.com>, complete DLT registration (required in India) and get a DLT-approved OTP template, for example: `##OTP## is your Aarudhra Smart Store login code. It expires in 5 minutes.`
2. In MSG91, create an OTP template linked to the DLT template ID.
3. Set `SMS_API_KEY` (your authkey), `SMS_TEMPLATE_ID` and, optionally, `SMS_SENDER_ID`.

**Fast2SMS** (`fast2sms`)
1. Get an API key from <https://www.fast2sms.com> → Dev API.
2. Set `SMS_API_KEY`. The built-in `otp` route is used by default. To use your own DLT template, also set `SMS_SENDER_ID` and `SMS_TEMPLATE_ID` (message ID).

**Twilio Verify** (`twilio`)
1. Create a Verify Service at <https://console.twilio.com>. Twilio generates, sends and checks the code itself.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_VERIFY_SERVICE_SID`.

**Development** (`console`): prints the code to the server log and shows it on the login screen, labelled "Development mode". It can't run in production.

Security built in:
- 6-digit codes, valid for 5 minutes, with a 45-second resend cooldown.
- At most 5 verification attempts per code, claimed atomically so parallel guesses can't exceed the limit.
- Rate limits by phone number (5 per hour, 10 per day) and by IP address. Limits are stored in MongoDB, so they hold across serverless instances.
- Codes are stored only as HMAC hashes, used once, and invalidated when a new code is sent.
- If the provider fails, the user is told the code wasn't sent.

## 9. WhatsApp Business Platform

This app uses Meta's **official Cloud API**. No WhatsApp Web automation is involved.

1. Create a Meta app at <https://developers.facebook.com> (type **Business**) and add the **WhatsApp** product.
2. Under **WhatsApp → API Setup**, add and verify the store's business phone number. Copy the **Phone number ID** into `WHATSAPP_PHONE_NUMBER_ID`, and the **WhatsApp Business Account ID** into `WHATSAPP_BUSINESS_ACCOUNT_ID`.
3. Create a **permanent token**: Business Settings → Users → **System users** → Add (Admin) → Assign assets (your app and WhatsApp account, full control) → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`. Put it in `WHATSAPP_ACCESS_TOKEN`. The temporary 24-hour token from API Setup is for testing only.
4. Set `WHATSAPP_OWNER_NUMBER` (for example `+9198XXXXXXXX`). You can also manage recipients in **Admin → Settings → Notifications**, which takes precedence. Up to 5 numbers are supported.
5. Create the message templates below under **WhatsApp Manager → Message templates**. Category: **Utility**. Language: **English** (`en`). Wait for approval.

### WhatsApp message templates

Template parameters can't contain line breaks, so item lists are joined with `; `. **Parameter order must match exactly.**

**`new_order_alert`** (store owner), set as `WHATSAPP_TEMPLATE_NAME`:

```
🛍️ *NEW ORDER — AARUDHRA SMART STORE*

Order ID: {{1}}
Customer: {{2}}
Phone: {{3}}

Items: {{4}}

Subtotal: ₹{{5}}
Discount: ₹{{6}}
Delivery: ₹{{7}}
Tax: ₹{{8}}
*TOTAL: ₹{{9}}*

Payment Method: {{10}}
Payment Status: {{11}}

Delivery Address: {{12}}

Order Time: {{13}}

Please log in to the admin dashboard to manage this order.
Admin Dashboard: {{14}}
```

**`order_confirmation`** (customer, optional), set as `WHATSAPP_CUSTOMER_TEMPLATE_NAME`:

```
Hi {{1}}, thank you for shopping at Aarudhra Smart Store!
Your order {{2}} is confirmed.
Items: {{3}}
Total: ₹{{4}} ({{5}})
Delivering to: {{6}}
Track your order: {{7}}
Need help? {{8}}
```

**`order_status_update`** (customer, optional), set as `WHATSAPP_STATUS_TEMPLATE_NAME`:

```
Hi {{1}}, your Aarudhra Smart Store order {{2}} is now: {{3}}.
Track it here: {{4}}
Questions? {{5}}
```

**"Send on WhatsApp" button (works without any Meta setup)**
After checkout, the confirmation page shows a **Send on WhatsApp** button. It opens WhatsApp with the full order (same format as the owner alert) addressed to the company number, and the customer just presses Send. The number is **Admin → Settings → General → WhatsApp Business number**, falling back to the owner alert recipient. The button is hidden until one of these is set. This complements the automatic Cloud API alert below, which needs no customer action but does need the Meta setup.

**How notifications behave**
- An order is committed first, so it's always saved even if WhatsApp is down. The alert is then sent after the response is returned.
- Every notification is logged with its provider message ID, attempt count and any error. Each one has a unique dedupe key, so retried checkouts never send a second message.
- Temporary failures are retried with exponential back-off by the cron worker (`/api/cron/notifications`) and the admin **Run retry queue** button. Permanent failures (for example, a missing template) are marked **Failed** and can be retried manually after you fix the cause.
- **Sent to provider** means WhatsApp accepted the message. **Delivered** and **Read** appear only after Meta's webhook confirms them.
- Customer messages go only to customers who ticked the opt-in at checkout, and they are transactional only. OTP consent is never treated as WhatsApp consent.
- **Text mode** (Admin → Settings → Notifications) sends the fully formatted multi-line alert as free-form text. Meta delivers it only if the owner's number has messaged the business number in the last 24 hours, so template mode is recommended.

## 10. WhatsApp webhook

1. In the Meta app, go to **WhatsApp → Configuration → Webhook → Edit**:
   - Callback URL: `https://<your-domain>/api/webhooks/whatsapp`
   - Verify token: the value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
2. Click **Verify and save**, then **subscribe** to the `messages` field.
3. Set `WHATSAPP_APP_SECRET` (App settings → Basic → App secret). Every callback's `X-Hub-Signature-256` is checked against the raw request body, and callbacks with an invalid signature are rejected with a 401.

Callbacks are deduplicated, so replays have no effect, and statuses only move forward (sent → delivered → read).

## 11. First-admin provisioning

There are **no default admin credentials** anywhere in the code. Staff accounts are kept separate from customer accounts, so an SMS/OTP compromise can't grant dashboard access.

Create the first owner from a trusted machine with production env vars loaded:

```bash
npm run admin:create -- --email owner@yourdomain.in --name "Store Owner"
# You are prompted for the password (hidden). It must be 12+ characters,
# with upper- and lower-case letters and a number.
```

- Once the first account exists, the script refuses to create more unless you pass `--allow-additional`. Add further staff from **Admin → Admin users**.
- Lost password: `npm run admin:create -- --email owner@yourdomain.in --reset-password` (this signs the account out everywhere).
- For non-interactive environments, set `ADMIN_PASSWORD` for a single run only. Never commit it.

**Roles:** Owner (everything, including staff accounts) › Administrator (refunds, overrides, cost prices, security settings, audit logs) › Store manager (products, inventory, coupons, cancellations, analytics) › Staff (process orders, view data). Every permission is enforced on the server.

## 12. Image storage

**Default: MongoDB, with no extra setup.** Product, category and banner photos are stored in your Atlas database using GridFS (a `media` bucket kept separate from product records) and served from `/media/<id>.webp`.

- Every upload is checked as a real image (JPEG, PNG, WebP or AVIF; max 4 MB). It is rotated upright, stripped of metadata such as GPS location, resized to fit 1600×1600, and saved as WebP. A typical product photo ends up around 100–200 KB.
- Photos never change after upload, so they're served with year-long browser caching. `next/image` also generates smaller versions for phones.
- When you remove a photo from a product, or delete the product, the stored file is deleted too.
- **Capacity:** Atlas's free M0 tier has 512 MB in total, enough for roughly 2,000–3,000 product photos plus your store data. Upgrade the cluster, or switch to Cloudinary, if you need more.

**Optional: Cloudinary.** Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`, and new uploads go to Cloudinary automatically; existing MongoDB photos keep working. To force one backend, set `IMAGE_STORAGE=mongodb` or `IMAGE_STORAGE=cloudinary`.

Products without photos show a generated placeholder rather than a stock photo.

### Homepage store photos

The homepage hero slideshow, the "Inside our store" gallery and the "Visit us" photo use real store photos bundled with the site (not uploaded through the admin). To replace them:

1. Put JPEG/PNG photos in `assets/store-photos/` (this folder is git-ignored). They show in file-name order, so prefix names with `01-`, `02-` and so on. Name the shop-front photo `storefront.jpg`. A name containing `counter` puts that photo in the gallery only.
2. Run `npm run photos:build`. This writes optimised WebP files to `public/store/` and regenerates `src/components/storefront/store-photos.ts`.
3. Commit `public/store/` and the generated file, then deploy.

To set captions, edit `CAPTIONS` in `scripts/build-store-photos.ts`. If **Settings → Homepage → Hero image** is set in the admin, that image is shown as the first slide.

## 13. Local development

```bash
cp .env.example .env.local      # then fill in MONGODB_URI and the two secrets
npm run db:indexes              # create indexes, including TTL indexes
npm run seed                    # the 12 starting categories (no products)
npm run admin:create -- --email you@example.com --name "Your Name"
npm run dev                     # http://localhost:3000
```

With `SMS_PROVIDER=console`, the OTP appears in the terminal and on the login screen.

Other commands:

```bash
npm test                 # Vitest suite (uses an in-memory MongoDB replica set)
npm run typecheck        # tsc --noEmit
npm run lint
npm run seed -- --demo           # optional: add clearly labelled DEMO products for testing
npm run seed -- --clear-demo     # remove demo products before launch
```

Demo products have brand "Demo", SKUs starting `DEMO-`, a description beginning **"DEMO PRODUCT"**, and a "Demo" badge in the admin.

## 14. Production build

```bash
npm run build
npm start
```

The build runs type checking and linting. It also **pre-builds the storefront pages** (home, categories, product pages, contact, policies, cart), so it needs `MONGODB_URI` to reach your database.

**How the live site stays fast and current**
- Pre-built pages are served from cache: about 10 ms on the server here, and from Vercel's edge network when deployed.
- They are rebuilt automatically the moment an admin changes products, categories, stock or settings, or an order changes stock. Even without changes they refresh every 1–60 minutes.
- Search and filter results, account pages and checkout are always generated live.
- The signed-in customer is detected in the browser, so pre-built pages can be shared by everyone and private data never ends up in a cached page.
- Customers can install the store on their phone's home screen via the web app manifest.

Production checks (for example, rejecting `SMS_PROVIDER=console`) run when the server starts, not during the build.

## 15. Vercel deployment

1. Push the repository to GitHub, GitLab or Bitbucket, then click **Import Project** in Vercel. The framework is detected as Next.js.
2. Add every variable from `.env.example` under **Settings → Environment Variables** for the Production environment. Use real secrets, and set `SMS_PROVIDER` to a real provider.
3. Deploy. Functions run in `bom1` (Mumbai), as set in `vercel.json`.
4. After the first deploy:
   - `npm run db:indexes` (locally, with production `MONGODB_URI`). Production disables automatic index builds.
   - `npm run admin:create -- …`
   - Configure the WhatsApp webhook URL (section 10).
   - Set your custom domain and update `NEXT_PUBLIC_APP_URL` to match.
5. **Cron:** `vercel.json` schedules the notification retry worker **daily**, because Vercel's Hobby plan allows only daily cron jobs. On the Pro plan, change the schedule to `*/10 * * * *` for 10-minute retries. On either plan, orders trigger an immediate send, and staff can retry from the dashboard at any time.

## 16. Production security checklist

- [ ] `AUTH_SECRET` and `ADMIN_SESSION_SECRET` are long, random and different.
- [ ] `SMS_PROVIDER` is a real provider; `OTP_DEV_MODE` is unset or `false`.
- [ ] The Atlas user has a strong unique password and the minimum required role.
- [ ] `WHATSAPP_APP_SECRET` and `WHATSAPP_WEBHOOK_VERIFY_TOKEN` are set and the webhook shows as verified.
- [ ] A permanent System User token is used, not the 24-hour test token.
- [ ] `CRON_SECRET` is set.
- [ ] The first owner was created with `admin:create`; there are no shared staff logins.
- [ ] Demo products are removed (`npm run seed -- --clear-demo`) or archived.
- [ ] Store phone, WhatsApp number, hours and email are entered in **Admin → Settings → General**.
- [ ] `NEXT_PUBLIC_APP_URL` matches the live HTTPS domain.
- [ ] `.env*` files are not committed (they're covered by `.gitignore`).
- [ ] Atlas backups are enabled (M10+), or you take regular exports.

Built-in protections: HTTP-only, Secure, SameSite=Lax `__Host-` cookies · CSRF origin checks on every state-changing API · CSP, HSTS, `X-Frame-Options` and related headers · Zod validation with strict schemas that drop unknown fields (prevents mass assignment and NoSQL operator injection) · request size limits · escaped regex search · rate limiting · role-based access control on every admin route and page · ownership checks on customer orders and addresses · prices, discounts, stock and totals always recomputed on the server · atomic stock decrements · idempotent checkout · audit logs with secret redaction · `noindex` on private pages.

**Data retention:** OTP challenges are deleted after 24 hours, rate-limit entries when their window ends, sessions when they expire (customers after 30 days; staff after 12 hours, or 2 hours idle), webhook dedupe keys after 30 days, and audit logs after 2 years. Orders are kept for accounting.

## 17. Troubleshooting

| Problem | Fix |
|---|---|
| `Invalid environment configuration` on start | The message lists each missing or invalid variable. Compare with `.env.example`. |
| `MongoServerSelectionError` / timeouts | Check that your IP (or `0.0.0.0/0` for Vercel) is in Atlas Network Access, and that the user and password in the URI are correct and URL-encoded. |
| "We couldn't send the OTP" | Check the server log for the provider's message. Common causes: DLT template not approved, wrong template ID, or no balance on the account. |
| WhatsApp `132001` (template does not exist) | The template name or language differs from the approved one, or it isn't approved yet. |
| WhatsApp `132000` (parameter count mismatch) | The approved template must have exactly 14 parameters (owner), 8 (confirmation) or 5 (status update). |
| WhatsApp `131047` (re-engagement) | Text mode outside the 24-hour window. Switch to template mode. |
| WhatsApp `190` (token expired) | You used a temporary token. Create a System User token (section 9). |
| Notifications stuck in "Sent to provider" | The webhook isn't configured, isn't subscribed to `messages`, or `WHATSAPP_APP_SECRET` is wrong (the server log shows "invalid signature"). |
| Image upload fails with 503 | `CLOUDINARY_*` isn't set. |
| Unique index or duplicate errors after schema changes | Run `npm run db:indexes`. |
| Tests can't start MongoDB | The first run downloads a MongoDB binary (around 100 MB); allow network access, or set `MONGOMS_SYSTEM_BINARY`. |

---

## Architecture notes

```
src/
  app/
    (store)/            storefront pages: home, products, categories, cart, checkout, account, login, contact, policies
    admin/login         staff sign-in
    admin/(panel)/      dashboard pages, guarded server-side by the layout and each page's permission
    api/                route handlers: auth, products, cart, checkout, orders, account, admin/*, webhooks, cron
  components/           ui primitives · storefront · products · cart · checkout · account · orders · admin
  lib/                  env, mongodb, auth (sessions/cookies), permissions, validation, security, sms, whatsapp, cloudinary, seo
  models/               Mongoose schemas (User, Product, Category, Order, Coupon, OtpChallenge, NotificationLog, InventoryLog, AuditLog, Settings, …)
  services/             business logic (orders, pricing, inventory, notifications, analytics, customers, …)
scripts/                seed, create-admin, sync-indexes
tests/                  Vitest suites against an in-memory replica set
```

- **Money** is stored as integer **paise** everywhere (`₹1 = 100`).
- **Pricing** is computed only in `services/pricing.service.ts`. The cart page, checkout and order creation all use it, and checkout re-runs it inside the order transaction.
- **Checkout** (`services/orders.service.ts`) runs in a transaction: re-price, conditionally decrement stock (`stock >= qty`), redeem the coupon, create the order with item snapshots, write inventory logs. A unique `(userId, idempotencyKey)` index turns retries into the same order. If a deployment lacks transactions, compensation logic undoes partial work.
- **Order statuses** follow `ORDER_TRANSITIONS` in `lib/constants.ts`. Other transitions require the `orders:override` permission and a reason, and are audit-logged. Cancellations and returns restore stock exactly once.
- **Revenue:** *gross order value* is the total of non-cancelled orders when placed. *Realized revenue* is paid orders (COD is marked paid on delivery) minus refunds.
- **Live admin updates:** the dashboard polls a lightweight summary endpoint every 20 seconds (paused when the tab is hidden) to show new-order alerts and badges. Order pages refresh their server data automatically.
- **Online payments:** the `paymentMethod`, `paymentStatus` and `paymentDetails` fields and the checkout flow are ready for a payment gateway, but **none is integrated**. The API rejects `online` until one is added and tested.
