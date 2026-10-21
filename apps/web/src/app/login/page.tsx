"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Coach, CoachName } from "@/components/avatar/coach";
import { useApp } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const signIn = useApp((s) => s.signIn);

  function go(skip = false) {
    signIn();
    router.replace(skip && useApp.getState().nexiConnected ? "/" : "/connect");
  }

  return (
    // fixed: covers the layout's nav padding so the forest bg is edge to edge
    <main className="fixed inset-0 mx-auto flex max-w-[480px] flex-col overflow-y-auto bg-forest px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-white">
      <div className="flex items-center gap-3 text-xs font-semibold text-white/70">
        <span>01 / 03</span>
        <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
          <span className="h-1 w-8 rounded-full bg-white" />
          <span className="h-1 w-8 rounded-full bg-white/25" />
          <span className="h-1 w-8 rounded-full bg-white/25" />
        </div>
        <button onClick={() => go(true)} className="hover:text-white">
          Skip
        </button>
      </div>

      <h1 className="mt-10 text-4xl leading-tight font-extrabold tracking-tight">
        Calmer money days.
        <br />
        <span className="text-sage">For the whole family.</span>
      </h1>
      <p className="mt-4 text-white/75">
        Receipts arrive on their own. We turn them into a clear weekly budget and a goal worth saving for.
      </p>

      <div className="flex flex-1 items-center justify-center py-8">
        <Coach size="lg" message={`Hi, I'm ${CoachName}. I'm an AI, and I'm on your side.`} />
      </div>

      <button
        onClick={() => go()}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-base font-bold text-forest transition active:scale-[0.98]"
      >
        Get started <ArrowRight className="size-5" />
      </button>
      <p className="mt-3 text-center text-xs text-white/60">Connects securely to your Nexi Smart Receipt app</p>
    </main>
  );
}
