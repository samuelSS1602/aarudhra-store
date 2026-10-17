"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { uploadWithProgress } from "@/lib/client-api";
import type { ImageDTO } from "@/types";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

type Uploading = { id: string; name: string; progress: number };

export function ImageUploader({
  value,
  onChange,
  max = 10,
  folder = "products",
}: {
  value: ImageDTO[];
  onChange: (images: ImageDTO[]) => void;
  max?: number;
  folder?: "products" | "categories" | "banners" | "branding";
}) {
  const [uploading, setUploading] = React.useState<Uploading[]>([]);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const latest = React.useRef(value);
  latest.current = value;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = max - latest.current.length - uploading.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    for (const file of list) {
      // Client-side checks for fast feedback; the server re-validates by magic bytes.
      if (!TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP or AVIF images are allowed`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name}: images must be 4 MB or smaller`);
        continue;
      }
      const id = crypto.randomUUID();
      setUploading((u) => [...u, { id, name: file.name, progress: 0 }]);
      const form = new FormData();
      form.append("file", file);
      form.append("folder", folder);
      try {
        const res = await uploadWithProgress<{ image: ImageDTO }>("/api/admin/uploads", form, (p) =>
          setUploading((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))),
        );
        onChange([...latest.current, { ...res.image, alt: "" }]);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading((u) => u.filter((x) => x.id !== id));
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...value];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {value.map((img, i) => (
          <div key={img.url} className="group overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface">
            <div className="relative aspect-square bg-surface-muted">
              <Image src={img.url} alt={img.alt || ""} fill sizes="200px" className="object-cover" />
              {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">Main</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-white/90 p-1 disabled:opacity-40" aria-label="Move image left"><ArrowLeft className="size-3.5" /></button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} className="rounded bg-white/90 p-1 disabled:opacity-40" aria-label="Move image right"><ArrowRight className="size-3.5" /></button>
                </div>
                <button type="button" onClick={() => onChange(value.filter((_, k) => k !== i))} className="rounded bg-white/90 p-1 text-danger" aria-label="Remove image"><Trash2 className="size-3.5" /></button>
              </div>
            </div>
            <input
              value={img.alt ?? ""}
              onChange={(e) => onChange(value.map((x, k) => (k === i ? { ...x, alt: e.target.value.slice(0, 200) } : x)))}
              placeholder="Alt text (describe the image)"
              aria-label={`Alt text for image ${i + 1}`}
              className="w-full border-t border-border px-2.5 py-2 text-base sm:text-xs focus-visible:outline-none"
            />
          </div>
        ))}
        {uploading.map((u) => (
          <div key={u.id} className="flex aspect-square flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-border-strong bg-surface-muted p-3 text-center">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="w-full truncate text-xs text-muted-foreground">{u.name}</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" role="progressbar" aria-valuenow={u.progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Uploading ${u.name}`}>
              <div className="h-full bg-primary transition-[width]" style={{ width: `${u.progress}%` }} />
            </div>
          </div>
        ))}
        {value.length + uploading.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void handleFiles(e.dataTransfer.files);
            }}
            className={cn("flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border-2 border-dashed border-border-strong text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary")}
          >
            <ImagePlus className="size-6" />
            <span className="text-xs font-semibold">Add image</span>
            <span className="text-[10px]">JPEG/PNG/WebP · max 4 MB</span>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={TYPES.join(",")} multiple={max > 1} className="sr-only" onChange={(e) => void handleFiles(e.target.files)} tabIndex={-1} aria-hidden />
    </div>
  );
}
