"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Check, Loader2, ShieldCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Coach } from "@/components/avatar/coach";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { connect, fetchReceipts } from "@/lib/nexi/client";
import { useApp } from "@/lib/store";

const SHARED = ["Shop name, date and time", "Items, quantities and prices", "Receipt totals"];
const NOT_SHARED = ["Card numbers", "Bank balance", "Your Nexi login"];

/** Neutral stand-in for the Nexi mark (not their logo). */
function NMark({ className = "size-8 text-base" }: { className?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-lg bg-[#20255c] font-extrabold text-white ${className}`}>
      N
    </span>
  );
}

const STEPS = ["Confirming your consent…", "Fetching your receipts…", "All set!"];

export default function ConnectPage() {
  const router = useRouter();
  const connected = useApp((s) => s.nexiConnected);
  const connectNexi = useApp((s) => s.connectNexi);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(-1); // -1 = consent not given yet
  const [count, setCount] = useState(0);

  async function allow() {
    setStep(0);
    await connect();
    setStep(1);
    const receipts = await fetchReceipts();
    setCount(receipts.length);
    setStep(2);
    connectNexi();
    toast.success(`Nexi connected · ${receipts.length} receipts imported`);
    setTimeout(() => router.push("/"), 900);
  }

  return (
    <main className="flex min-h-dvh flex-col gap-6 bg-forest px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-28 text-white">
      <header className="flex items-center justify-between text-sm text-white/70">
        <span className="flex items-center gap-3">
          02 / 03
          <span className="flex gap-1" aria-hidden>
            <span className="h-1 w-6 rounded-full bg-white/40" />
            <span className="h-1 w-6 rounded-full bg-white" />
            <span className="h-1 w-6 rounded-full bg-white/40" />
          </span>
        </span>
        <Link href="/" className="font-semibold text-white/80">
          Skip
        </Link>
      </header>

      <div className="space-y-2">
        <h1 className="text-3xl leading-tight font-extrabold tracking-tight">
          Connect your receipts.
          <span className="block text-sage">No typing, ever.</span>
        </h1>
        <p className="text-white/75">
          Link your Nexi Smart Receipt app once. Every receipt from a card purchase then flows in by itself.
        </p>
      </div>

      <Coach
        mood={connected ? "cheer" : "think"}
        message={connected ? "We're connected! New receipts will show up on their own." : "I only read receipts. I never see your card number or your bank account."}
        className="text-foreground"
      />

      <section className="space-y-4 rounded-[20px] bg-card p-5 text-card-foreground">
        <h2 className="flex items-center gap-2 font-bold">
          <ShieldCheck className="size-5 text-mid-green" /> What FamilyBudget can see
        </h2>
        <ul className="space-y-2 text-sm">
          {SHARED.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <Check className="size-4 text-mid-green" /> {s}
            </li>
          ))}
        </ul>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Never shared</p>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {NOT_SHARED.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <X className="size-4" /> {s}
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-auto space-y-2">
        {connected ? (
          <Link href="/receipts" className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white font-bold text-forest">
            <Check className="size-5" /> Connected · see receipts
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-white font-bold text-forest active:translate-y-px"
          >
            <NMark className="size-7 text-sm" /> Connect with Nexi <ArrowRight className="size-5" />
          </button>
        )}
        <p className="text-center text-xs text-white/60">Demo: the Nexi connection is simulated.</p>
      </div>

      <Sheet open={open} onOpenChange={(o) => step < 0 && setOpen(o)}>
        <SheetContent side="bottom" showCloseButton={step < 0} className="rounded-t-[24px] px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader className="px-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <NMark /> Nexi Smart Receipt
            </div>
            <SheetTitle className="text-xl font-extrabold">Allow FamilyBudget to read your receipts?</SheetTitle>
            <SheetDescription>FamilyBudget will get read-only access to receipts from shops in the Nexi network.</SheetDescription>
          </SheetHeader>

          {step < 0 ? (
            <>
              <ul className="space-y-2 text-sm">
                {SHARED.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <Check className="size-4 text-mid-green" /> {s}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">You can revoke access at any time in the Nexi Smart Receipt app.</p>
              <div className="grid gap-2">
                <button type="button" onClick={allow} className="h-12 rounded-full bg-forest font-bold text-white active:translate-y-px">
                  Allow
                </button>
                <button type="button" onClick={() => setOpen(false)} className="h-12 rounded-full font-semibold text-muted-foreground">
                  Not now
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-3 py-2" aria-live="polite">
              <p className="flex items-center gap-2 font-semibold">
                {step < 2 ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-mid-green" />}
                {step === 2 ? `All set! ${count} receipts imported.` : STEPS[step]}
              </p>
              <Progress value={[15, 60, 100][step]} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
