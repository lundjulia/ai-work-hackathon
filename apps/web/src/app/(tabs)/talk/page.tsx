import { VoicePanel } from "@/components/voice/voice-panel";

export default function TalkPage() {
  return (
    <main className="flex min-h-full flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Talk</h1>
        <p className="text-sm text-muted-foreground">Ask Autopilot about your money. Answers use your app data.</p>
      </header>
      <VoicePanel />
    </main>
  );
}
