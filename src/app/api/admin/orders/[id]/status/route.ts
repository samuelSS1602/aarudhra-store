import { invalidate, TAGS } from "@/lib/cache";
import { json, idParam, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { runAfterResponse } from "@/lib/background";
import { orderStatusUpdateSchema } from "@/lib/validation/schemas";
import { updateOrderStatusAsAdmin } from "@/services/orders.service";
import { notifyStatusChange } from "@/services/notifications.service";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireAdmin(req, "orders:update");
  const id = await idParam(params, "Order");
  const input = await readJson(req, orderStatusUpdateSchema, 4096);
  const result = await updateOrderStatusAsAdmin(id, input, admin);
  runAfterResponse(() => notifyStatusChange(id, result.to));
  // Cancellations and returns change stock shown on the storefront.
  invalidate(TAGS.catalog);
  return json({ ok: true, from: result.from, to: result.to });
});
