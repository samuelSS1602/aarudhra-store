import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { categoryInputSchema } from "@/lib/validation/schemas";
import { createCategory, listAllCategories } from "@/services/categories.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin(req, "products:view");
  return json({ items: await listAllCategories() });
});

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "categories:write");
  const input = await readJson(req, categoryInputSchema, 8 * 1024);
  const category = await createCategory(input, admin);
  invalidate(TAGS.catalog);
  return json({ category }, { status: 201 });
});
