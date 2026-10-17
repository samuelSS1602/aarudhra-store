"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuantitySelector({
  value,
  onChange,
  max = 99,
  min = 1,
  size = "md",
  label = "Quantity",
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
  min?: number;
  size?: "sm" | "md";
  label?: string;
  disabled?: boolean;
}) {
  const btn = cn(
    "flex items-center justify-center text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40",
    size === "sm" ? "size-8" : "size-11",
  );
  return (
    <div className={cn("inline-flex items-center rounded-[var(--radius-md)] border border-border-strong bg-surface", disabled && "opacity-60")} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={disabled || value <= min} aria-label="Decrease quantity">
        <Minus className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className={cn("w-10 border-x border-border bg-transparent text-center font-semibold tabular-nums focus-visible:outline-none", size === "sm" ? "h-8 text-base sm:text-sm" : "h-11 text-base")}
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={disabled || value >= max} aria-label="Increase quantity">
        <Plus className="size-4" />
      </button>
    </div>
  );
}
