import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap", axes: ["opsz"] });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Aarudhra Smart Store";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: `${storeName} — Stationery & Home Goods in Palani`, template: `%s | ${storeName}` },
  description:
    "Shop stationery, office supplies, home essentials and everyday products at affordable prices from Aarudhra Smart Store, Palani, Tamil Nadu. Cash on Delivery available.",
  applicationName: storeName,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: storeName,
    locale: "en_IN",
    url: appUrl,
    title: `${storeName} — Stationery & Home Goods in Palani`,
    description: "Stationery, home goods and daily-use products at affordable prices. Order online from our Palani store.",
  },
  twitter: { card: "summary_large_image" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#2b3590",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            classNames: {
              toast: "!rounded-[var(--radius-lg)] !border-border !shadow-lift !font-sans",
            },
          }}
        />
      </body>
    </html>
  );
}
