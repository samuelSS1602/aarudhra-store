/**
 * Runs once when a Next.js server instance starts. Validates environment
 * configuration early so misconfiguration surfaces in logs immediately, and
 * refuses to boot a production server with invalid settings.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getEnv } = await import("@/lib/env");
  try {
    const env = getEnv();
    const missing: string[] = [];
    if (!env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) missing.push("WhatsApp Cloud API (order notifications)");
    if (!env.WHATSAPP_APP_SECRET) missing.push("WHATSAPP_APP_SECRET (webhook verification)");
    if (!env.CLOUDINARY_CLOUD_NAME) missing.push("Cloudinary (product image uploads)");
    if (missing.length) console.warn(`[config] Optional integrations not configured: ${missing.join("; ")}`);
  } catch (err) {
    console.error(String(err instanceof Error ? err.message : err));
    if (process.env.NODE_ENV === "production") throw err;
  }
}
