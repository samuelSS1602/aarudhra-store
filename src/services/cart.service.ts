import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { Cart } from "@/models/misc";
import { normalizeCartItems, type CartItemInput } from "./pricing.service";

const toInput = (items: { productId: Types.ObjectId; variantId?: Types.ObjectId | null; quantity: number }[]): CartItemInput[] =>
  items.map((i) => ({ productId: String(i.productId), variantId: i.variantId ? String(i.variantId) : null, quantity: i.quantity }));

const toDoc = (items: CartItemInput[]) =>
  items.map((i) => ({
    productId: new Types.ObjectId(i.productId),
    ...(i.variantId ? { variantId: new Types.ObjectId(i.variantId) } : {}),
    quantity: i.quantity,
  }));

export async function getCart(userId: string) {
  await connectDB();
  const cart = await Cart.findOne({ userId: new Types.ObjectId(userId) }).lean();
  return { items: cart ? toInput(cart.items) : [], couponCode: cart?.couponCode ?? null };
}

export async function saveCart(userId: string, items: CartItemInput[], couponCode?: string | null) {
  await connectDB();
  const normalized = normalizeCartItems(items).slice(0, 100);
  await Cart.updateOne(
    { userId: new Types.ObjectId(userId) },
    { $set: { items: toDoc(normalized), couponCode: couponCode || undefined } },
    { upsert: true },
  );
  return { items: normalized, couponCode: couponCode ?? null };
}

/** Merges a guest (browser) cart into the saved cart after login. Quantities add up, capped at 99. */
export async function mergeGuestCart(userId: string, guestItems: CartItemInput[]) {
  const current = await getCart(userId);
  return saveCart(userId, [...current.items, ...guestItems], current.couponCode);
}

export async function clearCart(userId: string) {
  await connectDB();
  await Cart.updateOne({ userId: new Types.ObjectId(userId) }, { $set: { items: [] }, $unset: { couponCode: 1 } });
}
