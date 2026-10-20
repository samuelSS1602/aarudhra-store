import type { CSSProperties } from "react";
import Image from "next/image";
import type { StoreBrand } from "@/lib/settings-defaults";

/**
 * "Brands we stock": an endless strip of brand tiles on a dark band (CSS only).
 * Brands with an uploaded logo show the logo; the rest show their name as a wordmark.
 */
export function BrandMarquee({ title, brands }: { title: string; brands: StoreBrand[] }) {
  if (!brands.length) return null;
  // Repeat short lists so one copy is always wider than the screen; the track then
  // holds two copies and slides by half its width for a seamless loop.
  const copy = Array.from({ length: Math.ceil(12 / brands.length) }, () => brands).flat();
  const track = [...copy, ...copy];

  return (
    <section aria-labelledby="brands-heading" className="relative mt-16 overflow-hidden bg-[#0b1240] py-12 sm:mt-20 sm:py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_90%_at_50%_0%,rgba(34,211,238,0.14),transparent_70%)]" />
      <div className="container-page relative text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lime sm:text-xs">Top brands</p>
        <h2 id="brands-heading" className="mt-2 font-display text-2xl font-semibold text-white sm:text-3xl">
          {title || "Brands we stock"}
        </h2>
      </div>
      <div className="marquee relative mt-8 overflow-hidden py-2 sm:mt-10">
        <ul className="marquee-track" style={{ "--marquee-duration": `${Math.max(30, copy.length * 3.5)}s` } as CSSProperties}>
          {track.map((b, i) => (
            // Only the first set is announced to screen readers; the repeats are decorative.
            <li key={`${b.name}-${i}`} aria-hidden={i >= brands.length || undefined} className="shrink-0 pr-4 sm:pr-6">
              <div className="flex h-16 w-36 items-center justify-center rounded-2xl bg-white px-4 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] ring-1 ring-white/10 transition-transform duration-300 hover:-translate-y-1 sm:h-20 sm:w-44">
                {b.logoUrl ? (
                  <Image src={b.logoUrl} alt={i < brands.length ? b.name : ""} width={160} height={64} sizes="176px" className="max-h-11 w-auto object-contain sm:max-h-14" />
                ) : (
                  <span className="text-brand-gradient truncate font-display text-xl font-bold tracking-tight sm:text-2xl">{b.name}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
