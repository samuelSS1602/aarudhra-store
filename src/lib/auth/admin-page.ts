import "server-only";
import { redirect } from "next/navigation";
import { can, type Permission } from "@/lib/permissions";
import { getCurrentAdmin, type CurrentAdmin } from "./admin-session";

/** Server Component guard: signed-in staff with the given permission, else redirect. */
export async function requireAdminPage(permission: Permission): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  if (!can(admin.role, permission)) redirect("/admin?denied=1");
  return admin;
}
