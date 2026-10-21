"use client";

import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    // Production only: a caching SW in dev would serve stale HMR chunks.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  return null;
}
