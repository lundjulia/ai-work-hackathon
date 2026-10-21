"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { PennySvg } from "@/components/avatar/coach";

const PUBLIC = ["/login"];

// persist is undefined during server render (no storage there), so guard it.
const subscribe = (cb: () => void) => useApp.persist?.onFinishHydration(cb) ?? (() => {});
const hasHydrated = () => useApp.persist?.hasHydrated() ?? false;

export function useHydrated() {
  return useSyncExternalStore(subscribe, hasHydrated, () => false);
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const user = useApp((s) => s.user);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC.includes(pathname);
  const blocked = !user && !isPublic;

  useEffect(() => {
    if (hydrated && blocked) router.replace("/login");
  }, [hydrated, blocked, router]);

  if (!hydrated || blocked)
    return (
      <div className="coach-float grid flex-1 place-items-center" aria-busy="true">
        <PennySvg px={80} />
      </div>
    );
  return <>{children}</>;
}
