import { invalidate, TAGS } from "@/lib/cache";
import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { productInputSchema } from "@/lib/validation/schemas";
import { deleteProduct, getAdminProduct, updateProduct } from "@/services/products.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "products:view");
  return json({ product: await getAdminProduct(await idParam(params, "Product"), admin) });
});

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "products:write");
  const id = await idParam(params, "Product");
  const input = await readJson(req, productInputSchema, 64 * 1024);
  const product = await updateProduct(id, input, admin);
  invalidate(TAGS.catalog);
  return json({ product });
});

export const DELETE = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "products:delete");
  await deleteProduct(await idParam(params, "Product"), admin);
  invalidate(TAGS.catalog);
  return json({ ok: true });
});
