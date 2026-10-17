import { beforeAll, beforeEach, inject } from "vitest";
import mongoose from "mongoose";

// Test configuration — never real credentials.
Object.assign(process.env, {
  AUTH_SECRET: "test-auth-secret-0123456789-abcdefghijklmnop",
  ADMIN_SESSION_SECRET: "test-admin-secret-0123456789-abcdefghijklmn",
  MONGODB_DB_NAME: "aarudhra_test",
  MONGODB_TRANSACTIONS: "auto",
  SMS_PROVIDER: "console",
  LOGIN_METHODS: "phone", // the OTP code path stays covered even though the store uses Google
  NEXT_PUBLIC_APP_URL: "https://store.test",
  WHATSAPP_ACCESS_TOKEN: "test-token",
  WHATSAPP_PHONE_NUMBER_ID: "1234567890",
  WHATSAPP_OWNER_NUMBER: "+919876500001",
  WHATSAPP_TEMPLATE_NAME: "new_order_alert",
  WHATSAPP_TEMPLATE_LANGUAGE: "en",
  WHATSAPP_APP_SECRET: "test-app-secret",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
  CRON_SECRET: "test-cron-secret",
});

beforeAll(async () => {
  process.env.MONGODB_URI = inject("mongoUri");
  const { resetEnvCache } = await import("@/lib/env");
  resetEnvCache();
  const { connectDB } = await import("@/lib/mongodb");
  await connectDB();
  const models = await import("@/models");
  // Build unique/TTL indexes up front (idempotency + dedupe rely on them).
  for (const m of Object.values(models)) {
    const model = m as unknown as mongoose.Model<unknown>;
    if (typeof model?.init === "function" && typeof model.modelName === "string") await model.createCollection().catch(() => undefined).then(() => model.syncIndexes());
  }
});

beforeEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
});

