import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { requireCustomer } from "@/lib/auth/session";
import { runAfterResponse } from "@/lib/background";
import { customerCancelSchema } from "@/lib/validation/schemas";
import { cancelOrderAsCustomer } from "@/services/orders.service";
import { notifyStatusChange } from "@/services/notifications.service";

export const runtime = "nodejs";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const customer = await requireCustomer(req);
  const { id } = await params;
  const { reason } = await readJson(req, customerCancelSchema, 2048);
  await cancelOrderAsCustomer(id, customer, reason);
  runAfterResponse(() => notifyStatusChange(id, "cancelled"));
  invalidate(TAGS.catalog); // stock restored
  return json({ ok: true });
});
