import type { MetadataRoute } from "next";

// Penny install metadata.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Penny",
    short_name: "Penny",
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
