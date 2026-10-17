import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { formatPhoneForDisplay } from "@/lib/phone";
import { initials } from "@/lib/utils";
import { AccountNav } from "@/components/account/account-nav";

export const metadata: Metadata = { title: { default: "My account", template: "%s | My account" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCurrentCustomer();
  if (!customer) redirect("/login?next=/account");
  return (
    <div className="container-page py-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside className="min-w-0">
          <div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-surface p-4 shadow-soft">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white">
              {customer.name ? initials(customer.name) : "👋"}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold">{customer.name || "Welcome!"}</p>
              <p className="truncate text-sm text-muted-foreground">{formatPhoneForDisplay(customer.phoneNumber)}</p>
            </div>
          </div>
          <AccountNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
