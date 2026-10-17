import { json, route } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import { requireAdmin } from "@/lib/auth/admin-session";
import { Order } from "@/models/Order";
import { NotificationLog } from "@/models/NotificationLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight polling endpoint for live dashboard badges and new-order alerts. */
export const GET = route(async (req) => {
  await requireAdmin(req, "dashboard:view");
  await connectDB();
  const [pending, failedNotifications, latest] = await Promise.all([
    Order.countDocuments({ orderStatus: "pending" }),
    NotificationLog.countDocuments({ status: "failed" }),
    Order.findOne().sort({ createdAt: -1 }).select("orderNumber createdAt").lean(),
  ]);
  return json(
    {
      pendingOrders: pending,
      failedNotifications,
      latestOrder: latest ? { orderNumber: latest.orderNumber, createdAt: latest.createdAt } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
});
