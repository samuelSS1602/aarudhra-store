/**
 * Role-based access control for staff. This module is shared with the client only
 * to hide controls a user can't use; every permission is enforced on the server
 * by `requireAdmin(permission)`.
 */

export const PERMISSIONS = [
  "dashboard:view",
  "analytics:view",
  "products:view",
  "products:write",
  "products:delete",
  "products:cost", // see / edit cost price & margins
  "categories:write",
  "inventory:view",
  "inventory:adjust",
  "orders:view",
  "orders:update",
  "orders:cancel",
  "orders:refund",
  "orders:override", // status changes outside the normal workflow
  "customers:view",
  "customers:pii", // full phone numbers and addresses
  "customers:write",
  "customers:suspend",
  "coupons:write",
  "notifications:view",
  "notifications:retry",
  "settings:write",
  "settings:security", // notification recipients, templates, payment toggles
  "admins:manage",
  "audit:view",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type StaffRole = "owner" | "admin" | "manager" | "staff";

const STAFF: Permission[] = [
  "dashboard:view",
  "products:view",
  "inventory:view",
  "orders:view",
  "orders:update",
  "customers:view",
  "customers:pii",
  "notifications:view",
];

const MANAGER: Permission[] = [
  ...STAFF,
  "analytics:view",
  "products:write",
  "categories:write",
  "inventory:adjust",
  "orders:cancel",
  "customers:write",
  "coupons:write",
  "notifications:retry",
  "settings:write",
];

const ADMIN: Permission[] = [
  ...MANAGER,
  "products:delete",
  "products:cost",
  "orders:refund",
  "orders:override",
  "customers:suspend",
  "settings:security",
  "audit:view",
];

export const ROLE_PERMISSIONS: Record<StaffRole, ReadonlySet<Permission>> = {
  staff: new Set(STAFF),
  manager: new Set(MANAGER),
  admin: new Set(ADMIN),
  owner: new Set(PERMISSIONS), // owner additionally manages staff accounts
};

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Store manager",
  staff: "Staff",
};

export function can(role: StaffRole | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Roles a given role may assign when managing staff (no privilege escalation). */
export function assignableRoles(role: StaffRole): StaffRole[] {
  if (role === "owner") return ["owner", "admin", "manager", "staff"];
  return [];
}
