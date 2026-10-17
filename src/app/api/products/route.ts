import { json, parseQuery, route } from "@/lib/api";
import { productListQuery } from "@/lib/validation/schemas";
import { listProducts } from "@/services/products.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const query = parseQuery(req, productListQuery);
  const result = await listProducts(query);
  return json(result, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
});
