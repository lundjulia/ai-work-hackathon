import type { MetadataRoute } from "next";

// Placeholder name and colors until branding lands.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Autopilot",
    short_name: "Autopilot",
    description: "Money on autopilot: your banks, checked daily by an agent.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafbfc",
    theme_color: "#fafbfc",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
