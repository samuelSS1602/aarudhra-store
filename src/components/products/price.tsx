import { cn, discountPercent, formatINR } from "@/lib/utils";

export function Price({
  price,
  originalPrice,
  size = "md",
  className,
  showBadge = true,
}: {
  price: number;
  originalPrice?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  showBadge?: boolean;
}) {
  const pct = discountPercent(price, originalPrice);
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span
        className={cn(
          "font-semibold tabular-nums text-foreground",
          size === "sm" && "text-[15px]",
          size === "md" && "text-base",
          size === "lg" && "font-display text-3xl",
        )}
      >
        {formatINR(price)}
      </span>
      {pct > 0 && (
        <>
          <span className={cn("tabular-nums text-subtle-foreground line-through", size === "lg" ? "text-base" : "text-[13px]")}>
            <span className="sr-only">Original price </span>
            {formatINR(originalPrice)}
          </span>
          {showBadge && <span className={cn("font-semibold text-success", size === "lg" ? "text-base" : "text-[13px]")}>{pct}% off</span>}
        </>
      )}
    </div>
  );
}

export function StockLabel({ stock, lowStockThreshold, className }: { stock: number; lowStockThreshold: number; className?: string }) {
  if (stock <= 0) return <span className={cn("text-[13px] font-medium text-danger", className)}>Out of stock</span>;
  if (stock <= lowStockThreshold) return <span className={cn("text-[13px] font-medium text-warning", className)}>Only {stock} left</span>;
  return <span className={cn("text-[13px] font-medium text-success", className)}>In stock</span>;
}
