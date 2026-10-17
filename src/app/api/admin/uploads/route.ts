import { json, route } from "@/lib/api";
import { AppError, badRequest } from "@/lib/errors";
import { requireAdmin } from "@/lib/auth/admin-session";
import { MAX_UPLOAD_BYTES, uploadImage, validateImageFile } from "@/lib/cloudinary";
import { imageStorageBackend } from "@/lib/env";
import { storeImage } from "@/lib/media-store";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { audit } from "@/services/audit.service";

export const runtime = "nodejs";
export const maxDuration = 60;

const FOLDERS = new Set(["products", "categories", "banners", "branding"]);

export const POST = route(async (req) => {
  const admin = await requireAdmin(req, "products:write");
  await enforceRateLimit(`upload:${admin.id}`, 60, 10 * 60, "Too many uploads. Please wait a few minutes.");

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) throw new AppError(413, "FILE_TOO_LARGE", "Images must be 4 MB or smaller.");

  const form = await req.formData().catch(() => null);
  if (!form) throw badRequest("Expected a multipart form upload.");
  const file = form.get("file");
  const folder = String(form.get("folder") ?? "products");
  if (!(file instanceof File)) throw badRequest("No file was uploaded.");
  if (!FOLDERS.has(folder)) throw badRequest("Invalid upload folder.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = validateImageFile(file, bytes);
  const backend = imageStorageBackend();
  const uploaded = backend === "cloudinary" ? await uploadImage(bytes, type, folder) : await storeImage(bytes, { folder, uploadedBy: admin.id });
  await audit(admin, "upload.image", "image", uploaded.publicId, { folder, bytes: uploaded.bytes, backend });
  return json({ image: { url: uploaded.url, publicId: uploaded.publicId, width: uploaded.width, height: uploaded.height } }, { status: 201 });
});
