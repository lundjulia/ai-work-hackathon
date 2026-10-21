"use client";
import { Button } from "@claude-impact-lab/ui/components/button";
import { Check, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { demoActions, reportDemoError, useDemoState, useHydrated } from "@/components/app-state";
import { VoicePanel } from "@/components/voice/voice-panel";
import { ConnectBanks } from "./connect-banks";
export function OnboardingFlow() {
  const router = useRouter();
  const state = useDemoState();
  const ready = useHydrated();
  const [talking, setTalking] = useState(false);
  useEffect(() => { if (ready && state.onboarded) router.replace("/"); }, [ready, state.onboarded, router]);
  if (!ready) return <p className="p-6 text-sm text-muted-foreground">Getting things ready...</p>;
  return <main className={`flex min-h-0 flex-1 flex-col px-5 py-6 ${talking ? "overflow-hidden" : "overflow-y-auto"}`}>{!talking ? <>
    <header className="mb-6 space-y-2"><p className="text-sm font-medium text-primary">Meet Penny, your AI money helper</p><h1 className="text-3xl font-semibold tracking-tight">Let's make money feel simpler.</h1><p className="text-sm text-muted-foreground">Connect your services, then talk with Penny about what comes in, what you spend and what you'd like to save for.</p></header>
    <button type="button" disabled={state.nexiConnected} onClick={() => { void demoActions.connectNexi().catch(reportDemoError); }} className="mb-5 flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left ring-1 ring-foreground/5"><ReceiptText className="size-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">Nexi Smart Receipt</span><span className="text-xs text-muted-foreground">Simulated connection for the demo</span></span>{state.nexiConnected ? <Check className="size-5 text-primary" /> : <span className="text-sm font-medium text-primary">Connect</span>}</button>
    <ConnectBanks /><Button className="mt-6 h-12 w-full" disabled={!state.connectedBanks.length} onClick={() => setTalking(true)}>Talk with Penny about your plan</Button><p className="mt-3 text-center text-xs text-muted-foreground">Sample bank data. Your settings stay saved in this browser.</p>
  </> : <><button className="mb-4 shrink-0 self-start text-sm text-muted-foreground" onClick={() => setTalking(false)}>Back to connections</button><h1 className="mb-2 shrink-0 text-2xl font-semibold">Let's work out your plan.</h1><p className="mb-5 shrink-0 text-sm text-muted-foreground">Tell Penny about your income, everyday spending, a buffer for surprises and something you'd like to save for. You'll see your plan before saving it.</p><VoicePanel mode="onboarding" onOnboardingComplete={() => router.replace("/")} /></>}</main>;
}
