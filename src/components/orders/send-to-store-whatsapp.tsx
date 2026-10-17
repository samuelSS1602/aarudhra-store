"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, MessageCircle } from "lucide-react";

/**
 * Opens WhatsApp with the full order details pre-filled to the store's company
 * number. Works without any WhatsApp API setup; the customer taps "Send" in
 * WhatsApp. (Automatic, no-tap alerts use the Cloud API — see README §9.)
 */
export function SendToStoreWhatsApp({ href, orderNumber }: { href: string; orderNumber: string }) {
  const storageKey = `aas_wa_sent_${orderNumber}`;
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    try {
      setSent(sessionStorage.getItem(storageKey) === "1");
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  function markSent() {
    setSent(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="mt-8 rounded-[var(--radius-2xl)] border border-[#25D366]/30 bg-[#effcf3] p-5 sm:flex sm:items-center sm:gap-5 sm:p-6"
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
        <MessageCircle className="size-6" />
      </div>
      <div className="mt-3 flex-1 sm:mt-0">
        <p className="font-semibold text-foreground">{sent ? "Order details opened in WhatsApp" : "Send your order to the store on WhatsApp"}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {sent
            ? "If you didn't press Send in WhatsApp, tap the button again."
            : "One tap opens WhatsApp with your full order ready — just press Send so the store can confirm it faster."}
        </p>
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markSent}
        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[#1a8f4c] px-5 text-[15px] font-semibold text-white shadow-soft transition-colors hover:bg-[#15783f] sm:mt-0 sm:w-auto"
      >
        {sent ? <CheckCircle2 className="size-5" /> : <MessageCircle className="size-5" />}
        {sent ? "Open again" : "Send on WhatsApp"}
      </a>
    </motion.div>
  );
}
