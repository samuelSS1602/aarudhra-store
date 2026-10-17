import "server-only";
import type { NextResponse } from "next/server";

const prod = process.env.NODE_ENV === "production";

// `__Host-` cookies must be Secure, Path=/ and have no Domain: the browser enforces
// that they can't be set by subdomains or over plain HTTP.
export const CUSTOMER_COOKIE = prod ? "__Host-aas_session" : "aas_session";
export const ADMIN_COOKIE = prod ? "__Host-aas_admin" : "aas_admin";

export const CUSTOMER_SESSION_DAYS = 30;
export const ADMIN_SESSION_HOURS = 12;
export const ADMIN_IDLE_MINUTES = 120;

export function setSessionCookie(res: NextResponse, name: string, token: string, maxAgeSeconds: number) {
  res.cookies.set({
    name,
    value: token,
    httpOnly: true,
    secure: prod,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export function clearSessionCookie(res: NextResponse, name: string) {
  res.cookies.set({ name, value: "", httpOnly: true, secure: prod, sameSite: "lax", path: "/", maxAge: 0 });
}
