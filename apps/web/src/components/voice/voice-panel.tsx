"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from "@claude-impact-lab/ui/components/message-scroller";
import { Keyboard, LoaderCircle, Mic, MicOff, PhoneOff, Send } from "lucide-react";
import { useRef, useState } from "react";

import { useDemoState } from "@/components/app-state";
import type { VoiceMode } from "@/lib/voice-artifacts";
import { PennySvg, type CoachMood } from "./penny-avatar";
import { useRealtimeVoice, type VoiceStatus } from "./use-realtime-voice";
import { VoiceArtifactCard } from "./voice-artifact";
import { VoiceTranscript } from "./voice-transcript";

const LABELS: Record<VoiceStatus, string> = {
  idle: "Tap to talk", connecting: "Connecting", listening: "I'm listening", thinking: "Let me check", speaking: "Penny is speaking",
};
const SUGGESTIONS = ["How is our food budget doing?", "Can we afford a weekend away?", "What needs my attention?"];

type VoicePanelProps = {
  mode?: VoiceMode;
  notificationId?: string;
  autoStart?: boolean;
  onOnboardingComplete?: () => void;
};

export function VoicePanel(props: VoicePanelProps) {
  const voice = useRealtimeVoice(props);
  const hasConversation = voice.entries.length > 0 || voice.active;
  return <MessageScrollerProvider autoScroll={hasConversation} defaultScrollPosition={hasConversation ? "end" : "start"} scrollEdgeThreshold={32}>
    <VoicePanelContent {...props} voice={voice} />
  </MessageScrollerProvider>;
}

