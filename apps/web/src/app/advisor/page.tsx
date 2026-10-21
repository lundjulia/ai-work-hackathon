"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Plus, Send, Check } from "lucide-react";
import { Coach, type CoachMood } from "@/components/avatar/coach";
import { Button } from "@/components/ui/button";
import { useApp, spentThisMonth } from "@/lib/store";
import { buildContext, MAX_MESSAGE_CHARS, splitPledge, type ChatMessage } from "@/lib/advisor";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Where did our money go this month?",
  "How much can we save for the trip?",
  "Should we invest in stocks?",
  "No candy this week!",
];

type Msg = ChatMessage & { pledge?: string | null; added?: boolean };

// Minimal Web Speech API typing (not in TS's DOM lib).
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;
const getRecognition = () =>
  typeof window === "undefined"
    ? undefined
    : ((window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition);

export default function AdvisorPage() {
  const { profile, goal, pledges, receipts, addPledge } = useApp();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  // AuthGate renders pages client-only, so reading window here is hydration-safe.
  const [canListen] = useState(() => !!getRecognition());
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!content || busy) return;
    const history: Msg[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const update = (content: string, pledge?: string | null) =>
      setMessages((m) => [...m.slice(0, -1), { role: "assistant", content, pledge }]);
    try {
      const res = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          context: buildContext(profile, goal, pledges, receipts, spentThisMonth(receipts)),
        }),
      });
      if (!res.ok || !res.body) throw new Error(await res.text());
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        update(splitPledge(full).text);
      }
      const { text: final, pledge } = splitPledge(full);
      update(final, pledge);
    } catch {
      update("Hmm, I couldn't reach my brain just now. Try again in a moment? 💛");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const Rec = getRecognition();
    if (!Rec) return;
    if (listening) return recRef.current?.stop();
    const rec = new Rec();
    rec.lang = navigator.language?.startsWith("da") ? "da-DK" : "en-US";
    rec.interimResults = true;
    rec.onresult = (e) => setInput(Array.from(e.results, (r) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  const last = messages.at(-1);
  const mood: CoachMood = busy ? "think" : last?.pledge ? "cheer" : "happy";

  return (
    <div className="flex h-[calc(100dvh-4.5rem-env(safe-area-inset-bottom))] flex-col bg-[#F2F2EE]">
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Coach size="sm" mood={mood} />
        <div>
          <h1 className="text-xl font-bold tracking-tight text-[#14231C]">Ask Penny</h1>
          <p className="text-xs text-[#6B746E]">I&apos;m an AI, and I&apos;m on your side. The family decides.</p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2" aria-live="polite">
        {messages.length === 0 && (
          <div className="rounded-[20px] bg-[#1F4A39] p-4 text-sm text-white">
            <p className="font-semibold">Hi, I&apos;m Penny! 👋</p>
            <p className="mt-1 text-white/80">
              Ask me where the money went, what you can save for {goal.emoji} {goal.name}, or tell me a pledge.
              I never pick investments for you, but I&apos;ll show what&apos;s possible.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-[20px] px-4 py-2.5 text-sm leading-snug",
                m.role === "user" ? "rounded-br-md bg-[#1F4A39] text-white" : "rounded-bl-md bg-white text-[#14231C]",
              )}
            >
              {m.content || <span className="animate-pulse text-[#6B746E]">Penny is thinking…</span>}
            </div>
            {m.pledge && (
              <Button
                size="sm"
                variant="outline"
                disabled={m.added}
                className="mt-1.5 rounded-full border-0 bg-[#DCEBDD] text-[#1F4A39]"
                onClick={() => {
                  addPledge(m.pledge!);
                  setMessages((all) => all.map((x, j) => (j === i ? { ...x, added: true } : x)));
                }}
              >
                {m.added ? <Check /> : <Plus />}
                {m.added ? "Pledge added" : `Add pledge: ${m.pledge}`}
              </Button>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 px-4 pt-2 pb-3">
        {!busy && messages.length < 2 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#1F4A39]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2 rounded-full bg-white p-1.5 pl-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder={listening ? "Listening…" : "Ask Penny anything…"}
            aria-label="Message Penny"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#6B746E]"
          />
          {canListen && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={toggleMic}
              aria-label={listening ? "Stop listening" : "Speak"}
              className={cn("rounded-full", listening && "bg-[#DCEBDD] text-[#1F4A39]")}
            >
              <Mic />
            </Button>
          )}
          <Button
            type="submit"
            size="icon"
            disabled={busy || !input.trim()}
            aria-label="Send"
            className="rounded-full bg-[#1F4A39] text-white"
          >
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
