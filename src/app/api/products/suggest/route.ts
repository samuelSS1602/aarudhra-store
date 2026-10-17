import { z } from "zod";
import { json, parseQuery, route } from "@/lib/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import { suggestProducts } from "@/services/products.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ q: z.string().trim().max(60).default("") });

export const GET = route(async (req) => {
  const { q } = parseQuery(req, schema);
  await enforceRateLimit(`suggest:${getClientIp(req)}`, 120, 60);
  const items = await suggestProducts(q);
  return json({ items }, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } });
});
