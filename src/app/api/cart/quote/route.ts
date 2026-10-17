import { json, readJson, route } from "@/lib/api";
import { getCustomerFromRequest } from "@/lib/auth/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { quoteSchema } from "@/lib/validation/schemas";
import { buildQuote, toQuoteDTO } from "@/services/pricing.service";
import { getSettings } from "@/services/settings.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-side price quote for the cart. Prices sent by the browser are never used. */
export const POST = route(async (req) => {
  const body = await readJson(req, quoteSchema, 20 * 1024);
  await enforceRateLimit(`quote:${getClientIp(req)}`, 120, 60);
  const customer = await getCustomerFromRequest(req);
  const quote = await buildQuote({
    items: body.items,
    couponCode: body.couponCode,
    deliveryOptionId: body.deliveryOptionId,
    settings: await getSettings(),
    userId: customer?.id ?? null,
  });
  return json(toQuoteDTO(quote), { headers: { "Cache-Control": "no-store" } });
});
