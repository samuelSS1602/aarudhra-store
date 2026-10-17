import { requireAdminPage } from "@/lib/auth/admin-page";
import { listAdmins } from "@/services/admin-users.service";
import { PageHeader } from "@/components/admin/ui";
import { AdminUsersManager } from "@/components/admin/admin-users-manager";
import type { StaffRole } from "@/lib/permissions";

export const metadata = { title: "Admin users" };

export default async function AdminsPage() {
  const me = await requireAdminPage("admins:manage");
  const admins = await listAdmins();
  return (
    <div>
      <PageHeader title="Admin users" description="Staff accounts and their roles. Customers can never access the dashboard." />
      <AdminUsersManager
        meId={me.id}
        admins={admins.map((a) => ({
          id: String(a._id),
          name: a.name,
          email: a.email,
          role: a.role as StaffRole,
          status: a.status as "active" | "disabled",
          lastLoginAt: a.lastLoginAt ? new Date(a.lastLoginAt).toISOString() : null,
          locked: Boolean(a.lockedUntil && new Date(a.lockedUntil) > new Date()),
        }))}
      />
    </div>
  );
}
