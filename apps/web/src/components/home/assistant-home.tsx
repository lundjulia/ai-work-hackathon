"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { demoActions, useDemoState, useHydrated } from "@/components/app-state";
import { VoicePanel } from "@/components/voice/voice-panel";
export function AssistantHome({ notificationId, autoStart = false }: { notificationId?: string; autoStart?: boolean }) {
  const state = useDemoState(); const ready = useHydrated(); const router = useRouter();
  const notification = state.notifications?.find((item) => item.id === notificationId);
  const unread = state.notifications?.filter((item) => !item.read).length ?? 0;
  useEffect(() => { if (ready && !state.onboarded) router.replace("/onboarding"); }, [ready, state.onboarded, router]);
  useEffect(() => { if (notification && !notification.read) void demoActions.readNotification(notification.id); }, [notification]);
  if (!ready || !state.onboarded) return <p className="p-6 text-sm text-muted-foreground">Getting Penny ready...</p>;
  return <main className="flex h-full min-h-0 flex-col gap-5 overflow-hidden px-5 pt-6 pb-14"><header className="flex shrink-0 items-center justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">Penny</h1><p className="mt-1 text-sm text-muted-foreground">Your AI helper for everyday money.</p></div><Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex size-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"><Bell className="size-5" />{unread > 0 && <span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{unread}</span>}</Link></header>
  {notificationId && !notification ? <p className="text-sm text-muted-foreground">This notification is no longer here. You can still ask Penny about your money.</p> : null}
  <VoicePanel key={notificationId ?? "home"} mode="assistant" notificationId={notification?.id} autoStart={autoStart && Boolean(notification)} /></main>;
}
