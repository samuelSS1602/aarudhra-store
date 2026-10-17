import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { categoryReorderSchema } from "@/lib/validation/schemas";
import { reorderCategories } from "@/services/categories.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "categories:write");
  const { ids } = await readJson(req, categoryReorderSchema, 32 * 1024);
  await reorderCategories(ids, admin);
  invalidate(TAGS.catalog);
  return json({ ok: true });
});
