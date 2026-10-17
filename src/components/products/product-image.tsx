import Image from "next/image";
import { Package } from "lucide-react";
import { cn, initials } from "@/lib/utils";
import type { ImageDTO } from "@/types";

const TONES = [
  ["#e9ecfb", "#2b3590"],
  ["#e0f6fb", "#065a76"],
  ["#eef3dc", "#4f6411"],
  ["#ebe7f4", "#4b3f80"],
  ["#e6f0f6", "#1f5f86"],
  ["#f6e7e1", "#8a3a1f"],
] as const;

function toneFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length]!;
}

/**
 * Product imagery via next/image (optimized, responsive, lazy by default).
 * Products without an uploaded photo get a tasteful generated placeholder rather
 * than a fake stock photo.
 */
export function ProductImage({
  image,
  name,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
  priority = false,
  className,
}: {
  image: ImageDTO | null | undefined;
  name: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (image?.url) {
    return (
      <div className={cn("relative overflow-hidden bg-surface-muted", className)}>
        <Image src={image.url} alt={image.alt || name} fill sizes={sizes} priority={priority} className="object-cover" />
      </div>
    );
  }
  const [bg, fg] = toneFor(name);
  return (
    <div
      className={cn("@container relative flex items-center justify-center overflow-hidden", className)}
      style={{ background: `radial-gradient(120% 90% at 20% 10%, #ffffff99 0%, transparent 55%), ${bg}` }}
      role="img"
      aria-label={`${name} (no photo yet)`}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.08]"
        style={{ backgroundImage: `radial-gradient(${fg} 1.3px, transparent 1.4px)`, backgroundSize: "14px 14px" }}
      />
      <div className="relative flex flex-col items-center gap-1.5" style={{ color: fg }}>
        <Package className="hidden size-[18%] min-h-6 min-w-6 opacity-70 @[96px]:block" strokeWidth={1.5} aria-hidden />
        <span className="font-display text-xs font-semibold tracking-tight opacity-80 @[64px]:text-sm @[96px]:text-lg">{initials(name)}</span>
      </div>
    </div>
  );
}
