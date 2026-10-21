"use client";

import { cn } from "@claude-impact-lab/ui/lib/utils";
import { AudioLines, LoaderCircle, Mic, Sparkles } from "lucide-react";

import type { VoiceStatus } from "./use-realtime-voice";

const LABELS: Record<VoiceStatus, string> = {
  idle: "Tap to talk",
  connecting: "Connecting…",
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
};

const ICONS = { idle: Mic, connecting: LoaderCircle, listening: Mic, thinking: Sparkles, speaking: AudioLines };

export function VoiceOrb({
  status,
  disabled,
  onPress,
}: {
  status: VoiceStatus;
  disabled?: boolean;
  onPress: () => void;
}) {
  const Icon = ICONS[status];
  const active = status !== "idle";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative grid size-40 place-items-center">
        {/* State rings */}
        {status === "listening" && (
          <span className="absolute inset-2 animate-ping rounded-full bg-primary/15 [animation-duration:2s]" />
        )}
        {status === "speaking" && <span className="absolute inset-0 animate-pulse rounded-full bg-primary/20" />}
        {(status === "thinking" || status === "connecting") && (
          <span className="absolute inset-1 animate-spin rounded-full border-2 border-primary/20 border-t-primary [animation-duration:1.2s]" />
        )}
        <button
          type="button"
          onClick={onPress}
          disabled={disabled}
          aria-label={active ? "End conversation" : "Start talking to Autopilot"}
          aria-pressed={active}
          className={cn(
            "relative grid size-32 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform outline-none select-none",
            "focus-visible:ring-4 focus-visible:ring-ring/40 active:scale-95 disabled:opacity-40",
            status === "speaking" && "scale-105",
          )}
        >
          <Icon className={cn("size-12", status === "connecting" && "animate-spin")} strokeWidth={1.75} />
        </button>
      </div>
      <p className="text-sm font-medium text-muted-foreground" aria-live="polite">
        {disabled ? "Voice not configured" : LABELS[status]}
        {active && status !== "connecting" && <span className="sr-only"> Tap the button to end.</span>}
      </p>
    </div>
  );
}
