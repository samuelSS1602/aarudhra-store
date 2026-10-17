import "server-only";
import { z } from "zod";

/**
 * Server-side environment configuration.
 *
 * Validation is lazy (first call to `getEnv()`) so that `next build` can run in CI
 * without production secrets, and is also triggered eagerly at server start from
 * `src/instrumentation.ts`, which fails fast in production.
 */

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    MONGODB_URI: z.string().min(1, "MONGODB_URI is required (MongoDB Atlas connection string)"),
    MONGODB_DB_NAME: z.string().min(1).default("aarudhra_store"),
    MONGODB_TRANSACTIONS: z.enum(["auto", "on", "off"]).default("auto"),

    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
    ADMIN_SESSION_SECRET: z.string().min(32, "ADMIN_SESSION_SECRET must be at least 32 characters"),

    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_STORE_NAME: z.string().default("Aarudhra Smart Store"),

    SMS_PROVIDER: z.enum(["msg91", "fast2sms", "twilio", "firebase", "console"]).default("console"),
    SMS_API_KEY: optional,
    SMS_SENDER_ID: optional,
    SMS_TEMPLATE_ID: optional,
    TWILIO_ACCOUNT_SID: optional,
    TWILIO_AUTH_TOKEN: optional,
    TWILIO_VERIFY_SERVICE_SID: optional,
    OTP_DEV_MODE: boolish,

    // Firebase Phone Auth (SMS_PROVIDER=firebase). The web config is public by design;
    // the server only verifies Firebase ID tokens, so no service-account key is needed.
    NEXT_PUBLIC_FIREBASE_API_KEY: optional,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: optional,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: optional,
    NEXT_PUBLIC_FIREBASE_APP_ID: optional,

    WHATSAPP_ACCESS_TOKEN: optional,
    WHATSAPP_PHONE_NUMBER_ID: optional,
    WHATSAPP_BUSINESS_ACCOUNT_ID: optional,
    WHATSAPP_OWNER_NUMBER: optional,
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: optional,
    WHATSAPP_APP_SECRET: optional,
    WHATSAPP_API_VERSION: z.string().default("v21.0"),
    WHATSAPP_TEMPLATE_NAME: optional,
    WHATSAPP_TEMPLATE_LANGUAGE: z.string().default("en"),
    WHATSAPP_CUSTOMER_TEMPLATE_NAME: optional,
    WHATSAPP_STATUS_TEMPLATE_NAME: optional,

    CLOUDINARY_CLOUD_NAME: optional,
    CLOUDINARY_API_KEY: optional,
    CLOUDINARY_API_SECRET: optional,
    CLOUDINARY_FOLDER: z.string().default("aarudhra-store"),
    // Where uploaded photos are stored. auto = Cloudinary when configured, otherwise MongoDB.
    IMAGE_STORAGE: z.enum(["auto", "mongodb", "cloudinary"]).default("auto"),

    CRON_SECRET: optional,
  })
  .superRefine((env, ctx) => {
    // Production-only rules are enforced when the server starts, not while `next build`
    // pre-renders pages (the build may run with local development settings).
    const building = process.env.NEXT_PHASE === "phase-production-build";
    if (env.NODE_ENV === "production" && !building) {
      if (env.SMS_PROVIDER === "console") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["SMS_PROVIDER"],
          message: "SMS_PROVIDER=console is a development-only provider and cannot be used in production",
        });
      }
      if (env.AUTH_SECRET === env.ADMIN_SESSION_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["ADMIN_SESSION_SECRET"],
          message: "ADMIN_SESSION_SECRET must differ from AUTH_SECRET",
        });
      }
    }
    if (
      env.SMS_PROVIDER === "firebase" &&
      (!env.NEXT_PUBLIC_FIREBASE_API_KEY || !env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || !env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["NEXT_PUBLIC_FIREBASE_PROJECT_ID"],
        message: "Firebase OTP requires NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN and NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      });
    }
    if (env.SMS_PROVIDER === "msg91" && (!env.SMS_API_KEY || !env.SMS_TEMPLATE_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SMS_API_KEY"],
        message: "MSG91 requires SMS_API_KEY (authkey) and SMS_TEMPLATE_ID",
      });
    }
    if (env.SMS_PROVIDER === "fast2sms" && !env.SMS_API_KEY) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["SMS_API_KEY"], message: "Fast2SMS requires SMS_API_KEY" });
    }
    if (
      env.SMS_PROVIDER === "twilio" &&
      (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_VERIFY_SERVICE_SID)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TWILIO_ACCOUNT_SID"],
        message: "Twilio Verify requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID",
      });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "env"}: ${i.message}`).join("\n");
    throw new ConfigurationError(`Invalid environment configuration:\n${details}\nSee .env.example and README.md.`);
  }
  cached = parsed.data;
  return cached;
}

/** For tests only: clears the cached configuration so process.env changes take effect. */
export function resetEnvCache() {
  cached = null;
}

export const isProduction = () => process.env.NODE_ENV === "production";

/** Dev OTP mode can never be active in production, regardless of env flags. */
export function isOtpDevMode(): boolean {
  const env = getEnv();
  return env.NODE_ENV !== "production" && (env.OTP_DEV_MODE || env.SMS_PROVIDER === "console");
}

/** Public Firebase web config for the login page, or null when Firebase OTP is not the active provider. */
export function getFirebaseClientConfig() {
  const env = getEnv();
  if (env.SMS_PROVIDER !== "firebase") return null;
  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    ...(env.NEXT_PUBLIC_FIREBASE_APP_ID ? { appId: env.NEXT_PUBLIC_FIREBASE_APP_ID } : {}),
  };
}

export function isWhatsAppConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID);
}

export function imageStorageBackend(): "mongodb" | "cloudinary" {
  const mode = getEnv().IMAGE_STORAGE;
  if (mode === "mongodb") return "mongodb";
  if (mode === "cloudinary") return "cloudinary";
  return isCloudinaryConfigured() ? "cloudinary" : "mongodb";
}

export function isCloudinaryConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);
}
