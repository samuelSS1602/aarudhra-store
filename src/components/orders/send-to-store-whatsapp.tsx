"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, MessageCircle, RotateCcw } from "lucide-react";

type Stage = "loading" | "pending" | "opened" | "sent";

const AUTO_OPEN_SECONDS = 3;

/**
 * Required last step of checkout: sends the full order (with product photo links) to
 * the store's WhatsApp. A full-screen step opens WhatsApp automatically and stays
 * until the customer confirms they pressed Send. Works without any WhatsApp API setup.
 */
export function SendToStoreWhatsApp({ href, orderNumber }: { href: string; orderNumber: string }) {
  const key = `aas_wa_${orderNumber}`;
  const [stage, setStage] = React.useState<Stage>("loading");
  const [countdown, setCountdown] = React.useState(AUTO_OPEN_SECONDS);

  const save = React.useCallback(
    (s: Stage) => {
      setStage(s);
      try {
        localStorage.setItem(key, s);
      } catch {
        /* storage unavailable */
      }
    },
    [key],
  );

  React.useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {
      /* storage unavailable */
    }
    setStage(saved === "sent" || saved === "opened" ? saved : "pending");
  }, [key]);

  // Open WhatsApp automatically once, after a short countdown.
  React.useEffect(() => {
    if (stage !== "pending") return;
    if (countdown <= 0) {
      save("opened");
      window.location.href = href;
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [stage, countdown, href, save]);

  // Keep the page behind the step from scrolling.
  React.useEffect(() => {
    if (stage !== "pending" && stage !== "opened") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [stage]);

  const openButton = (label: string, Icon = MessageCircle) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => save("opened")}
      className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-[#1a8f4c] px-5 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-[#15783f]"
    >
      <Icon className="size-5" /> {label}
    </a>
  );

  return (
    <>
      <AnimatePresence>
        {(stage === "pending" || stage === "opened") && (
          <motion.div
            key="wa-step"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end justify-center bg-[#0b1240]/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wa-step-title"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="pb-safe w-full max-w-md rounded-t-[1.75rem] bg-surface p-6 text-center shadow-lift sm:rounded-[1.75rem] sm:p-8"
            >
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_10px_30px_-8px_rgba(37,211,102,0.7)]">
                <MessageCircle className="size-8" />
              </div>
              <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#1a8f4c]">Last step · Order {orderNumber}</p>
              {stage === "pending" ? (
                <>
                  <h2 id="wa-step-title" className="mt-1.5 font-display text-2xl font-semibold">Send your order on WhatsApp</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Your order is saved. WhatsApp will open with your order details and product photos ready. Just press <strong>Send</strong> so the store can confirm it.
                  </p>
                  <div className="mt-6">{openButton("Open WhatsApp now")}</div>
                  <p className="mt-3 text-xs text-subtle-foreground" aria-live="polite">
                    Opening automatically in {countdown}s…
                  </p>
                </>
              ) : (
                <>
                  <h2 id="wa-step-title" className="mt-1.5 font-display text-2xl font-semibold">Did you press Send?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    The store confirms your order once your WhatsApp message arrives. If WhatsApp didn&apos;t open or you didn&apos;t send it, open it again.
                  </p>
                  <div className="mt-6 grid gap-2.5">
                    <button
                      type="button"
                      onClick={() => save("sent")}
                      className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] bg-primary px-5 py-3.5 text-base font-semibold text-white shadow-soft transition-colors hover:bg-primary/90"
                    >
                      <CheckCircle2 className="size-5" /> Yes, I sent it
                    </button>
                    {openButton("Open WhatsApp again", RotateCcw)}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {stage === "sent" && (
        <div className="mt-8 flex flex-col gap-3 rounded-[var(--radius-2xl)] border border-[#25D366]/30 bg-[#effcf3] p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
            <CheckCircle2 className="size-6" />
          </div>
          <p className="flex-1 text-sm">
            <span className="block font-semibold text-foreground">Order sent to the store on WhatsApp</span>
            <span className="text-muted-foreground">The store will reply on WhatsApp to confirm.</span>
          </p>
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#1a8f4c] underline-offset-4 hover:underline">
            Send again
          </a>
        </div>
      )}
    </>
  );
}
