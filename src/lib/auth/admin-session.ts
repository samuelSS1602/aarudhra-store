import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { getEnv } from "@/lib/env";
import { hmacHash, randomToken } from "@/lib/security/crypto";
import { forbidden, unauthorized } from "@/lib/errors";
import { can, type Permission, type StaffRole } from "@/lib/permissions";
import { AdminSession } from "@/models/AdminSession";
import { AdminUser } from "@/models/AdminUser";
import { ADMIN_COOKIE, ADMIN_IDLE_MINUTES, ADMIN_SESSION_HOURS } from "./cookies";

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  ip?: string;
};

const hashToken = (token: string) => hmacHash(`admin:${token}`, getEnv().ADMIN_SESSION_SECRET);

export async function createAdminSession(adminId: Types.ObjectId | string, meta: { ip?: string; userAgent?: string }) {
  await connectDB();
  const token = randomToken(32);
  const now = Date.now();
  await AdminSession.create({
    tokenHash: hashToken(token),
    adminId: new Types.ObjectId(String(adminId)),
    expiresAt: new Date(now + ADMIN_SESSION_HOURS * 60 * 60 * 1000),
    idleExpiresAt: new Date(now + ADMIN_IDLE_MINUTES * 60 * 1000),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });
  return { token, maxAge: ADMIN_SESSION_HOURS * 60 * 60 };
}

export async function destroyAdminSession(token: string | undefined) {
  if (!token) return;
  await connectDB();
  await AdminSession.deleteOne({ tokenHash: hashToken(token) });
}

export async function revokeAdminSessions(adminId: Types.ObjectId | string) {
  await connectDB();
  await AdminSession.deleteMany({ adminId: new Types.ObjectId(String(adminId)) });
}

export async function getAdminFromToken(token: string | undefined | null): Promise<CurrentAdmin | null> {
  if (!token || token.length > 200) return null;
  await connectDB();
  const now = new Date();
  // Session + staff account in a single round-trip (runs on every admin page and poll).
  const [session] = await AdminSession.aggregate<{
    _id: unknown;
    idleExpiresAt: Date;
    admin?: { _id: unknown; name: string; email: string; role: string; status: string };
  }>([
    { $match: { tokenHash: hashToken(token), expiresAt: { $gt: now }, idleExpiresAt: { $gt: now } } },
    { $limit: 1 },
    {
      $lookup: {
        from: AdminUser.collection.name,
        localField: "adminId",
        foreignField: "_id",
        pipeline: [{ $project: { name: 1, email: 1, role: 1, status: 1 } }],
        as: "admin",
      },
    },
    { $project: { idleExpiresAt: 1, admin: { $first: "$admin" } } },
  ]);
  if (!session) return null;
  const admin = session.admin;
  if (!admin || admin.status !== "active") return null;
  // Sliding idle timeout, refreshed at most every 5 minutes, without blocking the page.
  const idleTarget = now.getTime() + ADMIN_IDLE_MINUTES * 60 * 1000;
  if (idleTarget - new Date(session.idleExpiresAt).getTime() > 5 * 60 * 1000) {
    void AdminSession.updateOne({ _id: session._id }, { $set: { idleExpiresAt: new Date(idleTarget) } }).catch(() => undefined);
  }
  return { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role as StaffRole };
}

/**
 * Route handlers: authenticate staff and enforce a permission server-side.
 * Customers (who hold a different cookie) can never pass this check.
 */
export async function requireAdmin(req: NextRequest, permission?: Permission): Promise<CurrentAdmin> {
  const admin = await getAdminFromToken(req.cookies.get(ADMIN_COOKIE)?.value);
  if (!admin) throw unauthorized("Please sign in to the admin dashboard.");
  if (permission && !can(admin.role, permission)) throw forbidden();
  const xff = req.headers.get("x-forwarded-for");
  return { ...admin, ip: xff ? xff.split(",")[0]!.trim() : undefined };
}

/** Server Components: current staff member, memoised per render. */
export const getCurrentAdmin = cache(async (): Promise<CurrentAdmin | null> => {
  const store = await cookies();
  return getAdminFromToken(store.get(ADMIN_COOKIE)?.value);
});
