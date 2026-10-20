"use client";

import * as React from "react";
import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BadgeIndianRupee, MapPin, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { HERO_PHOTOS } from "./store-photos";

type Slide = { id: string; src: StaticImageData | string; caption: string };

const SLIDE_MS = 6000;

/** Slow zoom-and-pan ("Ken Burns") paths, alternated per slide. */
const DRIFT = [
  { from: { scale: 1.08, x: "0%", y: "0%" }, to: { scale: 1.18, x: "-3%", y: "-2%" } },
  { from: { scale: 1.18, x: "2%", y: "-1%" }, to: { scale: 1.08, x: "-1%", y: "1%" } },
  { from: { scale: 1.1, x: "-2%", y: "1%" }, to: { scale: 1.2, x: "2%", y: "-1%" } },
  { from: { scale: 1.16, x: "0%", y: "-2%" }, to: { scale: 1.06, x: "0%", y: "1%" } },
];

export function HeroShowcase({
  eyebrow,
  title,
  subtitle,
  cta,
  secondary,
  location,
  codEnabled,
  adminImage,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  cta?: { label: string; href: string };
  secondary?: { label: string; href: string };
  location: string;
  codEnabled: boolean;
  adminImage?: string | null;
}) {
  const reduced = useReducedMotion();
  const slides = React.useMemo<Slide[]>(
    () => [...(adminImage ? [{ id: "admin-hero", src: adminImage, caption: "Aarudhra Smart Store" }] : []), ...HERO_PHOTOS],
    [adminImage],
  );
  const [index, setIndex] = React.useState(0);
  const [cycle, setCycle] = React.useState(0); // restarts the drift/progress animation on every change
  const [paused, setPaused] = React.useState(false);
  const count = slides.length;
  const playing = !reduced && !paused && count > 1;

  const go = React.useCallback(
    (to: number) => {
      setIndex(((to % count) + count) % count);
      setCycle((c) => c + 1);
    },
    [count],
  );

  React.useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => go(index + 1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [playing, index, cycle, go]);

  // Pause while the tab is hidden.
  React.useEffect(() => {
    const onVis = () => setPaused(document.visibilityState !== "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const slide = slides[index]!;
  const next = slides[(index + 1) % count]!;
  const drift = DRIFT[index % DRIFT.length]!;

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Inside Aarudhra Smart Store"
      className="relative isolate h-[70svh] min-h-[540px] max-h-[820px] overflow-hidden bg-[#0b1240] sm:h-[74vh]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(index + 1);
        if (e.key === "ArrowLeft") go(index - 1);
      }}
    >
      {/* Slides */}
      <motion.div
        className="absolute inset-0 -z-10 touch-pan-y"
        drag={count > 1 ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) go(index + 1);
          else if (info.offset.x > 60) go(index - 1);
        }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={`${slide.id}-${cycle}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-0"
              initial={reduced ? false : drift.from}
              animate={reduced ? undefined : drift.to}
              transition={{ duration: (SLIDE_MS + 1500) / 1000, ease: "linear" }}
            >
              <Image
                src={slide.src}
                alt={slide.caption}
                fill
                priority={index === 0 && cycle === 0}
                placeholder={typeof slide.src === "string" ? "empty" : "blur"}
                sizes="100vw"
                className="object-cover"
                draggable={false}
              />
            </motion.div>
          </motion.div>
        </AnimatePresence>
        {/* Preload the next photo so the crossfade never waits on the network. */}
        {count > 1 && <Image src={next.src} alt="" aria-hidden fill sizes="100vw" className="pointer-events-none object-cover opacity-0" />}
      </motion.div>

      {/* Legibility gradients + vignette */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-t from-[#070d33]/95 via-[#0b1240]/55 to-[#0b1240]/10 lg:bg-gradient-to-r lg:from-[#070d33]/90 lg:via-[#0b1240]/50 lg:to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 shadow-[inset_0_0_160px_rgba(5,10,40,0.55)]" />

      {/* Copy */}
      <div className="container-page relative flex h-full flex-col justify-end pb-24 sm:pb-28 lg:justify-center lg:pb-0">
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl text-white"
        >
          {eyebrow && (
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90 backdrop-blur-md sm:text-xs">
              <span className="size-1.5 rounded-full bg-lime shadow-[0_0_12px_var(--lime)]" /> {eyebrow}
            </p>
          )}
          <h1 className="mt-4 font-display text-[2.35rem] font-semibold leading-[1.04] tracking-tight drop-shadow-[0_2px_24px_rgba(0,0,0,0.35)] sm:mt-5 sm:text-6xl lg:text-7xl">
            {title}
          </h1>
          {subtitle && <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/85 sm:mt-5 sm:text-lg">{subtitle}</p>}
          <div className="mt-7 flex flex-wrap gap-3">
            {cta?.label && (
              <Link
                href={cta.href || "/products"}
                className="group inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-primary shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] transition-transform hover:-translate-y-0.5"
              >
                {cta.label} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            {secondary?.label && (
              <Link
                href={secondary.href || "/categories"}
                className="inline-flex h-12 items-center rounded-full border border-white/35 bg-white/10 px-6 text-[15px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </motion.div>
      </div>

      {/* Floating glass chips (honest facts only) */}
      <div className="pointer-events-none absolute bottom-24 right-6 hidden flex-col items-end gap-3 lg:flex xl:right-[max(1.5rem,calc((100vw-80rem)/2+2rem))]">
        {[
          { icon: MapPin, text: location },
          ...(codEnabled ? [{ icon: BadgeIndianRupee, text: "Cash on Delivery" }] : []),
          { icon: Truck, text: "Delivery across Palani" },
        ].map((chip, i) => (
          <motion.div
            key={chip.text}
            initial={reduced ? false : { opacity: 0, x: 24 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0, y: [0, -8, 0] }}
            transition={
              reduced
                ? undefined
                : { opacity: { delay: 0.4 + i * 0.15 }, x: { delay: 0.4 + i * 0.15, duration: 0.6 }, y: { delay: 1 + i * 0.6, duration: 4.5, repeat: Infinity, ease: "easeInOut" } }
            }
            className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/12 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_40px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-white/15">
              <chip.icon className="size-4" aria-hidden />
            </span>
            {chip.text}
          </motion.div>
        ))}
      </div>

      {/* Caption + progress */}
      {count > 1 && (
        <div className="absolute inset-x-0 bottom-0 z-10">
          <div className="container-page flex flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between sm:pb-8">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={slide.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.35 }}
                className="text-xs font-medium tracking-wide text-white/75 sm:text-sm"
                aria-live="polite"
              >
                <span className="mr-2 text-white/50">Inside our store</span>
                {slide.caption}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center gap-1.5" role="tablist" aria-label="Choose photo">
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`Photo ${i + 1}: ${s.caption}`}
                  onClick={() => go(i)}
                  className="group relative h-6 w-7 sm:w-9"
                >
                  <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/25 transition-colors group-hover:bg-white/40">
                    {i === index ? (
                      <motion.span
                        key={`p-${cycle}`}
                        className="absolute inset-y-0 left-0 rounded-full bg-white"
                        initial={{ width: playing ? "0%" : "100%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: playing ? SLIDE_MS / 1000 : 0, ease: "linear" }}
                      />
                    ) : (
                      <span className={cn("absolute inset-0 rounded-full", i < index ? "bg-white/70" : "bg-transparent")} />
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
