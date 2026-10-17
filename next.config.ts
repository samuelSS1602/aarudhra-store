import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Next.js injects inline bootstrap scripts, so
// 'unsafe-inline' is required for script-src unless a nonce-based setup is used.
// Firebase Phone Auth needs Google's reCAPTCHA and Identity Toolkit endpoints.
const firebaseHosts = {
  script: "https://www.gstatic.com https://www.google.com https://apis.google.com https://www.recaptcha.net",
  connect:
    "https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://www.google.com https://www.recaptcha.net",
  frame: "https://*.firebaseapp.com https://www.recaptcha.net https://recaptcha.google.com",
};

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${firebaseHosts.script}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://www.gstatic.com",
  "font-src 'self' data:",
  `connect-src 'self' ${firebaseHosts.connect}${isDev ? " ws: wss:" : ""}`,
  `frame-src https://www.google.com https://maps.google.com ${firebaseHosts.frame}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // Only on HTTPS deployments; on http://localhost it would break local production runs.
  ...(!isDev && (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://") ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  // Lets a second local instance (e.g. a preview) use its own build folder.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/(admin|account|login|checkout|api)(.*)",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
