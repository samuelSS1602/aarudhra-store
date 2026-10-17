import { NextResponse, type NextRequest } from "next/server";
import { findImage, openImageStream } from "@/lib/media-store";

export const runtime = "nodejs";

/**
 * Serves product photos stored in MongoDB: /media/<id>.webp
 * Files never change once uploaded, so browsers and CDNs may cache them for a year.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^([a-f0-9]{24})\.webp$/i.exec(file);
  if (!match) return new NextResponse("Not found", { status: 404 });
  const id = match[1]!;

  const etag = `"${id}"`;
  const cacheHeaders = {
    "Cache-Control": "public, max-age=31536000, immutable",
    ETag: etag,
  };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: cacheHeaders });

  const meta = await findImage(id);
  if (!meta) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(openImageStream(id), {
    headers: {
      ...cacheHeaders,
      "Content-Type": "image/webp",
      "Content-Length": String(meta.length),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
