import "server-only";
import { Readable } from "node:stream";
import mongoose, { Types } from "mongoose";
import sharp, { type OutputInfo } from "sharp";
import { connectDB } from "@/lib/mongodb";
import { AppError } from "@/lib/errors";

/**
 * Product photos stored in MongoDB GridFS (bucket "media"), separate from product
 * documents. Every upload is normalised before storage:
 *   - EXIF orientation applied, metadata (GPS etc.) stripped
 *   - resized to fit within 1600×1600 (never enlarged)
 *   - encoded as WebP (~100–200 KB for a typical product photo)
 * Files are immutable; their URL is /media/<id>.webp and can be cached forever.
 */

const BUCKET = "media";
const MAX_EDGE = 1600;

function bucket() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Database not connected");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET });
}

export type StoredImage = { url: string; publicId: string; width: number; height: number; bytes: number };

export async function storeImage(input: Uint8Array, opts: { folder: string; uploadedBy: string }): Promise<StoredImage> {
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(input, { failOn: "error", limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new AppError(415, "UNSUPPORTED_FILE", "This image couldn't be processed. Please upload a valid JPEG, PNG, WebP or AVIF photo.");
  }

  await connectDB();
  const id = new Types.ObjectId();
  await new Promise<void>((resolve, reject) => {
    const upload = bucket().openUploadStreamWithId(id, `${opts.folder}/${id}.webp`, {
      metadata: {
        contentType: "image/webp",
        folder: opts.folder,
        width: out.info.width,
        height: out.info.height,
        uploadedBy: opts.uploadedBy,
      },
    });
    upload.once("finish", () => resolve());
    upload.once("error", reject);
    upload.end(out.data);
  });

  return { url: `/media/${id}.webp`, publicId: `mongo:${id}`, width: out.info.width, height: out.info.height, bytes: out.data.length };
}

/** Looks up a stored image; returns null for unknown ids. */
export async function findImage(id: string) {
  if (!Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const [file] = await bucket().find({ _id: new Types.ObjectId(id) }).limit(1).toArray();
  return file ?? null;
}

export function openImageStream(id: string): ReadableStream<Uint8Array> {
  const node = bucket().openDownloadStream(new Types.ObjectId(id));
  return Readable.toWeb(node) as unknown as ReadableStream<Uint8Array>;
}

export async function deleteImage(id: string) {
  if (!Types.ObjectId.isValid(id)) return;
  await connectDB();
  await bucket()
    .delete(new Types.ObjectId(id))
    .catch(() => undefined);
}
