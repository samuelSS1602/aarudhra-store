import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type Crumb = { name: string; href?: string };

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("text-sm", className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${c.name}-${i}`} className="flex items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-foreground">{c.name}</Link>
              ) : (
                <span aria-current={last ? "page" : undefined} className={cn(last && "font-medium text-foreground", "line-clamp-1")}>{c.name}</span>
              )}
              {!last && <ChevronRight className="size-3.5 text-subtle-foreground" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
