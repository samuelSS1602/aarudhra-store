"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, List, SearchX, SlidersHorizontal, X } from "lucide-react";
import { cn, formatINR, toRupees } from "@/lib/utils";
import type { ProductCardDTO } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Label, Switch } from "@/components/ui/primitives";
import { EmptyState } from "@/components/ui/display";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { ProductCard } from "./product-card";

type Result = {
  items: ProductCardDTO[];
  total: number;
  page: number;
  totalPages: number;
  facets: { brands: string[]; priceRange: { min: number; max: number } | null };
};

const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "popular", label: "Popularity" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "discount", label: "Biggest discount" },
];

export function ProductListing({
  result,
  categories,
  activeCategory,
}: {
  result: Result;
  categories: { name: string; slug: string; productCount?: number }[];
  activeCategory?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const view = params.get("view") === "list" ? "list" : "grid";
  const q = params.get("q") ?? "";

  const update = React.useCallback(
    (changes: Record<string, string | null>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (resetPage) next.delete("page");
      startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
    },
    [params, pathname, router],
  );

  const brands = (params.get("brand") ?? "").split(",").filter(Boolean);
  const activeFilterCount =
    (params.get("minPrice") ? 1 : 0) + (params.get("maxPrice") ? 1 : 0) + (params.get("availability") ? 1 : 0) + (params.get("onSale") ? 1 : 0) + brands.length;

  const clearAll = () => update({ minPrice: null, maxPrice: null, availability: null, onSale: null, brand: null, q: null });

  const filters = (
    <FilterPanel
      categories={categories}
      activeCategory={activeCategory}
      facets={result.facets}
      params={params}
      brands={brands}
      onChange={update}
      onClear={clearAll}
      activeCount={activeFilterCount}
    />
  );

  const pageHref = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    return `${pathname}?${next.toString()}`;
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-36">{filters}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <p className="w-full text-sm text-muted-foreground sm:mr-auto sm:w-auto" aria-live="polite">
            {q && (
              <>
                Results for <span className="font-semibold text-foreground">“{q}”</span> ·{" "}
              </>
            )}
            {result.total} product{result.total === 1 ? "" : "s"}
          </p>
          <Button variant="outline" size="sm" className="h-10 lg:hidden" onClick={() => setFiltersOpen(true)}>
            <SlidersHorizontal /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </Button>
          <label htmlFor="sort" className="sr-only">Sort products</label>
          <NativeSelect id="sort" className="h-10 min-w-0 flex-1 py-0 sm:h-9 sm:w-auto sm:flex-none sm:text-sm" value={params.get("sort") ?? (q ? "relevance" : "newest")} onChange={(e) => update({ sort: e.target.value })}>
            {q && <option value="relevance">Best match</option>}
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </NativeSelect>
          <div className="flex rounded-[var(--radius-md)] border border-border-strong bg-surface p-0.5" role="group" aria-label="Layout">
            <button type="button" aria-pressed={view === "grid"} aria-label="Grid view" onClick={() => update({ view: null }, false)} className={cn("rounded-md p-1.5", view === "grid" ? "bg-surface-muted text-foreground" : "text-subtle-foreground")}>
              <LayoutGrid className="size-4" />
            </button>
            <button type="button" aria-pressed={view === "list"} aria-label="List view" onClick={() => update({ view: "list" }, false)} className={cn("rounded-md p-1.5", view === "list" ? "bg-surface-muted text-foreground" : "text-subtle-foreground")}>
              <List className="size-4" />
            </button>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {params.get("minPrice") && <Chip label={`From ₹${params.get("minPrice")}`} onRemove={() => update({ minPrice: null })} />}
            {params.get("maxPrice") && <Chip label={`Up to ₹${params.get("maxPrice")}`} onRemove={() => update({ maxPrice: null })} />}
            {params.get("availability") && <Chip label="In stock only" onRemove={() => update({ availability: null })} />}
            {params.get("onSale") && <Chip label="On offer" onRemove={() => update({ onSale: null })} />}
            {brands.map((b) => (
              <Chip key={b} label={b} onRemove={() => update({ brand: brands.filter((x) => x !== b).join(",") || null })} />
            ))}
            <button type="button" onClick={clearAll} className="text-sm font-semibold text-primary hover:underline">Clear all</button>
          </div>
        )}

        <div className={cn("transition-opacity", pending && "pointer-events-none opacity-60")} aria-busy={pending}>
          {result.items.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title={q ? "No products match your search" : "No products found"}
              description="Try a different search term, remove a filter, or browse all categories."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {activeFilterCount > 0 || q ? <Button variant="outline" onClick={clearAll}>Clear filters</Button> : null}
                  <Button asChild><Link href="/categories">Browse categories</Link></Button>
                </div>
              }
              className="rounded-[var(--radius-xl)] border border-dashed border-border-strong bg-surface"
            />
          ) : view === "list" ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {result.items.map((p) => <ProductCard key={p.id} product={p} layout="list" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
              {result.items.map((p, i) => <ProductCard key={p.id} product={p} priority={i < 4} />)}
            </div>
          )}
        </div>

        {result.totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-1.5" aria-label="Pagination">
            <PageLink href={pageHref(result.page - 1)} disabled={result.page <= 1} label="Previous page"><ChevronLeft className="size-4" /></PageLink>
            {pageWindow(result.page, result.totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`e${i}`} className="px-2 text-subtle-foreground">…</span>
              ) : (
                <PageLink key={p} href={pageHref(p)} active={p === result.page} label={`Page ${p}`}>{p}</PageLink>
              ),
            )}
            <PageLink href={pageHref(result.page + 1)} disabled={result.page >= result.totalPages} label="Next page"><ChevronRight className="size-4" /></PageLink>
          </nav>
        )}
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="bottom" title="Filters">
          <div className="overflow-y-auto px-5 py-4">{filters}</div>
          <div className="pb-safe border-t border-border p-4">
            <Button className="w-full" onClick={() => setFiltersOpen(false)}>Show {result.total} products</Button>
          </div>
        </SheetContent>
      </Dialog>
    </div>
  );
}

