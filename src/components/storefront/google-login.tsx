"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/lib/client-api";
import { completeGoogleRedirect, firebaseErrorMessage, signInWithGoogle, startGoogleRedirect, type FirebaseWebConfig } from "@/lib/firebase-client";
import { Card } from "@/components/ui/display";
import { LogoMark } from "@/components/layout/logo";
import { useSession } from "@/components/providers/session-provider";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/**
 * "Continue with Google" via Firebase Authentication (free; no SMS costs). The
 * Google ID token is exchanged server-side for the store's own session cookie.
 */
export function GoogleLogin({ next, firebase, heading = true }: { next: string; firebase: FirebaseWebConfig; heading?: boolean }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const finish = React.useCallback(
    async (idToken: string) => {
      const res = await apiFetch<{ isNew: boolean }>("/api/auth/firebase", { body: { idToken } });
      await refresh();
      router.replace(res.isNew && next === "/account" ? "/account?welcome=1" : next);
      router.refresh();
    },
    [next, refresh, router],
  );

  // Returning from the redirect fallback.
  React.useEffect(() => {
    let cancelled = false;
    completeGoogleRedirect(firebase)
      .then(async (token) => {
        if (!token || cancelled) return;
        setLoading(true);
        await finish(token);
      })
      .catch((err) => !cancelled && setError(firebaseErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [firebase, finish]);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const token = await signInWithGoogle(firebase);
      await finish(token);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        await startGoogleRedirect(firebase); // navigates away
        return;
      }
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(code ? firebaseErrorMessage(err) : err instanceof Error ? err.message : "Sign-in failed. Please try again.");
      }
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="bg-[radial-gradient(80%_100%_at_0%_0%,var(--primary-soft)_0%,transparent_70%)] p-6 sm:p-8">
        {heading && (
          <>
            <LogoMark className="[&_img]:h-12" />
            <h1 className="mt-5 font-display text-2xl font-semibold">Sign in to Aarudhra</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">Use your Google account to track orders, save addresses and check out faster.</p>
          </>
        )}
        <button
          type="button"
          onClick={signIn}
          disabled={loading}
          aria-busy={loading || undefined}
          className="mt-6 flex h-12 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border border-border-strong bg-white text-[15px] font-semibold text-[#1f1f1f] shadow-soft transition-colors hover:bg-surface-muted disabled:opacity-60"
        >
          {loading ? <span className="size-5 animate-spin rounded-full border-2 border-border-strong border-t-primary" aria-hidden /> : <GoogleIcon />}
          {loading ? "Signing you in…" : "Continue with Google"}
        </button>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-subtle-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          We only receive your name and email from Google. Your mobile number is asked at checkout for delivery.
        </p>
      </div>
    </Card>
  );
}
