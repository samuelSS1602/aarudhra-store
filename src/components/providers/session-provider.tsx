"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/client-api";

export type SessionUser = { id: string; name: string; phoneNumber: string | null; email?: string | null; contactPhone?: string | null };

type SessionContextValue = {
  user: SessionUser | null;
  /** "loading" until the browser has checked who is signed in (pages are pre-built and shared). */
  status: "loading" | "ready";
  wishlist: Set<string>;
  refresh: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
  toggleWishlist: (productId: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = React.createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready">("loading");
  const [wishlist, setWishlist] = React.useState<Set<string>>(new Set());

  const refresh = React.useCallback(async () => {
    const data = await apiFetch<{ user: SessionUser | null; wishlist: string[] }>("/api/auth/me").catch(() => null);
    if (data) {
      setUser(data.user);
      setWishlist(new Set(data.wishlist));
    }
    setStatus("ready");
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleWishlist = React.useCallback(
    async (productId: string) => {
      if (status === "loading") return;
      if (!user) {
        toast("Sign in to save items to your wishlist", {
          action: { label: "Sign in", onClick: () => router.push(`/login?next=${encodeURIComponent(location.pathname)}`) },
        });
        return;
      }
      const add = !wishlist.has(productId);
      // Optimistic update, rolled back on failure.
      setWishlist((prev) => {
        const next = new Set(prev);
        if (add) next.add(productId);
        else next.delete(productId);
        return next;
      });
      try {
        const res = await apiFetch<{ wishlist: string[] }>("/api/wishlist", { body: { productId, add } });
        setWishlist(new Set(res.wishlist));
        toast.success(add ? "Saved to wishlist" : "Removed from wishlist");
      } catch (err) {
        setWishlist((prev) => {
          const next = new Set(prev);
          if (add) next.delete(productId);
          else next.add(productId);
          return next;
        });
        toast.error(err instanceof Error ? err.message : "Couldn't update wishlist");
      }
    },
    [user, status, wishlist, router],
  );

  const logout = React.useCallback(async () => {
    await apiFetch("/api/auth/logout", { method: "POST", body: {} }).catch(() => undefined);
    setUser(null);
    setWishlist(new Set());
    router.push("/");
    router.refresh();
  }, [router]);

  const value = React.useMemo(
    () => ({ user, status, wishlist, refresh, setUser, toggleWishlist, logout }),
    [user, status, wishlist, refresh, toggleWishlist, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = React.useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
