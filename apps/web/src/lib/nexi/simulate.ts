"use client";
// The demo flow: receipt arrives (fake Nexi webhook) → AI categorizes → budget updates → Penny cheers + tip → goal moves.
import { useCallback, useState } from "react";
import { toast } from "sonner";
import type { Receipt } from "@/lib/types";
import { foodThisWeek, spentThisMonth, useApp } from "@/lib/store";
import { kr, reactToReceipt } from "@/lib/coach";
import { nextIncoming } from "./client";
import { categorizeByRules, type Categorized } from "./categorize";

export function useSimulateReceipt(): { simulate: () => Promise<void>; busy: boolean } {
  const [busy, setBusy] = useState(false);

  const simulate = useCallback(async () => {
    setBusy(true);
    try {
      const raw = nextIncoming(useApp.getState().receipts);
      const shop = raw.chain === "Other" ? raw.merchant : raw.chain;
      toast(`New receipt from Nexi · ${shop} ${kr(raw.total)}`, { description: "Penny is sorting it…" });

      let ai: Categorized;
      try {
        const res = await fetch("/api/categorize", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(raw),
        });
        if (!res.ok) throw new Error(String(res.status));
        ai = await res.json();
      } catch {
        ai = categorizeByRules(raw); // offline / server down: the demo still works
      }

      const receipt: Receipt = {
        ...raw,
        lines: raw.lines.map((l, i) => ({ ...l, category: ai.lineCategories[i] ?? ai.category })),
        category: ai.category,
        aiNote: ai.aiNote,
      };
      const { addReceipt, addNotification, setGoal } = useApp.getState();
      addReceipt(receipt);

      const s = useApp.getState();
      const reaction = reactToReceipt(receipt, {
        receipts: s.receipts,
        budgets: s.profile.budgets,
        monthSpent: spentThisMonth(s.receipts),
        week: foodThisWeek(s.receipts, s.profile.budgets.food),
        goal: s.goal,
        pledges: s.pledges,
      });

      addNotification({ kind: "receipt", title: `${shop} · -${kr(receipt.total)}`, body: receipt.aiNote ?? "New receipt from Nexi." });
      addNotification({ kind: reaction.kind, title: reaction.title, body: reaction.body });
      addNotification({ kind: "tip", title: "Penny's tip", body: reaction.tip });
      if (reaction.goalBoost) setGoal({ saved: Math.min(s.goal.target, s.goal.saved + reaction.goalBoost) });

      const show = reaction.kind === "win" ? toast.success : toast;
      show(reaction.title, {
        description: reaction.goalBoost ? `+${kr(reaction.goalBoost)} toward ${s.goal.name}. ${reaction.tip}` : reaction.tip,
        duration: 6000,
      });
    } finally {
      setBusy(false);
    }
  }, []);

  return { simulate, busy };
}
