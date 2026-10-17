"use client";

import * as React from "react";
import { apiFetch } from "@/lib/client-api";
import { useSession } from "./session-provider";

/**
 * Cart state. The cart only stores product references and quantities — never
 * prices. Prices and totals always come from the server quote endpoint.
 *  - Guests: persisted in localStorage.
 *  - Signed-in customers: persisted server-side; on sign-in the guest cart is merged.
 */

export type CartItem = { productId: string; variantId: string | null; quantity: number };

type CartContextValue = {
  items: CartItem[];
  couponCode: string | null;
  count: number;
  ready: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  add: (item: CartItem, opts?: { openDrawer?: boolean }) => void;
  setQuantity: (productId: string, variantId: string | null, quantity: number) => void;
  remove: (productId: string, variantId: string | null) => void;
  replaceItems: (items: CartItem[]) => void;
  setCouponCode: (code: string | null) => void;
  clear: () => void;
};

const STORAGE_KEY = "aas_cart_v1";
const CartContext = React.createContext<CartContextValue | null>(null);
const same = (a: CartItem, productId: string, variantId: string | null) => a.productId === productId && (a.variantId ?? null) === (variantId ?? null);

function readLocal(): { items: CartItem[]; couponCode: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: [], couponCode: null };
    const parsed = JSON.parse(raw) as { items?: CartItem[]; couponCode?: string | null };
    const items = Array.isArray(parsed.items)
      ? parsed.items
          .filter((i) => typeof i?.productId === "string" && /^[a-f0-9]{24}$/i.test(i.productId) && Number.isInteger(i.quantity))
          .map((i) => ({ productId: i.productId, variantId: i.variantId ?? null, quantity: Math.min(99, Math.max(1, i.quantity)) }))
      : [];
    return { items: items.slice(0, 100), couponCode: parsed.couponCode ?? null };
  } catch {
    return { items: [], couponCode: null };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useSession();
  const [items, setItems] = React.useState<CartItem[]>([]);
  const [couponCode, setCouponCodeState] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const syncedUser = React.useRef<string | null | undefined>(undefined);
  const skipNextSave = React.useRef(true);

  // Load the right cart whenever the signed-in user changes.
  React.useEffect(() => {
    if (status !== "ready") return; // wait until we know who is signed in
    const uid = user?.id ?? null;
    if (syncedUser.current === uid) return;
    syncedUser.current = uid;
    let cancelled = false;
    (async () => {
      const local = readLocal();
      if (!uid) {
        skipNextSave.current = true;
        setItems(local.items);
        setCouponCodeState(local.couponCode);
        setReady(true);
        return;
      }
      try {
        const server = local.items.length
          ? await apiFetch<{ items: CartItem[]; couponCode: string | null }>("/api/cart/merge", { body: { items: local.items } })
          : await apiFetch<{ items: CartItem[]; couponCode: string | null }>("/api/cart");
        if (local.items.length) localStorage.removeItem(STORAGE_KEY);
        if (cancelled) return;
        skipNextSave.current = true;
        setItems(server.items);
        setCouponCodeState(server.couponCode ?? local.couponCode);
      } catch {
        if (!cancelled) setItems(local.items);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, status]);

  // Persist changes (debounced for the server).
  React.useEffect(() => {
    if (!ready) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, couponCode }));
      } catch {
        /* storage may be unavailable (private mode) */
      }
      return;
    }
    const t = setTimeout(() => {
      void apiFetch("/api/cart", { method: "PUT", body: { items, couponCode } }).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [items, couponCode, ready, user]);

  const add = React.useCallback((item: CartItem, opts?: { openDrawer?: boolean }) => {
    setItems((prev) => {
      const existing = prev.find((p) => same(p, item.productId, item.variantId));
      if (existing) {
        return prev.map((p) => (p === existing ? { ...p, quantity: Math.min(99, p.quantity + item.quantity) } : p));
      }
      return [...prev, { ...item, variantId: item.variantId ?? null }].slice(0, 100);
    });
    if (opts?.openDrawer) setDrawerOpen(true);
  }, []);

  const setQuantity = React.useCallback((productId: string, variantId: string | null, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((p) => !same(p, productId, variantId))
        : prev.map((p) => (same(p, productId, variantId) ? { ...p, quantity: Math.min(99, quantity) } : p)),
    );
  }, []);

  const remove = React.useCallback((productId: string, variantId: string | null) => {
    setItems((prev) => prev.filter((p) => !same(p, productId, variantId)));
  }, []);

  const value = React.useMemo<CartContextValue>(
    () => ({
      items,
      couponCode,
      count: items.reduce((s, i) => s + i.quantity, 0),
      ready,
      drawerOpen,
      setDrawerOpen,
      add,
      setQuantity,
      remove,
      replaceItems: setItems,
      setCouponCode: setCouponCodeState,
      clear: () => {
        setItems([]);
        setCouponCodeState(null);
      },
    }),
    [items, couponCode, ready, drawerOpen, add, setQuantity, remove],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
