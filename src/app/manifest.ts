import type { MetadataRoute } from "next";

// Macht die App auf dem Handy installierbar ("Zum Home-Bildschirm").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reseller-Tracker",
    short_name: "Reseller",
    description: "Echter Gewinn pro Artikel und Warnung vor den Plattform-Meldegrenzen.",
    lang: "de",
    start_url: "/uebersicht",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
