"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellRing, ChevronLeft, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { PennySvg, type CoachMood } from "@/components/avatar/coach";
import { useSimulateReceipt } from "@/lib/nexi/simulate";
import { useApp } from "@/lib/store";
import type { AppNotification } from "@/lib/types";

const MOOD: Record<AppNotification["kind"], CoachMood> = { win: "cheer", nudge: "comfort", tip: "think", receipt: "happy" };

function ago(iso: string, now: Date) {
  const m = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  if (m < 24 * 60) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Optional: a real OS notification via the Notification API (service worker when available, for mobile). */
async function sendTest() {
  if (!("Notification" in window)) return toast("This browser doesn't support notifications.");
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return toast("Notifications are blocked. Allow them in your browser settings.");
  const title = "Penny · FamilyBudget";
  const options = { body: "Three days under budget in a row. Nice work!", icon: "/icon-192.png" };
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(title, options);
  else new Notification(title, options);
}

export default function NotificationsPage() {
  const notifications = useApp((s) => s.notifications);
  const markRead = useApp((s) => s.markNotificationsRead);
  const { simulate, busy } = useSimulateReceipt();
  const [now, setNow] = useState(() => new Date());
  // Remember what was unread when the screen opened, so "new" dots survive marking them read.
  const [fresh] = useState(() => new Set(useApp.getState().notifications.filter((n) => !n.read).map((n) => n.id)));

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (notifications.some((n) => !n.read)) {
      notifications.forEach((n) => !n.read && fresh.add(n.id));
      markRead();
    }
  }, [notifications, markRead, fresh]);

  return (
    <main className="flex min-h-dvh flex-col bg-[radial-gradient(120%_80%_at_50%_0%,#4F8A63_0%,#1F4A39_45%,#0c1d16_100%)] px-4 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-28 text-white">
      <Link href="/" className="flex w-fit items-center gap-1 text-sm text-white/70">
        <ChevronLeft className="size-4" /> Home
      </Link>

      <header className="py-8 text-center">
        <p className="text-sm font-semibold text-white/80">
          {now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <p className="text-7xl font-extrabold tracking-tight tabular-nums">
          {now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </header>

      <ul className="space-y-2" aria-live="polite">
        {notifications.map((n) => (
          <li key={n.id} className="flex gap-3 rounded-[20px] bg-white/80 p-3 text-[#14231C] shadow-lg shadow-black/10 backdrop-blur-xl">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#F2F2EE]" aria-hidden>
              <PennySvg mood={MOOD[n.kind]} px={34} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex justify-between gap-2 text-[11px] font-semibold tracking-wide text-[#6B746E] uppercase">
                <span>FamilyBudget · Penny</span>
                <span className="flex items-center gap-1 normal-case">
                  {fresh.has(n.id) && <span className="size-2 rounded-full bg-mustard" aria-label="new" />}
                  {ago(n.at, now)}
                </span>
              </p>
              <p className="font-bold leading-snug">{n.title}</p>
              <p className="text-sm leading-snug">{n.body}</p>
            </div>
          </li>
        ))}
        {notifications.length === 0 && (
          <li className="rounded-[20px] bg-white/10 p-6 text-center text-sm text-white/80">
            No notifications yet. Simulate a receipt and Penny will chime in.
          </li>
        )}
      </ul>

      <div className="mt-auto grid gap-2 pt-8">
        <button
          type="button"
          onClick={simulate}
          disabled={busy}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-white font-bold text-forest disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Simulate a Nexi receipt
        </button>
        <button
          type="button"
          onClick={sendTest}
          className="flex h-11 items-center justify-center gap-2 rounded-full text-sm font-semibold text-white/80"
        >
          <BellRing className="size-4" /> Send a real test notification
        </button>
      </div>
    </main>
  );
}
