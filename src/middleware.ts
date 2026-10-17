import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware:
 *  1. CSRF protection — state-changing API requests must come from our own origin
 *     (cookies are SameSite=Lax as a second layer). Webhooks/cron are exempt and
 *     authenticate by signature / secret instead.
 *  2. Fast redirects for signed-out users on private pages. This is only UX:
 *     every page and API re-checks the session on the server.
 */

const prod = process.env.NODE_ENV === "production";
const CUSTOMER_COOKIE = prod ? "__Host-aas_session" : "aas_session";
const ADMIN_COOKIE = prod ? "__Host-aas_admin" : "aas_admin";
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT = ["/api/webhooks/", "/api/cron/"];

function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return false;
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // Some browsers omit Origin on same-origin requests; fall back to Fetch Metadata.
  const site = req.headers.get("sec-fetch-site");
  return site === "same-origin";
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    if (!SAFE_METHODS.has(req.method) && !CSRF_EXEMPT.some((p) => pathname.startsWith(p)) && !sameOrigin(req)) {
      return NextResponse.json({ error: { code: "CSRF", message: "Cross-site request blocked." } }, { status: 403 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login") && !req.cookies.has(ADMIN_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if ((pathname.startsWith("/account") || pathname.startsWith("/checkout")) && !req.cookies.has(CUSTOMER_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/admin/:path*", "/account/:path*", "/checkout/:path*"],
};
