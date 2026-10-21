"use client";

import { Skeleton } from "@claude-impact-lab/ui/components/skeleton";
import { Sparkles, Sun } from "lucide-react";

import {
  useDemoState,
  useHydrated,
  useAutopilotConfigured,
} from "@/components/app-state";
import { formatDate, formatTime } from "@/lib/format";

import { ActionCard } from "./action-card";

export function ActionsScreen() {
  const hydrated = useHydrated();
  const configured = useAutopilotConfigured();
  const { actions, runs } = useDemoState();
  const fresh = actions.filter((a) => a.status === "new");
  const handled = actions.filter((a) => a.status !== "new");
  const latest = runs[0];

  if (!hydrated) {
    return (
      <div className="space-y-4 px-5 pt-6">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <main className="space-y-6 px-5 pt-6 pb-10">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Sparkles className="size-3.5 text-primary" />
          {latest
            ? `Last run ${formatDate(latest.date, "weekday")}${formatTime(latest.ranAt) ? `, ${formatTime(latest.ranAt)}` : ""} · ${latest.newItemCount} new`
            : "Autopilot has not run yet"}
        </p>
      </header>

      {fresh.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-card px-6 py-12 text-center ring-1 ring-foreground/[0.06]">
          <span className="flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sun className="size-6" />
          </span>
          <div className="space-y-1">
            <p className="text-lg font-semibold">
              {latest ? "Nothing needs you" : "Your first check is pending"}
            </p>
            <p className="text-sm text-muted-foreground">
              {latest
                ? "Go live your life. Autopilot will tell you when something comes up."
                : configured
                  ? "Open demo controls to run Autopilot."
                  : "Autopilot needs its AI connection before it can review your accounts."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {fresh.map((item, i) => (
            <ActionCard key={item.id} item={item} index={i} />
          ))}
        </div>
      )}

      {handled.length > 0 ? (
        <section className="space-y-3">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">
            Handled
          </h2>
          <div className="space-y-3">
            {handled.map((item) => (
              <ActionCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
