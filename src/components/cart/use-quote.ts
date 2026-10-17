"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client-api";
import type { QuoteDTO } from "@/types";
import type { CartItem } from "@/components/providers/cart-provider";

/** Fetches a server-computed quote for the cart, debounced and abortable. */
export function useQuote(items: CartItem[], couponCode: string | null, deliveryOptionId: string | null, enabled = true) {
  const [quote, setQuote] = React.useState<QuoteDTO | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [nonce, setNonce] = React.useState(0);
  const key = JSON.stringify([items, couponCode, deliveryOptionId]);

  React.useEffect(() => {
    if (!enabled) return;
    if (!items.length) {
      setQuote(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const q = await apiFetch<QuoteDTO>("/api/cart/quote", {
          body: { items, couponCode, deliveryOptionId },
          signal: ctrl.signal,
        });
        setQuote(q);
        setError(null);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setError(err instanceof Error ? err.message : "Couldn't load prices");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, nonce]);

  return { quote, loading, error, reload: () => setNonce((n) => n + 1) };
}
