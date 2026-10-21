"use client";

import { cn } from "@claude-impact-lab/ui/lib/utils";
import { Bell, Home, Mic, Target } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useHydrated, useNewActionCount } from "@/components/app-state";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/actions", label: "Actions", icon: Bell },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/talk", label: "Talk", icon: Mic },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const newCount = useNewActionCount();

  return (
    <nav className="sticky bottom-0 z-10 border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const badge = href === "/actions" && hydrated && newCount > 0 ? newCount : 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? `${label}, ${badge} new` : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors",
                  active && "text-primary",
                )}
              >
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
                  {badge ? (
                    <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 animate-in items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white zoom-in-50">
                      {badge}
                    </span>
                  ) : null}
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
