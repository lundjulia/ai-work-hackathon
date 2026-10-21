"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@claude-impact-lab/ui/components/sheet";
import {
  BellRing,
  FastForward,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import {
  demoActions,
  useDemoState,
  useHydrated,
  useAutopilotConfigured,
  reportDemoError,
} from "@/components/app-state";
import { DemoBadge } from "@/components/section";
import { formatDate } from "@/lib/format";
import type { ActionItem } from "@/lib/view-models";
import type { DemoEventKind } from "@/lib/demo-notifications";

async function showSystemNotification(items: ActionItem[]) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || !("serviceWorker" in navigator))
    return;
  const registration = await navigator.serviceWorker.getRegistration();
  await registration?.showNotification("Penny", {
    body: `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you: ${items[0]?.title ?? ""}`,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: { url: "/notifications" },
  });
}

/**
 * Demo "time skip": a discreet floating control that moves the simulated clock and triggers the
 * daily autopilot run through a snapshot of browser-local state.
 */
export function DemoControl() {
  const router = useRouter();
  const hydrated = useHydrated();
  const configured = useAutopilotConfigured();
  const { simulatedDate } = useDemoState();
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [permission, setPermission] = useState<string | null>(null);

  const run = async () => {
    setRunning(true);
    try {
      const { items } = await demoActions.runAutopilot();
      setOpen(false);
      if (items.length === 0) {
        toast("Penny checked everything", {
          description: "Nothing needs you today. Go live your life.",
        });
        return;
      }
      void showSystemNotification(items);
      toast(
        `${items.length} ${items.length === 1 ? "thing needs" : "things need"} you`,
        {
          description: items.map((i) => i.title).join(" · "),
          icon: <Sparkles className="size-4 text-primary" />,
          duration: 8000,
          action: { label: "View updates", onClick: () => router.push("/notifications") },
        },
      );
    } catch (error) {
      reportDemoError(error);
    } finally {
      setRunning(false);
    }
  };

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(await Notification.requestPermission());
  };
  const trigger = async (kind: DemoEventKind) => {
    setRunning(true);
    try {
      await demoActions.triggerEvent(kind);
      setOpen(false);
      router.push("/notifications");
    } catch (error) { reportDemoError(error); }
    finally { setRunning(false); }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open demo controls"
        className="absolute right-4 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 flex h-9 items-center gap-1.5 rounded-full bg-foreground/85 px-3 text-xs font-medium text-background shadow-lg backdrop-blur transition hover:bg-foreground active:scale-95"
      >
        <FastForward className="size-3.5" />
        Demo events
      </button>

      <Sheet open={open} onOpenChange={(next) => !running && setOpen(next)}>
        <SheetContent
          side="bottom"
          className="mx-auto max-w-md rounded-t-[2rem] border-0 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
        >
          <div className="space-y-6">
            <div className="mx-auto h-1 w-10 rounded-full bg-foreground/10" />
            <div className="space-y-2">
              <DemoBadge>Demo events</DemoBadge>
              <SheetTitle className="text-lg font-semibold">
                Show how an update arrives
              </SheetTitle>
              <SheetDescription className="text-sm">
                Add an in-app notification, then open it to talk with Penny. These sample events do not change your finances.
              </SheetDescription>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["receipt", "Nexi receipt"], ["budget", "Budget update"],
                ["review", "Money check"], ["goal", "Savings goal"],
              ] as const).map(([kind, label]) => <Button key={kind} variant="outline" className="h-12" disabled={running} onClick={() => { void trigger(kind); }}>{label}</Button>)}
            </div>
            <p className="text-xs text-muted-foreground">Simulated date: {formatDate(simulatedDate, "long")}</p>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                disabled={running}
                onClick={() => {
                  void demoActions.advanceDays(1).catch(reportDemoError);
                }}
              >
                Skip 1 day
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-12"
                disabled={running}
                onClick={() => {
                  void demoActions.advanceDays(7).catch(reportDemoError);
                }}
              >
                Skip 7 days
              </Button>
            </div>

            {!configured ? (
              <p className="text-sm text-muted-foreground">
                Penny needs its AI connection before it can run. Your
                accounts and goals are saved.
              </p>
            ) : null}
            <Button
              size="lg"
              className="h-13 w-full text-base"
              onClick={run}
              disabled={running || !configured}
            >
              {running ? (
                <>
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                  Penny is reviewing…
                </>
              ) : (
                <>
                  <Sparkles data-icon="inline-start" />
                  Run Penny now
                </>
              )}
            </Button>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={enableNotifications}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                <BellRing className="size-4" />
                {permission === "granted"
                  ? "Notifications on"
                  : permission === "denied"
                    ? "Notifications blocked"
                    : permission === "unsupported"
                      ? "Notifications unsupported"
                      : "Enable notifications"}
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await demoActions.reset();
                    setOpen(false);
                    router.push("/onboarding");
                  } catch (error) {
                    reportDemoError(error);
                  }
                }}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
              >
                <RotateCcw className="size-4" />
                Reset demo
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
