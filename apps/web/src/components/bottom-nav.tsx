"use client";
import { Bell, Mic, Settings2 } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import { useDemoState } from "@/components/app-state";
const tabs = [{ href: "/", label: "Penny", icon: Mic }, { href: "/notifications", label: "Updates", icon: Bell }, { href: "/connections", label: "Connections", icon: Settings2 }] as const;
export default function BottomNav() {
  const pathname = usePathname(); const unread = useDemoState().notifications?.filter((item) => !item.read).length ?? 0;
  return <nav className="sticky bottom-0 z-10 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"><ul className="grid grid-cols-3">{tabs.map(({ href, label, icon: Icon }) => <li key={href}><Link href={href as Route} aria-current={pathname === href ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-3 text-xs text-muted-foreground", pathname === href && "text-primary")}><span className="relative"><Icon className="size-5" />{href === "/notifications" && unread > 0 && <span className="absolute -top-2 -right-3 rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{unread}</span>}</span>{label}</Link></li>)}</ul></nav>;
}
