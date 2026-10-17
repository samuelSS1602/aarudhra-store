import "server-only";
import { createHash } from "node:crypto";
import { getEnv, isCloudinaryConfigured } from "@/lib/env";
import { AppError, serviceUnavailable } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

/** Detects the real image type from magic bytes — the browser-supplied MIME type is not trusted. */
export function sniffImageType(buf: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const ascii = (s: number, e: number) => String.fromCharCode(...buf.slice(s, e));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return "image/avif";
  return null;
}

export function validateImageFile(file: { size: number }, bytes: Uint8Array) {
  if (file.size === 0) throw new AppError(400, "INVALID_FILE", "The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new AppError(413, "FILE_TOO_LARGE", "Images must be 4 MB or smaller.");
  const type = sniffImageType(bytes);
  if (!type) throw new AppError(415, "UNSUPPORTED_FILE", "Only JPEG, PNG, WebP or AVIF images are allowed.");
  return type;
}

function sign(params: Record<string, string>, secret: string) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(toSign + secret).digest("hex");
}

export type UploadedImage = { url: string; publicId: string; width: number; height: number; bytes: number; format: string };

export async function uploadImage(bytes: Uint8Array, type: string, subfolder: string): Promise<UploadedImage> {
  if (!isCloudinaryConfigured()) throw serviceUnavailable("Image storage is not configured. Set the CLOUDINARY_* environment variables.");
  const env = getEnv();
  const params = { folder: `${env.CLOUDINARY_FOLDER}/${subfolder}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type }));
  form.append("api_key", env.CLOUDINARY_API_KEY!);
  form.append("timestamp", params.timestamp);
  form.append("folder", params.folder);
  form.append("signature", sign(params, env.CLOUDINARY_API_SECRET!));

  const res = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (body.error as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new AppError(502, "UPLOAD_FAILED", `Image upload failed: ${msg}`);
  }
  return {
    url: String(body.secure_url),
    publicId: String(body.public_id),
    width: Number(body.width),
    height: Number(body.height),
    bytes: Number(body.bytes),
    format: String(body.format),
  };
}
