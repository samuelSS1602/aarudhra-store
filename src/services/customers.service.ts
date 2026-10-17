import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { badRequest, notFound } from "@/lib/errors";
import { escapeRegex } from "@/lib/utils";
import { normalizePhone } from "@/lib/phone";
import { toAddressDTO, toProductCardDTO } from "@/lib/serialize";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { revokeAllCustomerSessions } from "@/lib/auth/session";
import type { AddressInput } from "@/lib/validation/schemas";
import { User } from "@/models/User";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { audit } from "./audit.service";

const MAX_ADDRESSES = 10;

/* ------------------------------ Self-service ------------------------------ */

export async function getProfile(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("name phoneNumber email addresses preferences createdAt").lean();
  if (!u) throw notFound("Account not found.");
  return {
    id: String(u._id),
    name: u.name ?? "",
    phoneNumber: u.phoneNumber,
    email: u.email ?? "",
    preferences: { whatsappOrderUpdates: Boolean(u.preferences?.whatsappOrderUpdates), marketingOptIn: Boolean(u.preferences?.marketingOptIn) },
    addresses: (u.addresses ?? []).map(toAddressDTO),
    createdAt: new Date(u.createdAt).toISOString(),
  };
}

/** Only whitelisted fields can change — phone and role are never writable here. */
export async function updateProfile(
  userId: string,
  input: { name: string; email?: string; preferences?: { whatsappOrderUpdates?: boolean; marketingOptIn?: boolean } },
) {
  await connectDB();
  const set: Record<string, unknown> = { name: input.name };
  const unset: Record<string, 1> = {};
  if (input.email) set.email = input.email;
  else unset.email = 1;
  if (input.preferences?.whatsappOrderUpdates !== undefined) set["preferences.whatsappOrderUpdates"] = input.preferences.whatsappOrderUpdates;
  if (input.preferences?.marketingOptIn !== undefined) set["preferences.marketingOptIn"] = input.preferences.marketingOptIn;
  await User.updateOne({ _id: userId }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) });
  return getProfile(userId);
}

