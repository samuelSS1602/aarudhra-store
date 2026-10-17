import "server-only";
import { Types, type ClientSession } from "mongoose";
import { connectDB, withTransaction } from "@/lib/mongodb";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { escapeRegex } from "@/lib/utils";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { Product } from "@/models/Product";
import { InventoryLog } from "@/models/misc";
import { audit } from "./audit.service";

type StockChange = {
  productId: string | Types.ObjectId;
  variantId?: string | Types.ObjectId | null;
  quantityChange: number; // negative = remove stock
};

export class InsufficientStockError extends Error {
  constructor(public productId: string, public variantId: string | null) {
    super("Insufficient stock");
    this.name = "InsufficientStockError";
  }
}

/**
 * Atomically applies a stock delta. The filter guarantees stock never goes
 * negative: a decrement only matches when enough stock exists, so concurrent
 * orders cannot oversell. For variant products the variant and the product total
 * are updated in the same single-document write.
 */
export async function applyStockChange(change: StockChange, session: ClientSession | null) {
  const productId = new Types.ObjectId(String(change.productId));
  const qty = change.quantityChange;
  const need = qty < 0 ? -qty : 0;

  if (change.variantId) {
    const variantId = new Types.ObjectId(String(change.variantId));
    const updated = await Product.findOneAndUpdate(
      { _id: productId, variants: { $elemMatch: { _id: variantId, stock: { $gte: need } } } },
      { $inc: { "variants.$.stock": qty, stock: qty } },
      { new: true, session, projection: { name: 1, sku: 1, variants: 1, stock: 1 } },
    ).lean();
    if (!updated) throw new InsufficientStockError(String(productId), String(variantId));
    const v = updated.variants.find((x) => String(x._id) === String(variantId))!;
    return { name: updated.name, sku: v.sku, previousStock: v.stock - qty, newStock: v.stock };
  }

  const updated = await Product.findOneAndUpdate(
    { _id: productId, "variants.0": { $exists: false }, stock: { $gte: need } },
    { $inc: { stock: qty } },
    { new: true, session, projection: { name: 1, sku: 1, stock: 1 } },
  ).lean();
  if (!updated) throw new InsufficientStockError(String(productId), null);
  return { name: updated.name, sku: updated.sku, previousStock: updated.stock - qty, newStock: updated.stock };
}

export async function adjustInventory(
  input: {
    productId: string;
    variantId?: string | null;
    adjustmentType: "restock" | "adjustment" | "damage" | "correction" | "return";
    quantityChange: number;
    reason: string;
  },
  admin: CurrentAdmin,
) {
  await connectDB();
  const product = await Product.findById(input.productId).select("variants name").lean();
  if (!product) throw notFound("Product not found.");
  if (product.variants.length > 0 && !input.variantId) throw badRequest("Choose which variant to adjust.");
  if (input.variantId && !product.variants.some((v) => String(v._id) === input.variantId)) throw notFound("Variant not found.");
  if (input.adjustmentType === "restock" && input.quantityChange < 0) throw badRequest("Restocks must add stock.");
  if (input.adjustmentType === "damage" && input.quantityChange > 0) throw badRequest("Damage write-offs must remove stock.");

  const result = await withTransaction(async (session) => {
    let res;
    try {
      res = await applyStockChange(
        { productId: input.productId, variantId: input.variantId, quantityChange: input.quantityChange },
        session,
      );
    } catch (err) {
      if (err instanceof InsufficientStockError) throw conflict("Stock cannot go below zero.");
      throw err;
    }
    await InventoryLog.create(
      [
        {
          productId: new Types.ObjectId(input.productId),
          variantId: input.variantId ? new Types.ObjectId(input.variantId) : undefined,
          sku: res.sku,
          productName: res.name,
          adjustmentType: input.adjustmentType,
          quantityChange: input.quantityChange,
          previousStock: res.previousStock,
          newStock: res.newStock,
          reason: input.reason,
          adminId: new Types.ObjectId(admin.id),
          adminName: admin.name,
        },
      ],
      { session: session ?? undefined },
    );
    return res;
  });

  await audit(admin, "inventory.adjust", "product", input.productId, {
    variantId: input.variantId ?? null,
    type: input.adjustmentType,
    change: input.quantityChange,
    newStock: result.newStock,
    reason: input.reason,
  });
  return result;
}

export async function listInventoryLogs(opts: { productId?: string; q?: string; type?: string; page: number; pageSize: number }) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.productId && Types.ObjectId.isValid(opts.productId)) filter.productId = new Types.ObjectId(opts.productId);
  if (opts.type) filter.adjustmentType = String(opts.type);
  if (opts.q) {
    const rx = { $regex: escapeRegex(opts.q), $options: "i" };
    filter.$or = [{ productName: rx }, { sku: rx }];
  }
  const [items, total] = await Promise.all([
    InventoryLog.find(filter).sort({ createdAt: -1 }).skip((opts.page - 1) * opts.pageSize).limit(opts.pageSize).lean(),
    InventoryLog.countDocuments(filter),
  ]);
  return { items, total };
}

export async function inventorySummary() {
  await connectDB();
  const [agg] = await Product.aggregate<{ total: number; out: number; low: number; units: number }>([
    { $match: { status: { $ne: "archived" } } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        units: { $sum: "$stock" },
        out: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
        low: { $sum: { $cond: [{ $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$lowStockThreshold"] }] }, 1, 0] } },
      },
    },
  ]);
  return agg ?? { total: 0, out: 0, low: 0, units: 0 };
}
