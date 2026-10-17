"use client";

import * as React from "react";
import { Check, Tag, X } from "lucide-react";
import type { QuoteDTO } from "@/types";
import { formatINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CouponInput({
  code,
  quote,
  onApply,
  loading,
}: {
  code: string | null;
  quote: QuoteDTO | null;
  onApply: (code: string | null) => void;
  loading?: boolean;
}) {
  const [value, setValue] = React.useState(code ?? "");
  React.useEffect(() => setValue(code ?? ""), [code]);

  if (code && quote?.coupon) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-success/30 bg-success-soft px-3 py-2.5 text-sm">
        <span className="flex items-center gap-2 font-medium text-success">
          <Check className="size-4" /> {quote.coupon.code} applied · you save {formatINR(quote.coupon.discountAmount)}
        </span>
        <button type="button" onClick={() => onApply(null)} className="rounded-full p-1 text-muted-foreground hover:bg-white/70" aria-label="Remove coupon">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(value.trim() ? value.trim().toUpperCase() : null);
      }}
    >
      <label htmlFor="coupon" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
        <Tag className="size-4 text-primary" /> Coupon code
      </label>
      <div className="flex gap-2">
        <Input
          id="coupon"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="Enter code"
          maxLength={32}
          aria-invalid={Boolean(code && quote?.couponError)}
          aria-describedby={code && quote?.couponError ? "coupon-error" : undefined}
          className="uppercase"
        />
        <Button type="submit" variant="outline" loading={loading && Boolean(value)}>Apply</Button>
      </div>
      {code && quote?.couponError && (
        <p id="coupon-error" role="alert" className="mt-1.5 text-sm text-danger">{quote.couponError}</p>
      )}
    </form>
  );
}
