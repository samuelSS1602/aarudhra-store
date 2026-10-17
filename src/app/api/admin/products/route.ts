import { z } from "zod";
import { invalidate, TAGS } from "@/lib/cache";
import { json, parseQuery, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { productInputSchema } from "@/lib/validation/schemas";
import { createProduct, listAdminProducts } from "@/services/products.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["active", "draft", "archived"]).optional(),
  categoryId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  stock: z.enum(["low", "out"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const GET = route(async (req) => {
  await requireAdmin(req, "products:view");
  return json(await listAdminProducts(parseQuery(req, listSchema)));
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "products:write");
  const input = await readJson(req, productInputSchema, 64 * 1024);
  const product = await createProduct(input, admin);
  invalidate(TAGS.catalog);
  return json({ product }, { status: 201 });
});
