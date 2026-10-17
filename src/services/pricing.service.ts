import "server-only";
import { Types, type ClientSession } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import type { StoreSettings } from "@/lib/settings-defaults";
import type { CartLineDTO, QuoteDTO } from "@/types";
import { Product } from "@/models/Product";
import { Category } from "@/models/Category";
import type { CouponDoc } from "@/models/Coupon";
import { evaluateCoupon } from "./coupons.service";

export type CartItemInput = { productId: string; variantId?: string | null; quantity: number };

export type PricedLine = CartLineDTO & { gstRate: number; taxInclusive: boolean };

export type Quote = Omit<QuoteDTO, "lines"> & {
  lines: PricedLine[];
  couponDoc: CouponDoc | null;
  deliveryOption: StoreSettings["commerce"]["deliveryOptions"][number] | null;
};

const lineKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ""}`;

/** Merge duplicate lines and drop malformed ids. */
export function normalizeCartItems(items: CartItemInput[]): CartItemInput[] {
  const merged = new Map<string, CartItemInput>();
  for (const it of items) {
    if (!Types.ObjectId.isValid(it.productId) || (it.variantId && !Types.ObjectId.isValid(it.variantId))) continue;
    const key = lineKey(it.productId, it.variantId);
    const prev = merged.get(key);
    const quantity = Math.min(99, Math.max(1, Math.floor((prev?.quantity ?? 0) + it.quantity)));
    merged.set(key, { productId: it.productId, variantId: it.variantId || null, quantity });
  }
  return [...merged.values()];
}

/**
 * Computes a full price quote from current database values. This is the only
 * place totals are calculated; checkout re-runs it inside the order transaction.
 */
export async function buildQuote(opts: {
  items: CartItemInput[];
  settings: StoreSettings;
  couponCode?: string | null;
  deliveryOptionId?: string | null;
  userId: string | null;
  session?: ClientSession | null;
}): Promise<Quote> {
  await connectDB();
  const session = opts.session ?? null;
  const items = normalizeCartItems(opts.items);
  const ids = [...new Set(items.map((i) => i.productId))].map((i) => new Types.ObjectId(i));

  const products = ids.length
    ? await Product.find({ _id: { $in: ids } })
        .select("name slug sku images price originalPrice stock variants status categoryId tax")
        .session(session)
        .lean()
    : [];
  const categoryIds = [...new Set(products.map((p) => String(p.categoryId)))];
  const inactiveCats = new Set(
    (await Category.find({ _id: { $in: categoryIds }, status: "inactive" }).select("_id").session(session).lean()).map((c) => String(c._id)),
  );
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines: PricedLine[] = [];
  for (const item of items) {
    const p = byId.get(item.productId);
    const base: Omit<PricedLine, "unitPrice" | "originalPrice" | "quantity" | "available" | "lineTotal" | "issue"> = {
      key: lineKey(item.productId, item.variantId),
      productId: item.productId,
      variantId: item.variantId ?? null,
      name: p?.name ?? "Unavailable product",
      variantName: null,
      slug: p?.slug ?? "",
      sku: p?.sku ?? "",
      image: p?.images?.[0] ? { url: p.images[0].url, alt: p.images[0].alt ?? p.name } : null,
      requestedQuantity: item.quantity,
      gstRate: p?.tax?.gstRate ?? 0,
      taxInclusive: p?.tax?.inclusive ?? true,
    };
    if (!p || p.status !== "active" || inactiveCats.has(String(p.categoryId))) {
      lines.push({ ...base, unitPrice: 0, originalPrice: null, quantity: 0, available: 0, lineTotal: 0, issue: "unavailable" });
      continue;
    }

    let unitPrice = p.price;
    let originalPrice = p.originalPrice ?? null;
    let available = p.stock;
    let sku = p.sku;
    let variantName: string | null = null;

    if (p.variants.length > 0) {
      const v = item.variantId ? p.variants.find((x) => String(x._id) === item.variantId) : undefined;
      if (!v || v.status === "inactive") {
        lines.push({ ...base, unitPrice: p.price, originalPrice, quantity: 0, available: 0, lineTotal: 0, issue: "unavailable" });
        continue;
      }
      unitPrice = v.price ?? p.price;
      originalPrice = v.originalPrice ?? originalPrice;
      available = v.stock;
      sku = v.sku;
      variantName = v.name;
    } else if (item.variantId) {
      lines.push({ ...base, unitPrice, originalPrice, quantity: 0, available: 0, lineTotal: 0, issue: "unavailable" });
      continue;
    }

    const quantity = Math.min(item.quantity, Math.max(0, available));
    const issue = available <= 0 ? "out_of_stock" : quantity < item.quantity ? "insufficient_stock" : null;
    lines.push({
      ...base,
      sku,
      variantName,
      unitPrice,
      originalPrice: originalPrice && originalPrice > unitPrice ? originalPrice : null,
      quantity,
      available,
      lineTotal: unitPrice * quantity,
      issue,
    });
  }

  const valid = lines.filter((l) => l.quantity > 0);
  const subtotal = valid.reduce((s, l) => s + l.lineTotal, 0);
  const itemCount = valid.reduce((s, l) => s + l.quantity, 0);

  // Coupon
  let discount = 0;
  let coupon: QuoteDTO["coupon"] = null;
  let couponError: string | null = null;
  let couponDoc: CouponDoc | null = null;
  if (opts.couponCode && subtotal > 0) {
    const ev = await evaluateCoupon(opts.couponCode, subtotal, opts.userId, session);
    if (ev.ok) {
      discount = ev.discountAmount;
      couponDoc = ev.coupon;
      coupon = { code: ev.coupon.code, description: ev.coupon.description ?? "", discountAmount: discount };
    } else couponError = ev.error;
  }

  // GST: discount is apportioned across lines before tax is computed.
  let tax = 0;
  let taxIncluded = 0;
  for (const l of valid) {
    const share = subtotal > 0 ? l.lineTotal - (discount * l.lineTotal) / subtotal : 0;
    if (!l.gstRate) continue;
    if (l.taxInclusive) taxIncluded += share - share / (1 + l.gstRate / 100);
    else tax += (share * l.gstRate) / 100;
  }
  tax = Math.round(tax);
  taxIncluded = Math.round(taxIncluded);

  // Delivery
  const c = opts.settings.commerce;
  const afterDiscount = subtotal - discount;
  const qualifiesFree = c.freeDeliveryThreshold > 0 && afterDiscount >= c.freeDeliveryThreshold;
  const enabledOptions = c.deliveryOptions.filter((o) => o.enabled);
  const deliveryOptions = enabledOptions.map((o) => ({
    id: o.id,
    label: o.label,
    description: o.description,
    charge: qualifiesFree ? 0 : o.charge,
    etaText: o.etaText,
    free: qualifiesFree || o.charge === 0,
  }));
  const selected = enabledOptions.find((o) => o.id === opts.deliveryOptionId) ?? enabledOptions[0] ?? null;
  const deliveryCharge = valid.length && selected ? (qualifiesFree ? 0 : selected.charge) : 0;

  const total = Math.max(0, afterDiscount + tax + deliveryCharge);

  const issues: string[] = [];
  if (lines.some((l) => l.issue === "unavailable")) issues.push("Some items are no longer available and were removed from your total.");
  if (lines.some((l) => l.issue === "out_of_stock")) issues.push("Some items are out of stock.");
  if (lines.some((l) => l.issue === "insufficient_stock")) issues.push("Some quantities were reduced to match available stock.");
  if (c.minimumOrderValue > 0 && subtotal > 0 && subtotal < c.minimumOrderValue) issues.push("MIN_ORDER");
  if (!enabledOptions.length) issues.push("No delivery options are available right now.");

  return {
    lines,
    itemCount,
    subtotal,
    discount,
    tax,
    taxIncluded,
    deliveryCharge,
    total,
    coupon,
    couponError,
    couponDoc,
    deliveryOptions,
    deliveryOptionId: selected?.id ?? null,
    deliveryOption: selected,
    freeDeliveryThreshold: c.freeDeliveryThreshold,
    amountToFreeDelivery: c.freeDeliveryThreshold > 0 ? Math.max(0, c.freeDeliveryThreshold - afterDiscount) : 0,
    minimumOrderValue: c.minimumOrderValue,
    codEnabled: c.codEnabled,
    codAvailable: c.codEnabled && (c.codMaxOrderValue === 0 || total <= c.codMaxOrderValue),
    issues,
  };
}

/** Strips server-only fields before sending a quote to the browser. */
export function toQuoteDTO(q: Quote): QuoteDTO {
  const { couponDoc, deliveryOption, ...rest } = q;
  void couponDoc;
  void deliveryOption;
  return { ...rest, lines: rest.lines.map(({ gstRate, taxInclusive, ...l }) => (void gstRate, void taxInclusive, l)) };
}
