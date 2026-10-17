import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  href?: string;
  tone?: "default" | "primary" | "warning" | "danger";
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded-[var(--radius-xl)] border bg-surface p-4 shadow-soft transition-shadow sm:p-5",
        href && "hover:shadow-lift",
        tone === "primary" && "border-primary/20 bg-brand-gradient text-white",
        tone === "warning" && "border-warning/25",
        tone === "danger" && "border-danger/25",
        tone === "default" && "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[13px] font-medium", tone === "primary" ? "text-white/80" : "text-muted-foreground")}>{label}</p>
        {Icon && <Icon className={cn("size-4", tone === "primary" ? "text-lime" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "text-subtle-foreground")} aria-hidden />}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums sm:text-[1.75rem]">{value}</p>
      {hint && <p className={cn("mt-1 text-xs", tone === "primary" ? "text-white/70" : "text-subtle-foreground")}>{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

export function TableCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[var(--radius-xl)] border border-border bg-surface shadow-soft", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({ children }: { children: React.ReactNode }) {
  return <table className="w-full min-w-[640px] text-left text-sm">{children}</table>;
}
export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th scope="col" className={cn("whitespace-nowrap border-b border-border bg-surface-muted/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground", className)}>{children}</th>;
}
export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-border px-4 py-3 align-middle", className)}>{children}</td>;
}

export function Pagination({ page, total, pageSize, buildHref }: { page: number; total: number; pageSize: number; buildHref: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <p className="text-muted-foreground">
        Page {page} of {pages} · {total} total
      </p>
      <div className="flex gap-1.5">
        {page > 1 ? (
          <Link href={buildHref(page - 1)} className="flex items-center gap-1 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-1.5 font-medium hover:bg-surface-muted">
            <ChevronLeft className="size-4" /> Prev
          </Link>
        ) : null}
        {page < pages ? (
          <Link href={buildHref(page + 1)} className="flex items-center gap-1 rounded-[var(--radius-md)] border border-border-strong bg-surface px-3 py-1.5 font-medium hover:bg-surface-muted">
            Next <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

/** Builds a query-string href preserving current filters. */
export function hrefWith(base: string, params: Record<string, string | undefined>, changes: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...changes })) if (v !== undefined && v !== "" && v !== null) sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}
