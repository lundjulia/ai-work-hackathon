"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@claude-impact-lab/ui/components/empty";
import { MicOff, Mic, PhoneOff } from "lucide-react";

import { useRealtimeVoice } from "./use-realtime-voice";
import { VoiceOrb } from "./voice-orb";
import { VoiceTranscript } from "./voice-transcript";

const SUGGESTIONS = [
  "Can I afford a weekend in Lisbon next month?",
  "How is my restaurant budget doing?",
  "What should I act on today?",
];

export function VoicePanel() {
  const voice = useRealtimeVoice();
  const connected = voice.active && voice.status !== "connecting";

  if (voice.notConfigured) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MicOff />
          </EmptyMedia>
          <EmptyTitle>Voice not configured</EmptyTitle>
          <EmptyDescription>
            The server has no OpenAI key. Set OPENAI_API_KEY in apps/web/.env and restart to talk to Autopilot.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <div className="flex flex-col items-center gap-3 pt-2">
        <VoiceOrb status={voice.status} onPress={voice.active ? voice.stop : voice.start} />
        {voice.active && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={voice.toggleMute} disabled={!connected}>
              {voice.muted ? <Mic /> : <MicOff />}
              {voice.muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant="destructive" size="sm" onClick={voice.stop}>
              <PhoneOff />
              End
            </Button>
          </div>
        )}
        {voice.error && (
          <p role="alert" className="max-w-xs text-center text-xs text-destructive">
            {voice.error}
          </p>
        )}
      </div>

      {voice.entries.length > 0 ? (
        <VoiceTranscript entries={voice.entries} />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs text-muted-foreground">
            {connected ? "Ask out loud, or tap a question:" : "Try asking:"}
          </p>
          {SUGGESTIONS.map((q) => (
            <Button
              key={q}
              variant="outline"
              className="h-auto justify-start py-2 text-left text-sm whitespace-normal"
              disabled={!connected}
              onClick={() => voice.sendText(q)}
            >
              “{q}”
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
