import { invalidate, TAGS } from "@/lib/cache";
import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { categoryDeleteSchema, categoryInputSchema } from "@/lib/validation/schemas";
import { deleteCategory, updateCategory } from "@/services/categories.service";

export const runtime = "nodejs";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "categories:write");
  const id = await idParam(params, "Category");
  const input = await readJson(req, categoryInputSchema, 8 * 1024);
  const category = await updateCategory(id, input, admin);
  invalidate(TAGS.catalog);
  return json({ category });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "categories:write");
  const id = await idParam(params, "Category");
  const { reassignTo } = await readJson(req, categoryDeleteSchema, 512);
  await deleteCategory(id, admin, reassignTo);
  invalidate(TAGS.catalog);
  return json({ ok: true });
});
