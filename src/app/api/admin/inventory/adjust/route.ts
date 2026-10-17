import { invalidate, TAGS } from "@/lib/cache";
import { json, readJson, route } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/admin-session";
import { inventoryAdjustSchema } from "@/lib/validation/schemas";
import { adjustInventory } from "@/services/inventory.service";

export const runtime = "nodejs";

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "inventory:adjust");
  const input = await readJson(req, inventoryAdjustSchema, 2048);
  const result = await adjustInventory(input, admin);
  invalidate(TAGS.catalog);
  return json({ ok: true, ...result });
});
