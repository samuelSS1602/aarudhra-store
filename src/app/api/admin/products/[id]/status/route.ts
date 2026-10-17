import { z } from "zod";
import { invalidate, TAGS } from "@/lib/cache";
import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { setProductStatus } from "@/services/products.service";

export const runtime = "nodejs";

const schema = z.object({ status: z.enum(["active", "draft", "archived"]) });

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "products:write");
  const { status } = await readJson(req, schema, 512);
  const product = await setProductStatus(await idParam(params, "Product"), status, admin);
  invalidate(TAGS.catalog);
  return json({ product });
});
