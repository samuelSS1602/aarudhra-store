"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, FlaskConical, KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/client-api";
import { formatPhoneForDisplay, normalizePhone } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Alert, Card } from "@/components/ui/display";
import { useSession } from "@/components/providers/session-provider";
import type { ConfirmationResult } from "firebase/auth";
import { confirmFirebaseOtp, firebaseErrorMessage, sendFirebaseOtp, type FirebaseWebConfig } from "@/lib/firebase-client";

const RECAPTCHA_ID = "otp-recaptcha";
const FIREBASE_RESEND_SECONDS = 45;

type RequestResult = { phoneNumber: string; expiresInSeconds: number; resendInSeconds: number; devCode?: string };

export function OtpLoginForm({ next, firebase }: { next: string; firebase?: FirebaseWebConfig | null }) {
  const router = useRouter();
  const { refresh } = useSession();
  const [step, setStep] = React.useState<"phone" | "code">("phone");
  const [phone, setPhone] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState<RequestResult | null>(null);
  const [cooldown, setCooldown] = React.useState(0);
  const codeRef = React.useRef<HTMLInputElement>(null);
  const confirmation = React.useRef<ConfirmationResult | null>(null);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }
    setLoading(true);
    try {
      let res: RequestResult;
      if (firebase) {
        confirmation.current = await sendFirebaseOtp(firebase, normalized, RECAPTCHA_ID);
        res = { phoneNumber: normalized, expiresInSeconds: 300, resendInSeconds: FIREBASE_RESEND_SECONDS };
      } else {
        res = await apiFetch<RequestResult>("/api/auth/otp/request", { body: { phone: normalized } });
      }
      setSent(res);
      setCooldown(res.resendInSeconds);
      setStep("code");
      setCode("");
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (err) {
      setError(firebase ? firebaseErrorMessage(err) : err instanceof Error ? err.message : "Couldn't send OTP");
      if (err instanceof ApiError && typeof err.details.retryAfterSeconds === "number") setCooldown(err.details.retryAfterSeconds);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    if (!sent) return;
    setError(null);
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    try {
      let res: { isNew: boolean };
      if (firebase) {
        if (!confirmation.current) throw new Error("Please request a new OTP.");
        let idToken: string;
        try {
          idToken = await confirmFirebaseOtp(confirmation.current, code, firebase);
        } catch (fbErr) {
          throw new Error(firebaseErrorMessage(fbErr));
        }
        res = await apiFetch<{ isNew: boolean }>("/api/auth/firebase", { body: { idToken } });
      } else {
        res = await apiFetch<{ isNew: boolean }>("/api/auth/otp/verify", { body: { phone: sent.phoneNumber, code } });
      }
      await refresh();
      router.replace(res.isNew && next === "/account" ? "/account?welcome=1" : next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
      codeRef.current?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="bg-[radial-gradient(80%_100%_at_0%_0%,var(--primary-soft)_0%,transparent_70%)] p-6 sm:p-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-white shadow-soft">
          {step === "phone" ? <Smartphone className="size-6" /> : <KeyRound className="size-6" />}
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold">{step === "phone" ? "Sign in or create an account" : "Enter verification code"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {step === "phone" ? "We'll send a one-time password to your mobile number." : <>Sent to <span className="font-semibold text-foreground">{sent && formatPhoneForDisplay(sent.phoneNumber)}</span></>}
        </p>
      </div>

      <div className="p-6 pt-2 sm:p-8 sm:pt-2">
        <AnimatePresence mode="wait" initial={false}>
          {step === "phone" ? (
            <motion.form key="phone" onSubmit={requestOtp} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} noValidate>
              <Label htmlFor="phone">Mobile number</Label>
              <div className="mt-1.5 flex">
                <span className="flex h-11 items-center rounded-l-[var(--radius-md)] border border-r-0 border-border-strong bg-surface-muted px-3 text-[15px] font-medium text-muted-foreground">+91</span>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/[^\d\s+]/g, "").slice(0, 16))}
                  className="rounded-l-none"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-error" : undefined}
                  autoFocus
                  required
                />
              </div>
              {error && <p id="login-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" className="mt-5 w-full" loading={loading} disabled={cooldown > 0}>
                {cooldown > 0 ? `Try again in ${cooldown}s` : "Send OTP"}
              </Button>
            </motion.form>
          ) : (
            <motion.form key="code" onSubmit={verify} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} noValidate>
              {sent?.devCode && (
                <Alert tone="warning" icon={FlaskConical} title="Development mode" className="mb-4">
                  No SMS was sent. Test code: <span className="font-mono font-bold">{sent.devCode}</span>
                </Alert>
              )}
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                ref={codeRef}
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                }}
                className="mt-1.5 h-14 text-center font-mono text-2xl tracking-[0.5em]"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "otp-error" : "otp-help"}
                required
              />
              <p id="otp-help" className="mt-2 text-xs text-subtle-foreground">The code expires in {Math.round((sent?.expiresInSeconds ?? 300) / 60)} minutes.</p>
              {error && <p id="otp-error" role="alert" className="mt-2 text-sm text-danger">{error}</p>}
              <Button type="submit" size="lg" className="mt-5 w-full" loading={loading} disabled={code.length !== 6}>
                Verify &amp; continue
              </Button>
              <div className="mt-4 flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setStep("phone"); setError(null); }} className="inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground">
                  <ArrowLeft className="size-4" /> Change number
                </button>
                <button type="button" onClick={() => void requestOtp()} disabled={cooldown > 0 || loading} className="font-semibold text-primary disabled:text-subtle-foreground">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend OTP"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
        <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-subtle-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Your number is used to sign you in and for order updates. We never share it.
        </p>
        {/* Invisible reCAPTCHA anchor for Firebase phone sign-in. */}
        {firebase && <div id={RECAPTCHA_ID} />}
      </div>
    </Card>
  );
}
