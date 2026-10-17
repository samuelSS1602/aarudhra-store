import type { MetadataRoute } from "next";

/** Lets customers "Add to Home Screen" on Android/iOS and open the store like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aarudhra Smart Store",
    short_name: "Aarudhra",
    description: "Stationery, home goods and everyday essentials from Palani — order online, Cash on Delivery.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f8fc",
    theme_color: "#2b3590",
    categories: ["shopping"],
    lang: "en-IN",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
