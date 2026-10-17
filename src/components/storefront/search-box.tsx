"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { cn, formatINR } from "@/lib/utils";

type Suggestion = { id: string; name: string; slug: string; price: number; brand: string; image: string | null };

export function SearchBox({ className, autoFocus, onNavigate }: { className?: string; autoFocus?: boolean; onNavigate?: () => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [items, setItems] = React.useState<Suggestion[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(-1);
  const listId = React.useId();
  const wrapRef = React.useRef<HTMLDivElement>(null);

  // Debounced suggestions from the real catalogue.
  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggest?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items?: Suggestion[] };
        setItems(data.items ?? []);
        setActive(-1);
      } catch {
        /* aborted or offline */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function go(path: string) {
    setOpen(false);
    onNavigate?.();
    router.push(path);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(`/products/${items[active]!.slug}`);
    const term = q.trim();
    go(term ? `/products?q=${encodeURIComponent(term)}` : "/products");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Escape") setOpen(false);
  }

  const showPanel = open && q.trim().length >= 2;

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <form role="search" onSubmit={onSubmit} className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-subtle-foreground" aria-hidden />
        <input
          id={`${listId}-input`}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search notebooks, pens, kitchen essentials…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          maxLength={60}
          className="h-11 w-full rounded-full border border-border-strong bg-surface pl-10 pr-10 text-base shadow-[inset_0_1px_0_rgb(0_0_0/0.02)] transition-colors placeholder:text-subtle-foreground focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary/20 [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="absolute right-3.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-subtle-foreground" aria-hidden />
        ) : q ? (
          <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-subtle-foreground hover:bg-surface-muted" aria-label="Clear search">
            <X className="size-4" />
          </button>
        ) : null}
      </form>

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-lift"
          >
            <ul id={listId} role="listbox" aria-label="Product suggestions" className="max-h-80 overflow-y-auto p-1.5">
              {items.length === 0 && !loading && <li className="px-3 py-4 text-center text-sm text-muted-foreground">No matching products</li>}
              {items.map((s, i) => (
                <li
                  key={s.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={active === i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    go(`/products/${s.slug}`);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2", active === i && "bg-surface-muted")}
                >
                  <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-surface-muted">
                    {s.image && <Image src={s.image} alt="" fill sizes="40px" className="object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {s.brand && <p className="truncate text-xs text-muted-foreground">{s.brand}</p>}
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatINR(s.price)}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                go(`/products?q=${encodeURIComponent(q.trim())}`);
              }}
              className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-left text-sm font-medium text-primary hover:bg-surface-muted"
            >
              <Search className="size-4" /> See all results for “{q.trim()}”
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
