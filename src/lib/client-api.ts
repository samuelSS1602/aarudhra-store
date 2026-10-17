"use client";

import type { ApiErrorBody } from "@/types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public fieldErrors: Record<string, string> = {},
    public details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** JSON fetch helper for same-origin API routes with consistent error handling. */
export async function apiFetch<T>(
  url: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0, "NETWORK");
  }
  const data = (await res.json().catch(() => ({}))) as T | ApiErrorBody;
  if (!res.ok) {
    const e = (data as ApiErrorBody).error;
    throw new ApiError(
      e?.message ?? "Something went wrong. Please try again.",
      res.status,
      e?.code ?? "ERROR",
      e?.details?.fieldErrors ?? {},
      (e?.details as Record<string, unknown>) ?? {},
    );
  }
  return data as T;
}

/** Uploads a file with progress reporting (fetch has no upload progress events). */
export function uploadWithProgress<T>(url: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let data: unknown = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* ignore */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data as T);
      else {
        const e = (data as ApiErrorBody).error;
        reject(new ApiError(e?.message ?? "Upload failed.", xhr.status, e?.code ?? "UPLOAD_FAILED"));
      }
    };
    xhr.onerror = () => reject(new ApiError("Upload failed — check your connection.", 0, "NETWORK"));
    xhr.send(form);
  });
}
