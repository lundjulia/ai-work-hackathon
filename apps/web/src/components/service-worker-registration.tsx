"use client";

import { useEffect } from "react";

// Registers /sw.js (public/sw.js). It handles web push today; subscribing comes later.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch((error) => console.error("Service worker registration failed", error));
  }, []);

  return null;
}