function pageWindow(page: number, total: number): (number | "…")[] {
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

function PageLink({ href, children, active, disabled, label }: { href: string; children: React.ReactNode; active?: boolean; disabled?: boolean; label: string }) {
  if (disabled) return <span className="flex size-10 items-center justify-center rounded-full text-subtle-foreground opacity-50" aria-hidden>{children}</span>;
  return (
    <Link href={href} aria-label={label} aria-current={active ? "page" : undefined} className={cn("flex size-10 items-center justify-center rounded-full text-sm font-semibold transition-colors", active ? "bg-primary text-white" : "hover:bg-surface-muted")}>
      {children}
    </Link>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft py-1 pl-3 pr-1.5 text-sm font-medium text-primary-soft-foreground">
      {label}
      <button type="button" onClick={onRemove} className="rounded-full p-0.5 hover:bg-white/60" aria-label={`Remove filter ${label}`}>
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function FilterPanel({
  categories,
  activeCategory,
  facets,
  params,
  brands,
  onChange,
  onClear,
  activeCount,
}: {
  categories: { name: string; slug: string; productCount?: number }[];
  activeCategory?: string;
  facets: Result["facets"];
  params: URLSearchParams | ReturnType<typeof useSearchParams>;
  brands: string[];
  onChange: (c: Record<string, string | null>) => void;
  onClear: () => void;
  activeCount: number;
}) {
  const [min, setMin] = React.useState(params.get("minPrice") ?? "");
  const [max, setMax] = React.useState(params.get("maxPrice") ?? "");
  React.useEffect(() => {
    setMin(params.get("minPrice") ?? "");
    setMax(params.get("maxPrice") ?? "");
  }, [params]);
  const qs = params.get("q") ? `?q=${encodeURIComponent(params.get("q")!)}` : "";

  return (
    <div className="space-y-7">
      <div>
        <h3 className="mb-3 text-sm font-semibold">Category</h3>
        <ul className="space-y-0.5 text-sm">
          <li>
            <Link href={`/products${qs}`} className={cn("flex justify-between rounded-md px-2 py-1.5 hover:bg-surface-muted", !activeCategory && "bg-primary-soft font-semibold text-primary-soft-foreground")}>
              All products
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={`/categories/${c.slug}${qs}`} className={cn("flex justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-surface-muted", activeCategory === c.slug && "bg-primary-soft font-semibold text-primary-soft-foreground")}>
                <span>{c.name}</span>
                {typeof c.productCount === "number" && <span className="text-xs text-subtle-foreground">{c.productCount}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onChange({ minPrice: min || null, maxPrice: max || null });
        }}
      >
        <h3 className="mb-1 text-sm font-semibold">Price</h3>
        {facets.priceRange && (
          <p className="mb-3 text-xs text-subtle-foreground">
            {formatINR(facets.priceRange.min)} – {formatINR(facets.priceRange.max)}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Input type="number" inputMode="numeric" min={0} placeholder={facets.priceRange ? String(Math.floor(toRupees(facets.priceRange.min))) : "Min"} value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minimum price in rupees" className="h-10" />
          <span className="text-subtle-foreground">–</span>
          <Input type="number" inputMode="numeric" min={0} placeholder={facets.priceRange ? String(Math.ceil(toRupees(facets.priceRange.max))) : "Max"} value={max} onChange={(e) => setMax(e.target.value)} aria-label="Maximum price in rupees" className="h-10" />
        </div>
        <Button type="submit" variant="secondary" size="sm" className="mt-2 w-full">Apply price</Button>
      </form>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold">Availability</h3>
        <div className="flex items-center justify-between">
          <Label htmlFor="f-stock" className="font-normal">In stock only</Label>
          <Switch id="f-stock" checked={params.get("availability") === "in_stock"} onCheckedChange={(v) => onChange({ availability: v ? "in_stock" : null })} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="f-sale" className="font-normal">On offer</Label>
          <Switch id="f-sale" checked={Boolean(params.get("onSale"))} onCheckedChange={(v) => onChange({ onSale: v ? "1" : null })} />
        </div>
      </div>

      {facets.brands.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Brand</h3>
          <ul className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {facets.brands.map((b) => {
              const id = `brand-${b.replace(/\W+/g, "-")}`;
              const checked = brands.includes(b);
              return (
                <li key={b} className="flex items-center gap-2.5">
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(v) => onChange({ brand: (v ? [...brands, b] : brands.filter((x) => x !== b)).join(",") || null })}
                  />
                  <Label htmlFor={id} className="font-normal">{b}</Label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {activeCount > 0 && (
        <Button variant="outline" className="w-full" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}
