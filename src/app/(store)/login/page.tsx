import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentCustomer } from "@/lib/auth/session";
import { getFirebaseClientConfig } from "@/lib/env";
import { OtpLoginForm } from "@/components/storefront/otp-login-form";

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
  return (
    <div className="container-page flex justify-center py-10 sm:py-16">
      <OtpLoginForm next={target} firebase={getFirebaseClientConfig()} />
    </div>
  );
}
