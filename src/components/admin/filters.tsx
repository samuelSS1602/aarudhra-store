"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { RANGE_PRESETS } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function useParamUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return React.useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      next.delete("page");
      router.push(`${pathname}?${next.toString()}`);
    },
    [params, pathname, router],
  );
}

export function RangeFilter({ preset, from, to }: { preset: string; from: string; to: string }) {
  const update = useParamUpdater();
  const [f, setF] = React.useState(from);
  const [t, setT] = React.useState(to);
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
      <div className="scrollbar-none flex w-full overflow-x-auto rounded-[var(--radius-md)] border border-border bg-surface p-1 sm:w-auto" role="group" aria-label="Date range">
        {RANGE_PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={preset === p.id}
            onClick={() => update({ range: p.id, from: null, to: null })}
            className={cn("flex-1 whitespace-nowrap rounded-[calc(var(--radius-md)-3px)] px-2.5 py-1.5 text-[13px] font-medium sm:flex-none sm:px-3 sm:text-sm", preset === p.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-surface-muted")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <form
        className="flex w-full items-center gap-1.5 sm:w-auto"
        onSubmit={(e) => {
          e.preventDefault();
          update({ range: "custom", from: f, to: t });
        }}
      >
        <label className="sr-only" htmlFor="range-from">From</label>
        <Input id="range-from" type="date" value={f} onChange={(e) => setF(e.target.value)} className="h-10 min-w-0 flex-1 px-2.5 sm:h-9 sm:w-[9.5rem] sm:flex-none sm:text-sm" />
        <span className="text-subtle-foreground">–</span>
        <label className="sr-only" htmlFor="range-to">To</label>
        <Input id="range-to" type="date" value={t} onChange={(e) => setT(e.target.value)} className="h-10 min-w-0 flex-1 px-2.5 sm:h-9 sm:w-[9.5rem] sm:flex-none sm:text-sm" />
        <Button type="submit" size="sm" className="h-10 sm:h-9" variant={preset === "custom" ? "primary" : "outline"}>Apply</Button>
      </form>
    </div>
  );
}

export function SearchFilter({ placeholder, paramName = "q" }: { placeholder: string; paramName?: string }) {
  const params = useSearchParams();
  const update = useParamUpdater();
  const [value, setValue] = React.useState(params.get(paramName) ?? "");
  // Debounced: filters as you type without hammering the server.
  React.useEffect(() => {
    const current = params.get(paramName) ?? "";
    if (value === current) return;
    const t = setTimeout(() => update({ [paramName]: value.trim() || null }), 350);
    return () => clearTimeout(t);
  }, [value, params, paramName, update]);
  return (
    <div className="relative w-full min-w-0 sm:w-auto sm:min-w-56 sm:max-w-sm sm:flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-10 pl-9" maxLength={100} />
    </div>
  );
}

export function SelectFilter({ param, label, options }: { param: string; label: string; options: { value: string; label: string }[] }) {
  const params = useSearchParams();
  const update = useParamUpdater();
  return (
    <NativeSelect aria-label={label} value={params.get(param) ?? ""} onChange={(e) => update({ [param]: e.target.value || null })} className="h-10 min-w-0 flex-1 basis-[calc(50%-0.25rem)] sm:w-auto sm:min-w-36 sm:flex-none sm:basis-auto sm:text-sm">
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </NativeSelect>
  );
}

/** Refreshes server-rendered data periodically (live order lists), paused while the tab is hidden. */
export function AutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
