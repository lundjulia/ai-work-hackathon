"use client";
import { Check, ReceiptText } from "lucide-react";
import { ConnectBanks } from "@/components/onboarding/connect-banks";
import { demoActions, reportDemoError, useDemoState } from "@/components/app-state";
export default function ConnectionsPage() {
  const state = useDemoState();
  return <main className="space-y-5 px-5 pt-6 pb-20"><header><h1 className="text-2xl font-semibold">Your connections</h1><p className="mt-2 text-sm text-muted-foreground">Sample banks and a simulated Nexi receipt service for this demo.</p></header><button disabled={state.nexiConnected} onClick={() => { void demoActions.connectNexi().catch(reportDemoError); }} className="flex w-full items-center gap-3 rounded-3xl bg-card p-4 text-left"><ReceiptText className="size-6 text-primary" /><span className="flex-1"><span className="block text-sm font-semibold">Nexi Smart Receipt</span><span className="text-xs text-muted-foreground">{state.nexiConnected ? "Demo connected" : "Simulated connection"}</span></span>{state.nexiConnected ? <Check className="size-5 text-primary" /> : <span className="text-primary">Connect</span>}</button><ConnectBanks /></main>;
}
