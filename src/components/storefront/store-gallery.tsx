import type { CSSProperties } from "react";
import Image from "next/image";
import { GALLERY_PHOTOS, type StorePhoto } from "./store-photos";

function Row({ photos, reverse, duration }: { photos: StorePhoto[]; reverse?: boolean; duration: string }) {
  return (
    <div className="marquee overflow-hidden py-2">
      <ul className="marquee-track" data-reverse={reverse ? "" : undefined} style={{ "--marquee-duration": duration } as CSSProperties}>
        {/* The list is rendered twice so the loop is seamless; the copy is hidden from screen readers. */}
        {[...photos, ...photos].map((p, i) => (
          <li key={`${p.id}-${i}`} aria-hidden={i >= photos.length || undefined} className="shrink-0 pr-3 sm:pr-4">
            <figure className="group relative h-40 w-56 overflow-hidden rounded-2xl bg-surface-muted shadow-soft ring-1 ring-black/5 sm:h-52 sm:w-72">
              <Image
                src={p.thumb.src}
                width={p.thumb.width}
                height={p.thumb.height}
                alt={i >= photos.length ? "" : p.caption}
                sizes="(min-width: 640px) 288px, 224px"
                loading="lazy"
                className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 to-transparent px-3.5 pb-2.5 pt-8 text-xs font-medium text-white">
                {p.caption}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Inside our store": two strips of real store photos drifting in opposite directions (CSS only). */
export function StoreGallery() {
  if (!GALLERY_PHOTOS.length) return null;
  const half = Math.ceil(GALLERY_PHOTOS.length / 2);
  const top = GALLERY_PHOTOS;
  const bottom = [...GALLERY_PHOTOS.slice(half), ...GALLERY_PHOTOS.slice(0, half)];
  return (
    <div className="space-y-1 sm:space-y-2">
      <Row photos={top} duration="70s" />
      <Row photos={bottom} reverse duration="85s" />
    </div>
  );
}
