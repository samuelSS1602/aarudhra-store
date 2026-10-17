import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { AppError, badRequest } from "@/lib/errors";
import { ConfigurationError } from "@/lib/env";
import { logger } from "@/lib/logger";

export const DEFAULT_JSON_LIMIT = 100 * 1024; // 100 KB

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function zodDetails(err: ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { fieldErrors };
}

/** Reads and validates a JSON body with a hard size limit. Unknown keys are stripped by the schema. */
export async function readJson<Out, In = Out>(
  req: Request,
  schema: ZodType<Out, ZodTypeDef, In>,
  maxBytes = DEFAULT_JSON_LIMIT,
): Promise<Out> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw badRequest("Malformed JSON body.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Please check the highlighted fields.", zodDetails(parsed.error));
  return parsed.data;
}

export function parseQuery<Out, In = Out>(req: NextRequest, schema: ZodType<Out, ZodTypeDef, In>): Out {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    obj[k] = v;
  });
  const parsed = schema.safeParse(obj);
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid query parameters.", zodDetails(parsed.error));
  return parsed.data;
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    const headers: Record<string, string> = {};
    const retry = err.details?.retryAfterSeconds;
    if (typeof retry === "number") headers["Retry-After"] = String(retry);
    return NextResponse.json(
      { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } },
      { status: err.status, headers },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid input.", details: zodDetails(err) } },
      { status: 400 },
    );
  }
  if (err instanceof ConfigurationError) {
    logger.error("Configuration error", { message: err.message });
    return NextResponse.json(
      { error: { code: "NOT_CONFIGURED", message: "This service is not configured yet. Please try again later." } },
      { status: 503 },
    );
  }
  const mongoErr = err as { code?: number; keyValue?: Record<string, unknown> };
  if (mongoErr?.code === 11000) {
    const field = Object.keys(mongoErr.keyValue ?? {})[0] ?? "value";
    return NextResponse.json(
      { error: { code: "DUPLICATE", message: `A record with this ${field} already exists.`, details: { field } } },
      { status: 409 },
    );
  }
  logger.error("Unhandled API error", { error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err) });
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

type RouteContext<P> = { params: Promise<P> };

/** Resolves and validates an `[id]` route segment as a Mongo ObjectId. */
export async function idParam(params: Promise<{ id: string }>, label = "Record"): Promise<string> {
  const { id } = await params;
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new AppError(404, "NOT_FOUND", `${label} not found.`);
  return id;
}

/** Wraps a route handler with uniform error handling. */
export function route<P = Record<string, string>>(
  fn: (req: NextRequest, ctx: RouteContext<P>) => Promise<Response>,
) {
  return async (req: NextRequest, ctx: RouteContext<P>) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
