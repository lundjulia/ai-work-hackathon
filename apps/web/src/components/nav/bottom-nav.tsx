"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartPie, House, Sparkles, Target, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";

const TABS = [
  { href: "/", label: "Home", icon: House },
  { href: "/budget", label: "Budget", icon: ChartPie },
  { href: "/meals", label: "Meals", icon: UtensilsCrossed },
  { href: "/advisor", label: "Penny", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Target },
];

export function BottomNav() {
  const pathname = usePathname();
  const user = useApp((s) => s.user);
  if (!user || pathname === "/login" || pathname === "/connect") return null;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[456px] rounded-full bg-white p-1.5 shadow-lg shadow-black/5"
    >
      <ul className="grid grid-cols-5 gap-1">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold text-muted-foreground transition-colors",
                  active && "bg-pale-green text-forest",
                )}
              >
                <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