function VoicePanelContent({ mode = "assistant", notificationId, onOnboardingComplete, voice }: VoicePanelProps & { voice: ReturnType<typeof useRealtimeVoice> }) {
  const { scrollToEnd } = useMessageScroller();
  const state = useDemoState();
  const notification = state.notifications?.find((item) => item.id === notificationId);
  const [draft, setDraft] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const busy = voice.chatPending || voice.status === "connecting";
  const mood: CoachMood = voice.status === "thinking" || voice.chatPending || voice.status === "connecting" ? "think" : voice.status === "speaking" ? "cheer" : "happy";
  const welcome = mode === "onboarding" ? "Let's make a plan that fits your family." : notification ? "Let's look at this together." : "Hi Sofie. What can I help you with?";
  const suggestions = mode === "onboarding" ? ["Help me set up our family budget"] : SUGGESTIONS;
  const micLabel = voice.connected ? voice.muted ? "Unmute microphone" : "Mute microphone" : voice.active ? "Cancel voice connection" : voice.error ? "Retry voice" : "Talk to Penny";

  async function submit(text: string) {
    scrollToEnd({ behavior: "auto" });
    if (await voice.sendText(text)) setDraft("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <MessageScroller className="h-auto flex-1">
        <MessageScrollerViewport aria-label="Conversation with Penny" className="scrollbar-none [overflow-anchor:none]">
          <MessageScrollerContent className="gap-5 pb-5" role="presentation">
            <section className="flex flex-col items-center pt-1 text-center">
              <div className="relative">
                {voice.status === "listening" && <span aria-hidden className="absolute inset-3 rounded-full bg-primary/10 motion-safe:animate-pulse" />}
                <PennySvg mood={mood} px={112} />
                <span className="absolute bottom-9 right-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">AI</span>
              </div>
              <h2 className="mt-2 max-w-sm text-xl font-semibold leading-snug tracking-tight">{welcome}</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
                {mode === "onboarding" ? "Tell me about your income, everyday spending and what you're saving for. I'll put the plan together for you." : "Ask in your own words. I'll bring up the numbers when they're useful."}
              </p>
              {voice.notConfigured && <p role="status" className="mt-3 max-w-sm text-xs leading-relaxed text-muted-foreground">Voice isn't connected yet. You can still chat with Penny by typing below.</p>}
              {voice.error && <p role="alert" className="mt-3 max-w-sm text-xs leading-relaxed text-destructive">{voice.error}</p>}
            </section>

            {notification && <aside className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-left">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">The update you opened</p>
              <p className="mt-1 text-sm font-medium">{notification.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.body}</p>
            </aside>}

            {!voice.entries.length && <div className="flex flex-wrap justify-center gap-2">{suggestions.map((question) => <button key={question} type="button" disabled={busy} onClick={() => void submit(question)} className="rounded-full border bg-card px-3 py-2 text-xs text-foreground transition hover:bg-muted disabled:opacity-50">{question}</button>)}</div>}

            {voice.entries.length > 0 && <VoiceTranscript entries={voice.entries} />}
            {voice.artifacts.length > 0 && <section className="space-y-3" aria-label="Cards from Penny">
              {voice.artifacts.map((entry) => <VoiceArtifactCard key={entry.callId} entry={entry}
                onConfirm={() => { void voice.confirmSettings(entry).then((saved) => { if (saved && entry.artifact.kind === "settings" && entry.artifact.finishOnboarding) onOnboardingComplete?.(); }); }}
                onDecision={voice.notifyActionDecision} />)}
            </section>}
            {voice.chatPending && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="size-3.5 animate-spin" />Penny is replying</p>}
            {voice.textError && <p role="alert" className="text-xs leading-relaxed text-destructive">{voice.textError}</p>}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <MessageScrollerButton aria-label="Jump to latest message" behavior="auto" className="z-10 shadow-md" />
      </MessageScroller>

      <form className="relative z-10 shrink-0 rounded-3xl border border-border/60 bg-card p-3 focus-within:border-primary/40" onSubmit={(event) => { event.preventDefault(); if (draft.trim() && !busy) void submit(draft); }}>
        <label htmlFor={`penny-message-${mode}`} className="sr-only">Message Penny</label>
        <textarea ref={messageRef} id={`penny-message-${mode}`} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder={mode === "onboarding" ? "We bring home 32,000 kr. a month..." : "Ask Penny about your money..."} disabled={busy} className="block min-h-12 w-full resize-none bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground/70 disabled:opacity-60" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (draft.trim() && !busy) void submit(draft); } }} />
        <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2">
          <Button type="button" variant="ghost" size="icon" className={`size-11 rounded-full ${voice.active ? "text-primary" : "text-muted-foreground"}`} disabled={voice.chatPending} onClick={() => { if (voice.connected) voice.toggleMute(); else if (voice.active) voice.stop(); else { scrollToEnd({ behavior: "auto" }); void voice.start(); } }} aria-label={micLabel} title={micLabel} aria-pressed={voice.connected ? voice.muted : voice.active}>
            {voice.status === "connecting" ? <LoaderCircle className="size-5 animate-spin" /> : voice.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          </Button>
          {voice.connected &&
            <Button type="button" variant="ghost" size="icon" className="size-11 rounded-full text-muted-foreground" onClick={voice.stop} aria-label="End conversation" title="End conversation"><PhoneOff className="size-5" /></Button>
          }
          <Button type="button" variant="ghost" size="icon" className="size-11 rounded-full text-muted-foreground" disabled={busy} onClick={() => messageRef.current?.focus()} aria-label="Type a message" title="Type a message" aria-controls={`penny-message-${mode}`}><Keyboard className="size-5" /></Button>
          <span role="status" className="min-w-0 flex-1 px-1 text-xs text-muted-foreground">{voice.error && !voice.active ? "Retry voice" : voice.active ? LABELS[voice.status] : "Talk or type"}</span>
          <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={busy || !draft.trim()} aria-label="Send message to Penny">{voice.chatPending ? <LoaderCircle className="size-5 animate-spin" /> : <Send className="size-5" />}</Button>
        </div>
      </form>
    </div>
  );
}
