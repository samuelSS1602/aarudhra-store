import "server-only";
import { connectDB } from "@/lib/mongodb";
import { ORDER_STATUSES } from "@/lib/constants";
import { Order } from "@/models/Order";
import { User } from "@/models/User";
import { Product } from "@/models/Product";
import { AuditLog } from "@/models/misc";

/**
 * Definitions (documented on the dashboard):
 *  - Gross order value: sum of totals of all orders placed in the range, excluding cancelled orders.
 *  - Realized revenue: money actually collected — orders marked paid (COD is marked paid on delivery),
 *    minus refunds. Cancelled orders are excluded unless they had been paid (then their refund offsets).
 */
const TZ = "Asia/Kolkata";

export async function getDashboardMetrics(range: { from: Date; to: Date }) {
  await connectDB();
  const inRange = { createdAt: { $gte: range.from, $lte: range.to } };

  const [statusAgg, totalsAgg, trend, bestSellers, totalCustomers, newCustomers, productAgg, recentOrders, recentCustomers, recentActivity] =
    await Promise.all([
      Order.aggregate<{ _id: string; count: number; value: number }>([
        { $match: inRange },
        { $group: { _id: "$orderStatus", count: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
      ]),
      Order.aggregate<{ gross: number; realized: number; refunds: number; orders: number; nonCancelled: number; items: number }>([
        { $match: inRange },
        {
          $group: {
            _id: null,
            orders: { $sum: 1 },
            nonCancelled: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, 1] } },
            gross: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, "$totalAmount"] } },
            realized: { $sum: { $cond: [{ $in: ["$paymentStatus", ["paid", "partially_refunded", "refunded"]] }, "$totalAmount", 0] } },
            refunds: { $sum: { $ifNull: ["$refund.amount", 0] } },
            items: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, { $sum: "$items.quantity" }] } },
          },
        },
      ]),
      Order.aggregate<{ _id: string; orders: number; gross: number; realized: number }>([
        { $match: inRange },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ } },
            orders: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, 1] } },
            gross: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, "$totalAmount"] } },
            realized: {
              $sum: {
                $cond: [
                  { $in: ["$paymentStatus", ["paid", "partially_refunded", "refunded"]] },
                  { $subtract: ["$totalAmount", { $ifNull: ["$refund.amount", 0] }] },
                  0,
                ],
              },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate<{ _id: string; name: string; sku: string; quantity: number; revenue: number }>([
        { $match: { ...inRange, orderStatus: { $nin: ["cancelled", "returned", "refunded"] } } },
        { $unwind: "$items" },
        { $group: { _id: "$items.productId", name: { $last: "$items.name" }, sku: { $last: "$items.sku" }, quantity: { $sum: "$items.quantity" }, revenue: { $sum: "$items.lineTotal" } } },
        { $sort: { quantity: -1 } },
        { $limit: 5 },
      ]),
      User.countDocuments(),
      User.countDocuments(inRange),
      Product.aggregate<{ total: number; low: number; out: number }>([
        { $match: { status: { $ne: "archived" } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            out: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
            low: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockThreshold"] }] }, 1, 0] } },
          },
        },
      ]),
      Order.find().sort({ createdAt: -1 }).limit(8).select("orderNumber customerSnapshot.name totalAmount orderStatus paymentStatus createdAt ownerNotificationStatus").lean(),
      User.find().sort({ createdAt: -1 }).limit(5).select("name phoneNumber email createdAt").lean(),
      AuditLog.find().sort({ createdAt: -1 }).limit(8).select("adminName action resourceType resourceId createdAt").lean(),
    ]);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<(typeof ORDER_STATUSES)[number], number>;
  for (const s of statusAgg) if (s._id in byStatus) byStatus[s._id as keyof typeof byStatus] = s.count;
  const t = totalsAgg[0] ?? { gross: 0, realized: 0, refunds: 0, orders: 0, nonCancelled: 0, items: 0 };
  const p = productAgg[0] ?? { total: 0, low: 0, out: 0 };

  // Fill empty days so the trend chart has a continuous axis.
  const trendMap = new Map(trend.map((d) => [d._id, d]));
  const days: { date: string; orders: number; gross: number; realized: number }[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  for (let ts = range.from.getTime(); ts <= range.to.getTime() && days.length < 370; ts += dayMs) {
    const key = new Date(ts + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (days.at(-1)?.date === key) continue;
    const d = trendMap.get(key);
    days.push({ date: key, orders: d?.orders ?? 0, gross: d?.gross ?? 0, realized: d?.realized ?? 0 });
  }

  return {
    totals: {
      grossOrderValue: t.gross,
      realizedRevenue: Math.max(0, t.realized - t.refunds),
      refunds: t.refunds,
      orders: t.orders,
      nonCancelledOrders: t.nonCancelled,
      itemsSold: t.items,
      averageOrderValue: t.nonCancelled ? Math.round(t.gross / t.nonCancelled) : 0,
    },
    byStatus,
    customers: { total: totalCustomers, newInRange: newCustomers },
    products: p,
    trend: days,
    bestSellers,
    recentOrders,
    recentCustomers,
    recentActivity,
  };
}

export async function getAnalyticsBreakdown(range: { from: Date; to: Date }) {
  await connectDB();
  const match = { createdAt: { $gte: range.from, $lte: range.to }, orderStatus: { $ne: "cancelled" } };
  const [byCategory, byPayment, coupons, byHour] = await Promise.all([
    Order.aggregate<{ _id: string; name: string; revenue: number; quantity: number }>([
      { $match: match },
      { $unwind: "$items" },
      { $lookup: { from: "products", localField: "items.productId", foreignField: "_id", as: "p" } },
      { $lookup: { from: "categories", localField: "p.categoryId", foreignField: "_id", as: "c" } },
      { $group: { _id: { $ifNull: [{ $first: "$c.slug" }, "uncategorised"] }, name: { $first: { $ifNull: [{ $first: "$c.name" }, "Uncategorised"] } }, revenue: { $sum: "$items.lineTotal" }, quantity: { $sum: "$items.quantity" } } },
      { $sort: { revenue: -1 } },
      { $limit: 12 },
    ]),
    Order.aggregate<{ _id: string; count: number; value: number }>([
      { $match: match },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, value: { $sum: "$totalAmount" } } },
    ]),
    Order.aggregate<{ _id: string; count: number; discount: number }>([
      { $match: { ...match, "couponSnapshot.code": { $exists: true, $ne: null } } },
      { $group: { _id: "$couponSnapshot.code", count: { $sum: 1 }, discount: { $sum: "$discount" } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]),
    Order.aggregate<{ _id: number; count: number }>([
      { $match: match },
      { $group: { _id: { $hour: { date: "$createdAt", timezone: TZ } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: byHour.find((x) => x._id === h)?.count ?? 0 }));
  return { byCategory, byPayment, coupons, hours };
}