export async function addAddress(userId: string, input: AddressInput) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw notFound("Account not found.");
  if (user.addresses.length >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses.`);
  const makeDefault = input.isDefault || user.addresses.length === 0;
  if (makeDefault) user.addresses.forEach((a) => (a.isDefault = false));
  user.addresses.push({ ...input, isDefault: makeDefault });
  await user.save();
  return user.addresses.map((a) => toAddressDTO(a.toObject()));
}

export async function updateAddress(userId: string, addressId: string, input: AddressInput) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw notFound("Account not found.");
  // Ownership: the address must belong to this user's own document.
  const addr = user.addresses.id(addressId);
  if (!addr) throw notFound("Address not found.");
  if (input.isDefault) user.addresses.forEach((a) => (a.isDefault = false));
  addr.set({ ...input, isDefault: input.isDefault || addr.isDefault });
  await user.save();
  return user.addresses.map((a) => toAddressDTO(a.toObject()));
}

export async function deleteAddress(userId: string, addressId: string) {
  await connectDB();
  const user = await User.findById(userId);
  if (!user) throw notFound("Account not found.");
  const addr = user.addresses.id(addressId);
  if (!addr) throw notFound("Address not found.");
  const wasDefault = addr.isDefault;
  addr.deleteOne();
  if (wasDefault && user.addresses[0]) user.addresses[0].isDefault = true;
  await user.save();
  return user.addresses.map((a) => toAddressDTO(a.toObject()));
}

export async function getWishlist(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("wishlist").lean();
  if (!u?.wishlist?.length) return [];
  const products = await Product.find({ _id: { $in: u.wishlist }, status: "active" })
    .select("name slug brand images price originalPrice discountPercent stock lowStockThreshold variants categoryId")
    .lean();
  return products.map(toProductCardDTO);
}

export async function getWishlistIds(userId: string) {
  await connectDB();
  const u = await User.findById(userId).select("wishlist").lean();
  return (u?.wishlist ?? []).map(String);
}

export async function toggleWishlist(userId: string, productId: string, add: boolean) {
  await connectDB();
  if (add) {
    if (!(await Product.exists({ _id: productId, status: "active" }))) throw notFound("Product not found.");
    await User.updateOne({ _id: userId, "wishlist.99": { $exists: false } }, { $addToSet: { wishlist: new Types.ObjectId(productId) } });
  } else {
    await User.updateOne({ _id: userId }, { $pull: { wishlist: new Types.ObjectId(productId) } });
  }
  return getWishlistIds(userId);
}

/* ---------------------------------- Admin --------------------------------- */

export async function listCustomers(opts: { q?: string; status?: string; sort?: string; page: number; pageSize: number }) {
  await connectDB();
  const match: Record<string, unknown> = {};
  if (opts.status) match.accountStatus = String(opts.status);
  if (opts.q) {
    const phone = normalizePhone(opts.q);
    const rx = { $regex: escapeRegex(opts.q), $options: "i" };
    match.$or = [{ name: rx }, { email: rx }, phone ? { phoneNumber: phone } : { phoneNumber: rx }];
  }
  const sortStage: Record<string, 1 | -1> =
    opts.sort === "orders" ? { orderCount: -1 } : opts.sort === "value" ? { totalValue: -1 } : { createdAt: -1 };

  const [rows, total] = await Promise.all([
    User.aggregate([
      { $match: match },
      {
        $lookup: {
          from: "orders",
          let: { uid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", "$$uid"] } } },
            {
              $group: {
                _id: null,
                orderCount: { $sum: 1 },
                totalValue: { $sum: { $cond: [{ $in: ["$orderStatus", ["cancelled"]] }, 0, "$totalAmount"] } },
                lastOrderAt: { $max: "$createdAt" },
              },
            },
          ],
          as: "stats",
        },
      },
      {
        $addFields: {
          orderCount: { $ifNull: [{ $first: "$stats.orderCount" }, 0] },
          totalValue: { $ifNull: [{ $first: "$stats.totalValue" }, 0] },
          lastOrderAt: { $first: "$stats.lastOrderAt" },
          addressCount: { $size: { $ifNull: ["$addresses", []] } },
        },
      },
      { $sort: sortStage },
      { $skip: (opts.page - 1) * opts.pageSize },
      { $limit: opts.pageSize },
      { $project: { name: 1, phoneNumber: 1, email: 1, accountStatus: 1, createdAt: 1, orderCount: 1, totalValue: 1, lastOrderAt: 1, addressCount: 1 } },
    ]),
    User.countDocuments(match),
  ]);
  return { items: rows, total };
}

export async function getCustomerForAdmin(id: string) {
  await connectDB();
  if (!Types.ObjectId.isValid(id)) return null;
  const u = await User.findById(id).select("-wishlist").lean();
  if (!u) return null;
  const [stats] = await Order.aggregate<{ orderCount: number; totalValue: number; lastOrderAt: Date }>([
    { $match: { userId: u._id } },
    {
      $group: {
        _id: null,
        orderCount: { $sum: 1 },
        totalValue: { $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 0, "$totalAmount"] } },
        lastOrderAt: { $max: "$createdAt" },
      },
    },
  ]);
  return { user: u, stats: stats ?? { orderCount: 0, totalValue: 0, lastOrderAt: null } };
}

export async function updateCustomerAsAdmin(
  id: string,
  input: { name?: string; email?: string; accountStatus?: "active" | "suspended" },
  admin: CurrentAdmin,
) {
  await connectDB();
  const user = await User.findById(id);
  if (!user) throw notFound("Customer not found.");
  const before = { name: user.name, email: user.email, accountStatus: user.accountStatus };
  if (input.name !== undefined) user.name = input.name;
  if (input.email !== undefined) user.email = input.email || undefined;
  if (input.accountStatus) user.accountStatus = input.accountStatus;
  await user.save();
  if (input.accountStatus === "suspended") await revokeAllCustomerSessions(user._id);
  await audit(admin, input.accountStatus && input.accountStatus !== before.accountStatus ? `customer.${input.accountStatus === "suspended" ? "suspend" : "reactivate"}` : "customer.update", "customer", user._id, {
    before,
    after: { name: user.name, email: user.email, accountStatus: user.accountStatus },
  });
}

export async function addCustomerNote(id: string, note: string, admin: CurrentAdmin) {
  await connectDB();
  const res = await User.updateOne({ _id: id }, { $push: { internalNotes: { note, adminId: new Types.ObjectId(admin.id), adminName: admin.name } } });
  if (res.matchedCount !== 1) throw notFound("Customer not found.");
  await audit(admin, "customer.note", "customer", id, { length: note.length });
}

export async function listAllAddresses(opts: { q?: string; page: number; pageSize: number }) {
  await connectDB();
  const pipeline: Record<string, unknown>[] = [{ $unwind: "$addresses" }];
  if (opts.q) {
    const rx = { $regex: escapeRegex(opts.q), $options: "i" };
    pipeline.push({ $match: { $or: [{ name: rx }, { phoneNumber: rx }, { "addresses.city": rx }, { "addresses.pincode": rx }, { "addresses.fullName": rx }, { "addresses.district": rx }] } });
  }
  const [rows, countRes] = await Promise.all([
    User.aggregate([
      ...pipeline,
      { $sort: { "addresses.updatedAt": -1 } },
      { $skip: (opts.page - 1) * opts.pageSize },
      { $limit: opts.pageSize },
      { $project: { name: 1, phoneNumber: 1, address: "$addresses" } },
    ] as never[]),
    User.aggregate([...pipeline, { $count: "n" }] as never[]),
  ]);
  return { items: rows as { _id: Types.ObjectId; name: string; phoneNumber: string; address: Record<string, unknown> }[], total: (countRes[0] as { n?: number })?.n ?? 0 };
}
