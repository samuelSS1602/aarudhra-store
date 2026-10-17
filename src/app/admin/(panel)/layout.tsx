import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { AdminShell } from "@/components/admin/admin-shell";
import { MotionProvider } from "@/components/providers/motion-provider";

export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Admin" },
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

/** Server-side gate for every admin page. Pages additionally check their own permission. */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/admin/login");
  return (
    <MotionProvider>
      <AdminShell admin={{ name: admin.name, email: admin.email, role: admin.role }}>{children}</AdminShell>
    </MotionProvider>
  );
}
