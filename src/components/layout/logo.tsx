import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/*
 * Brand artwork extracted from the official logo (YUCHIII LOGO-4.pdf):
 *   /brand/logo-mark.png      emblem (239×256)
 *   /brand/logo-wordmark.png  "AARUDHRA · SMART STORE" (900×182)
 *   /brand/logo-full.png      stacked logo (1000×544)
 */

/** The circular "A" emblem. `tile` puts it on a white rounded square for dark backgrounds. */
export function LogoMark({ className, tile = false, priority = false }: { className?: string; tile?: boolean; priority?: boolean }) {
  const img = <Image src="/brand/logo-mark.png" alt="" width={239} height={256} priority={priority} className={cn(!tile && "h-9 w-auto", tile && "h-[78%] w-auto")} />;
  if (!tile) return <span className={cn("inline-flex shrink-0", className)}>{img}</span>;
  return <span className={cn("inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-soft", className)}>{img}</span>;
}

/** Horizontal lockup used in the header and footer. */
export function Logo({ name = "Aarudhra Smart Store", href = "/", className }: { name?: string; href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("group flex shrink-0 items-center gap-2", className)} aria-label={`${name} — home`}>
      <Image src="/brand/logo-mark.png" alt="" width={239} height={256} priority className="h-9 w-auto sm:h-10" />
      <Image src="/brand/logo-wordmark.png" alt={name} width={900} height={182} priority className="h-[26px] w-auto sm:h-[30px]" />
    </Link>
  );
}

/** Full stacked logo for sign-in screens and printed invoices. */
export function LogoFull({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Image src="/brand/logo-full.png" alt="Aarudhra Smart Store" width={1000} height={544} priority={priority} className={cn("h-auto w-56", className)} />
  );
}
