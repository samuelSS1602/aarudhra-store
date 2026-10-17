import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getEnv } from "@/lib/env";
import { hmacHash, randomToken } from "@/lib/security/crypto";
import { forbidden, unauthorized } from "@/lib/errors";
import { Session } from "@/models/Session";
import { User, type UserDoc } from "@/models/User";
import { CUSTOMER_COOKIE, CUSTOMER_SESSION_DAYS } from "./cookies";

export type CurrentCustomer = {
  id: string;
  name: string;
  phoneNumber: string;
  email?: string | null;
  accountStatus: "active" | "suspended";
};

const hashToken = (token: string) => hmacHash(`customer:${token}`, getEnv().AUTH_SECRET);

export async function createCustomerSession(userId: Types.ObjectId | string, meta: { ip?: string; userAgent?: string }) {
  await connectDB();
  const token = randomToken(32);
  await Session.create({
    tokenHash: hashToken(token),
    userId: new Types.ObjectId(String(userId)),
    expiresAt: new Date(Date.now() + CUSTOMER_SESSION_DAYS * 24 * 60 * 60 * 1000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { token, maxAge: CUSTOMER_SESSION_DAYS * 24 * 60 * 60 };
}

export async function destroyCustomerSession(token: string | undefined) {
  if (!token) return;
  await connectDB();
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export async function revokeAllCustomerSessions(userId: Types.ObjectId | string) {
  await connectDB();
  await Session.deleteMany({ userId: new Types.ObjectId(String(userId)) });
}

function toCurrent(user: Pick<UserDoc, "_id" | "name" | "phoneNumber" | "email" | "accountStatus">): CurrentCustomer {
  return {
    id: String(user._id),
    name: user.name ?? "",
    phoneNumber: user.phoneNumber,
    email: user.email ?? null,
    accountStatus: (user.accountStatus as CurrentCustomer["accountStatus"]) ?? "active",
  };
}

export async function getCustomerFromToken(token: string | undefined | null): Promise<CurrentCustomer | null> {
  if (!token || token.length > 200) return null;
  await connectDB();
  // Session + user in one round-trip (this runs on every page for signed-in customers).
  const [session] = await Session.aggregate<{ _id: unknown; lastSeenAt?: Date; user?: Pick<UserDoc, "_id" | "name" | "phoneNumber" | "email" | "accountStatus"> }>([
    { $match: { tokenHash: hashToken(token), expiresAt: { $gt: new Date() } } },
    { $limit: 1 },
    {
      $lookup: {
        from: User.collection.name,
        localField: "userId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, phoneNumber: 1, email: 1, accountStatus: 1 } }],
        as: "user",
      },
    },
    { $project: { lastSeenAt: 1, user: { $first: "$user" } } },
  ]);
  if (!session) return null;
  const user = session.user;
  if (!user || user.accountStatus !== "active") return null;
  // Touch lastSeenAt at most every 10 minutes to avoid a write on every request.
  if (!session.lastSeenAt || Date.now() - new Date(session.lastSeenAt).getTime() > 10 * 60 * 1000) {
    void Session.updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return toCurrent(user);
}

/** Route handlers: resolve the customer from the request cookie. */
export async function getCustomerFromRequest(req: NextRequest) {
  return getCustomerFromToken(req.cookies.get(CUSTOMER_COOKIE)?.value);
}

export async function requireCustomer(req: NextRequest): Promise<CurrentCustomer> {
  const customer = await getCustomerFromRequest(req);
  if (!customer) throw unauthorized();
  if (customer.accountStatus !== "active") throw forbidden("Your account is suspended. Please contact the store.");
  return customer;
}

/** Server Components: the signed-in customer for this request (memoised per render). */
export const getCurrentCustomer = cache(async (): Promise<CurrentCustomer | null> => {
  const store = await cookies();
  return getCustomerFromToken(store.get(CUSTOMER_COOKIE)?.value);
});
