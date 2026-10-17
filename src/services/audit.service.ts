import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongodb";
import { redact } from "@/lib/logger";
import { escapeRegex } from "@/lib/utils";
import type { CurrentAdmin } from "@/lib/auth/admin-session";
import { AuditLog } from "@/models/misc";

/** Records a sensitive administrative action. Metadata is redacted of secrets. */
export async function audit(
  admin: Pick<CurrentAdmin, "id" | "name" | "role" | "ip"> | null,
  action: string,
  resourceType: string,
  resourceId?: string | Types.ObjectId | null,
  metadata: Record<string, unknown> = {},
) {
  await connectDB();
  await AuditLog.create({
    adminId: admin ? new Types.ObjectId(admin.id) : undefined,
    adminName: admin?.name,
    adminRole: admin?.role,
    action,
    resourceType,
    resourceId: resourceId ? String(resourceId) : undefined,
    sanitizedMetadata: redact(metadata),
    ip: admin?.ip,
  });
}

export async function listAuditLogs(opts: { page: number; pageSize: number; resourceType?: string; q?: string }) {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (opts.resourceType) filter.resourceType = opts.resourceType;
  if (opts.q) filter.action = { $regex: escapeRegex(opts.q), $options: "i" };
  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.pageSize)
      .limit(opts.pageSize)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}

