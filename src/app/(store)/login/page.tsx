import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getLoginConfig } from "@/lib/env";
import { OtpLoginForm } from "@/components/storefront/otp-login-form";
import { GoogleLogin } from "@/components/storefront/google-login";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** Only same-site relative paths are accepted as redirect targets (prevents open redirects). */
function safeNext(next: string | undefined) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || next.startsWith("/admin")) return "/account";
  return next;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getCurrentCustomer()) redirect(target);
  const login = getLoginConfig();

  return (
    <div className="container-page flex flex-col items-center gap-6 py-10 sm:py-16">
      {login.google && login.firebase && <GoogleLogin next={target} firebase={login.firebase} />}
      {login.google && login.phone && (
        <p className="flex w-full max-w-md items-center gap-3 text-xs font-medium uppercase tracking-wide text-subtle-foreground">
          <span className="h-px flex-1 bg-border" /> or use your mobile number <span className="h-px flex-1 bg-border" />
        </p>
      )}
      {login.phone && <OtpLoginForm next={target} firebase={login.phoneViaFirebase ? login.firebase : null} />}
    </div>
  );
}
