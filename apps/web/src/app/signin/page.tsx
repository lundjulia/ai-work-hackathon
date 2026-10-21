import { Button } from "@claude-impact-lab/ui/components/button";
import { ArrowRight, BellRing, Landmark, ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand";

import { signInAsDemoUser } from "./actions";

const promises = [
  { icon: Landmark, text: "All your banks and investments in one place" },
  { icon: BellRing, text: "Checked every day. We only ping you when it matters" },
  { icon: ShieldCheck, text: "Nothing moves without your approval" },
];

export default function SignInPage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden px-6 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
      />
      <Wordmark className="relative" />

      <div className="relative flex flex-1 flex-col justify-center gap-10 py-10">
        <div className="animate-in space-y-4 duration-700 fill-mode-both fade-in slide-in-from-bottom-4">
          <h1 className="text-[2.6rem] leading-[1.05] font-semibold tracking-tight">
            Money on
            <br />
            autopilot.
          </h1>
          <p className="max-w-[19rem] text-base text-muted-foreground">
            Connect your banks once. An agent looks after your money every day, so you can go live
            your life.
          </p>
        </div>

        {/* A glimpse of what the app sends you. */}
        <div className="animate-in delay-200 duration-700 fill-mode-both fade-in slide-in-from-bottom-6">
          <div className="rounded-3xl bg-card/90 p-4 shadow-xl ring-1 shadow-black/5 ring-foreground/5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" />
              Autopilot · now
            </div>
            <p className="mt-2 text-sm font-medium">Move DKK 3,000 to your safety net?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Payday is in 9 days and your bills are covered.
            </p>
          </div>
        </div>

        <ul className="animate-in space-y-3 delay-300 duration-700 fill-mode-both fade-in">
          {promises.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3 text-sm">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <Icon className="size-4" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <form action={signInAsDemoUser} className="relative space-y-3">
        <Button type="submit" size="lg" className="h-13 w-full text-base">
          Continue as demo user
          <ArrowRight data-icon="inline-end" />
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Demo sign-in, no real account. You continue as Sofie, a fictional persona with
          synthetic data.
        </p>
      </form>
    </main>
  );
}
