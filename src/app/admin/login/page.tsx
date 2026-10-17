import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth/admin-session";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { LogoFull } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Admin sign in", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

function safeNext(next?: string) {
  return next && next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentAdmin()) redirect(safeNext(next));
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(70%_60%_at_50%_0%,var(--primary-soft)_0%,transparent_70%)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoFull priority className="w-60" />
          <h1 className="mt-6 font-display text-2xl font-semibold">Store dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Aarudhra Smart Store staff sign in</p>
        </div>
        <AdminLoginForm next={safeNext(next)} />
      </div>
    </div>
  );
}
