import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/security/crypto";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { revokeAdminSessions } from "@/lib/auth/admin-session";
import { assignableRoles, type StaffRole } from "@/lib/permissions";
import { AdminUser } from "@/models/AdminUser";
import { audit } from "./audit.service";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Pre-computed scrypt hash of a random string; verifying against it keeps timing
// similar whether or not the email exists.
let dummyHash: string | null = null;

const INVALID = () => new AppError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");

export async function authenticateAdmin(email: string, password: string, ip: string) {
  await connectDB();
  await enforceRateLimit(`admin-login:ip:${ip}`, 20, 15 * 60, "Too many sign-in attempts. Please wait 15 minutes.");
  await enforceRateLimit(`admin-login:email:${email}`, 10, 15 * 60, "Too many sign-in attempts. Please wait 15 minutes.");

  const admin = await AdminUser.findOne({ email }).select("+passwordHash");
  if (!admin) {
    dummyHash ??= await hashPassword(`dummy-${Math.random()}`);
    await verifyPassword(password, dummyHash);
    throw INVALID();
  }
  if (admin.lockedUntil && admin.lockedUntil > new Date()) {
    throw new AppError(423, "LOCKED", "This account is temporarily locked after repeated failed sign-ins. Try again later.");
  }
  const ok = await verifyPassword(password, admin.passwordHash);
  if (!ok) {
    const failed = (admin.failedLoginCount ?? 0) + 1;
    await AdminUser.updateOne(
      { _id: admin._id },
      {
        $set: {
          failedLoginCount: failed >= MAX_FAILED ? 0 : failed,
          ...(failed >= MAX_FAILED ? { lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : {}),
        },
      },
    );
    if (failed >= MAX_FAILED) await audit({ id: String(admin._id), name: admin.name, role: admin.role as StaffRole, ip }, "admin.locked", "admin", admin._id, {});
    throw INVALID();
  }
  if (admin.status !== "active") throw INVALID();

  await AdminUser.updateOne({ _id: admin._id }, { $set: { failedLoginCount: 0, lastLoginAt: new Date() }, $unset: { lockedUntil: 1 } });
  await audit({ id: String(admin._id), name: admin.name, role: admin.role as StaffRole, ip }, "admin.login", "admin", admin._id, {});
  return admin;
}

export async function listAdmins() {
  await connectDB();
  return AdminUser.find().sort({ createdAt: 1 }).lean();
}

export async function createAdminUser(
  input: { name: string; email: string; role: StaffRole; password: string },
  actor: CurrentAdmin | null,
) {
  await connectDB();
  if (actor && !assignableRoles(actor.role).includes(input.role)) throw forbidden("You can't assign this role.");
  if (await AdminUser.exists({ email: input.email })) throw conflict("A staff account with this email already exists.", { field: "email" });
  const admin = await AdminUser.create({
    name: input.name,
    email: input.email,
    role: input.role,
    passwordHash: await hashPassword(input.password),
    passwordChangedAt: new Date(),
    createdBy: actor ? new Types.ObjectId(actor.id) : undefined,
  });
  await audit(actor, "admin.create", "admin", admin._id, { email: admin.email, role: admin.role });
  return admin;
}

export async function updateAdminUser(
  id: string,
  input: { role?: StaffRole; status?: "active" | "disabled"; password?: string },
  actor: CurrentAdmin,
) {
  await connectDB();
  const target = await AdminUser.findById(id);
  if (!target) throw notFound("Staff account not found.");
  if (String(target._id) === actor.id && (input.role || input.status === "disabled")) {
    throw badRequest("You can't change your own role or disable your own account.");
  }
  if (input.role && !assignableRoles(actor.role).includes(input.role)) throw forbidden("You can't assign this role.");

  // Never leave the store without an active owner.
  if ((input.role && input.role !== "owner") || input.status === "disabled") {
    if (target.role === "owner") {
      const owners = await AdminUser.countDocuments({ role: "owner", status: "active", _id: { $ne: target._id } });
      if (owners === 0) throw badRequest("At least one active owner account is required.");
    }
  }
  const changes: Record<string, unknown> = {};
  if (input.role) target.role = changes.role = input.role;
  if (input.status) target.status = changes.status = input.status;
  if (input.password) {
    target.passwordHash = await hashPassword(input.password);
    target.passwordChangedAt = new Date();
    changes.password = "changed";
  }
  await target.save();
  if (input.status === "disabled" || input.password || input.role) await revokeAdminSessions(target._id);
  await audit(actor, "admin.update", "admin", target._id, changes);
  return target;
}
