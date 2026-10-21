"use client";

import { Bubble, BubbleContent } from "@claude-impact-lab/ui/components/bubble";
import { Message, MessageContent } from "@claude-impact-lab/ui/components/message";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import { Check, CircleAlert, LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";

import type { TranscriptEntry } from "./use-realtime-voice";

const TOOL_LABELS: Record<string, [running: string, done: string]> = {
  get_overview: ["Checking your accounts…", "Checked your accounts"],
  get_budget_status: ["Checking your budget…", "Checked your budget"],
  get_action_items: ["Looking at your action items…", "Looked at your action items"],
  can_i_afford: ["Running the numbers…", "Ran the affordability check"],
  get_goals: ["Checking your goals…", "Checked your goals"],
  explain_action_item: ["Pulling up the details…", "Pulled up the details"],
};

function ToolChip({ name, state }: { name: string; state: "running" | "done" | "error" }) {
  const [running, done] = TOOL_LABELS[name] ?? [`Using ${name}…`, `Used ${name}`];
  const Icon = state === "running" ? LoaderCircle : state === "done" ? Check : CircleAlert;
  return (
    <div className="flex justify-start">
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground",
          state === "error" && "border-destructive/40 text-destructive",
        )}
      >
        <Icon className={cn("size-3.5", state === "running" && "animate-spin")} />
        {state === "error" ? `${done} (failed)` : state === "running" ? running : done}
      </span>
    </div>
  );
}

export function VoiceTranscript({ entries }: { entries: TranscriptEntry[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries]);

  return (
    <div className="flex flex-col gap-3" aria-live="polite" aria-label="Conversation transcript">
      {entries.map((e) => {
        if (e.kind === "tool") return <ToolChip key={`tool-${e.id}`} name={e.name} state={e.state} />;
        if (e.kind === "user" && !e.text && !e.final) {
          return (
            <Message key={`user-${e.id}`} align="end">
              <MessageContent>
                <Bubble align="end" variant="secondary">
                  <BubbleContent className="text-sm text-muted-foreground">…</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          );
        }
        if (!e.text) return null;
        const isUser = e.kind === "user";
        return (
          <Message key={`${e.kind}-${e.id}`} align={isUser ? "end" : "start"}>
            <MessageContent>
              <Bubble align={isUser ? "end" : "start"} variant={isUser ? "secondary" : "muted"}>
                <BubbleContent className="text-sm">{e.text}</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        );
      })}
      <div ref={endRef} />
    </div>
  );
}
