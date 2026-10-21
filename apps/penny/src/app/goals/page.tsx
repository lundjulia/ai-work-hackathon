"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, RotateCcw, Sparkles } from "lucide-react";
import { Coach } from "@/components/avatar/coach";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useApp } from "@/lib/store";
import { CATEGORIES, kr, riskText, suggestBudgets } from "@/lib/advisor";
import type { Category, RiskTolerance } from "@/lib/types";
import { cn } from "@/lib/utils";

const EMOJIS = [
  { emoji: "🏖️", label: "Trip" },
  { emoji: "🏠", label: "Home" },
  { emoji: "📈", label: "Investing" },
  { emoji: "🎯", label: "Other" },
];
const MONTHLY = [800, 1200, 1600];
const PLEDGE_EXAMPLES = ["Not spending money on coffee", "No candy this week!", "Cook at home on Fridays"];
const CAT_LABEL: Record<Category, string> = {
  food: "Food & groceries", transport: "Transport", home: "Home & bills", kids: "Kids", leisure: "Fun & leisure", other: "Other",
};

const card = "rounded-[20px] bg-white p-5";
const muted = "text-[#6B746E]";

function Bar({ value, max, color = "bg-[#1F4A39]", label }: { value: number; max: number; color?: string; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2.5 rounded-full bg-[#DCEBDD]">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Month the goal is reached if `monthly` is set aside starting this month. */
function readyBy(left: number, monthly: number, now = new Date()) {
  if (left <= 0) return "Done!";
  if (monthly <= 0) return "Set a monthly amount";
  const d = new Date(now.getFullYear(), now.getMonth() + Math.ceil(left / monthly) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const num = (v: string) => Math.max(0, Number(v) || 0);

export default function GoalsPage() {
  const { goal, investing, profile, pledges, receipts, setGoal, setProfile, addPledge, togglePledge, resetDemo } = useApp();
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState(!MONTHLY.includes(goal.monthly));
  const [preview, setPreview] = useState<Record<Category, number> | null>(null);
  const [pledgeText, setPledgeText] = useState("");
  const [alerts, setAlerts] = useState({ weekly: true, monthly: true });

  const left = Math.max(0, goal.target - goal.saved);
  const pct = goal.target > 0 ? Math.round((goal.saved / goal.target) * 100) : 0;
  const when = readyBy(left, goal.monthly);
  const what = /trip|rejse|ferie|holiday/i.test(goal.name) ? "the trip" : "your goal";

  function newPledge(text: string) {
    const t = text.trim().slice(0, 80);
    if (!t) return;
    addPledge(t);
    setPledgeText("");
    toast.success("Pledge added. Penny is cheering for you! 💛");
  }

  return (
    <div className="min-h-full space-y-4 bg-[#F2F2EE] px-4 pt-6 pb-6 text-[#14231C]">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Our goals</h1>
        <p className={cn("text-sm", muted)}>Saving for what matters</p>
      </header>

      {/* Goal */}
      <section className={card}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold">
            {goal.emoji} {goal.name}
          </h2>
          <div className="flex items-center gap-1">
            {goal.monthly > 0 && (
              <span className="rounded-full bg-[#DCEBDD] px-2.5 py-0.5 text-xs font-semibold text-[#1F4A39]">On track</span>
            )}
            <Button size="icon-sm" variant="ghost" aria-label="Edit goal" onClick={() => setEditing(!editing)}>
              <Pencil />
            </Button>
          </div>
        </div>
        <p className="mt-3">
          <span className="text-3xl font-bold tracking-tight">{kr(goal.saved)}</span>{" "}
          <span className={cn("text-sm", muted)}>of {kr(goal.target)}</span>
        </p>
        <div className="mt-3">
          <Bar value={goal.saved} max={goal.target} label="Goal progress" />
        </div>
        <div className={cn("mt-2 flex justify-between text-xs", muted)}>
          <span>{pct}% saved</span>
          <span>Ready by {when}</span>
        </div>

        {editing && (
          <div className="mt-4 space-y-3 border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {EMOJIS.map((e) => (
                <button
                  key={e.emoji}
                  onClick={() => setGoal({ emoji: e.emoji })}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm",
                    goal.emoji === e.emoji ? "bg-[#1F4A39] text-white" : "bg-[#F2F2EE]",
                  )}
                >
                  {e.emoji} {e.label}
                </button>
              ))}
            </div>
            <div className="space-y-1">
              <Label htmlFor="g-name">Goal name</Label>
              <Input id="g-name" value={goal.name} maxLength={60} onChange={(e) => setGoal({ name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="g-target">Target (kr)</Label>
                <Input id="g-target" type="number" inputMode="numeric" value={goal.target} onChange={(e) => setGoal({ target: num(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="g-saved">Saved so far (kr)</Label>
                <Input id="g-saved" type="number" inputMode="numeric" value={goal.saved} onChange={(e) => setGoal({ saved: num(e.target.value) })} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Monthly amount */}
      <section className={card}>
        <h2 className="font-semibold">How much can we set aside each month?</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {MONTHLY.map((m) => (
            <button
              key={m}
              onClick={() => {
                setCustom(false);
                setGoal({ monthly: m });
              }}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold",
                !custom && goal.monthly === m ? "bg-[#1F4A39] text-white" : "bg-[#F2F2EE]",
              )}
            >
              {kr(m)}
            </button>
          ))}
          <button
            onClick={() => setCustom(true)}
            className={cn("rounded-full px-4 py-2 text-sm font-semibold", custom ? "bg-[#1F4A39] text-white" : "bg-[#F2F2EE]")}
          >
            Custom
          </button>
        </div>
        {custom && (
          <Input
            className="mt-3"
            type="number"
            inputMode="numeric"
            aria-label="Custom monthly amount (kr)"
            value={goal.monthly}
            onChange={(e) => setGoal({ monthly: num(e.target.value) })}
          />
        )}
        <p className={cn("mt-3 text-sm", muted)}>
          {goal.monthly > 0 ? `At ${kr(goal.monthly)} a month, ${what} is paid for by ${when}.` : "Pick an amount to see when you'll get there."}
        </p>
      </section>

      {/* Investing (read-only) */}
      <section className={card}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Start investing</h2>
          <span className={cn("text-sm", muted)}>
            {kr(investing.saved)} / {kr(investing.target)}
          </span>
        </div>
        <div className="mt-3">
          <Bar value={investing.saved} max={investing.target} color="bg-[#4F8A63]" label="Investing pot" />
        </div>
      </section>

      {/* Penny */}
      <section className="flex items-center gap-3 rounded-[20px] bg-[#1F4A39] p-4 text-white">
        <Coach size="sm" mood="cheer" />
        <div className="text-sm">
          <p className="font-semibold">{left > 0 ? `${kr(left)} to go. You've got this!` : "Goal reached! 🎉"}</p>
          <p className="mt-0.5 text-[#A8D5AF]">You decide what happens with your savings, including investing.</p>
        </div>
      </section>

      {/* Family settings */}
      <details className={cn(card, "group")}>
        <summary className="cursor-pointer list-none font-semibold">
          Family settings <span className={cn("text-sm font-normal", muted)}>· income, safety net, budgets, pledges</span>
        </summary>

        <div className="mt-4 space-y-6">
          {/* Income + risk */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="income">Monthly income after tax (kr)</Label>
              <Input id="income" type="number" inputMode="numeric" value={profile.income} onChange={(e) => setProfile({ income: num(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Risk tolerance</Label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as RiskTolerance[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setProfile({ riskTolerance: r })}
                    className={cn(
                      "flex-1 rounded-full py-2 text-sm font-semibold capitalize",
                      profile.riskTolerance === r ? "bg-[#1F4A39] text-white" : "bg-[#F2F2EE]",
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <p className={cn("text-sm", muted)}>
                {profile.riskTolerance[0].toUpperCase() + profile.riskTolerance.slice(1)} means {riskText(profile.riskTolerance)}{" "}
                <strong className="text-[#14231C]">We don&apos;t pick investments for you.</strong>
              </p>
            </div>
          </div>

          {/* Safety net */}
          <div className="space-y-3">
            <h3 className="font-semibold">Safety net</h3>
            <p className={cn("text-sm", muted)}>Money for surprises like a broken washing machine. Build this first.</p>
            <p>
              <span className="text-2xl font-bold">{kr(profile.safetyNetCurrent)}</span>{" "}
              <span className={cn("text-sm", muted)}>of {kr(profile.safetyNetTarget)}</span>
            </p>
            <Bar value={profile.safetyNetCurrent} max={profile.safetyNetTarget} color="bg-[#4F8A63]" label="Safety net" />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sn-cur">Saved (kr)</Label>
                <Input id="sn-cur" type="number" inputMode="numeric" value={profile.safetyNetCurrent} onChange={(e) => setProfile({ safetyNetCurrent: num(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sn-target">Target (kr)</Label>
                <Input id="sn-target" type="number" inputMode="numeric" value={profile.safetyNetTarget} onChange={(e) => setProfile({ safetyNetTarget: num(e.target.value) })} />
              </div>
            </div>
          </div>

          {/* Budgets */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Monthly budgets</h3>
              <Button
                size="sm"
                className="rounded-full bg-[#1F4A39] text-white"
                onClick={() => setPreview(suggestBudgets(receipts, profile, goal))}
              >
                <Sparkles /> Auto budget
              </Button>
            </div>
            {preview && (
              <div className="space-y-2 rounded-2xl bg-[#DCEBDD] p-3 text-sm">
                <p className="font-semibold text-[#1F4A39]">Penny suggests (from your receipts + income):</p>
                {CATEGORIES.map((c) => (
                  <div key={c} className="flex justify-between">
                    <span>{CAT_LABEL[c]}</span>
                    <span>
                      <span className={muted}>{kr(profile.budgets[c])} → </span>
                      <strong>{kr(preview[c])}</strong>
                    </span>
                  </div>
                ))}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="rounded-full bg-[#1F4A39] text-white"
                    onClick={() => {
                      setProfile({ budgets: preview });
                      setPreview(null);
                      toast.success("New budgets saved");
                    }}
                  >
                    Use these
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                    Keep mine
                  </Button>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((c) => (
                <div key={c} className="space-y-1">
                  <Label htmlFor={`b-${c}`}>{CAT_LABEL[c]}</Label>
                  <Input
                    id={`b-${c}`}
                    type="number"
                    inputMode="numeric"
                    value={profile.budgets[c]}
                    onChange={(e) => setProfile({ budgets: { ...profile.budgets, [c]: num(e.target.value) } })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Pledges */}
          <div className="space-y-3">
            <h3 className="font-semibold">Family pledges</h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                newPledge(pledgeText);
              }}
            >
              <Input value={pledgeText} maxLength={80} placeholder="No takeaway this week" aria-label="New pledge" onChange={(e) => setPledgeText(e.target.value)} />
              <Button type="submit" size="icon" aria-label="Add pledge" className="rounded-full bg-[#1F4A39] text-white">
                <Plus />
              </Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {PLEDGE_EXAMPLES.filter((x) => !pledges.some((p) => p.text === x)).map((x) => (
                <button key={x} onClick={() => newPledge(x)} className="rounded-full bg-[#F2F2EE] px-3 py-1.5 text-xs">
                  + {x}
                </button>
              ))}
            </div>
            {pledges.map((p) => (
              <label key={p.id} className="flex items-center justify-between gap-3 text-sm">
                <span className={cn(!p.active && "text-[#6B746E] line-through")}>{p.text}</span>
                <Switch checked={p.active} onCheckedChange={() => togglePledge(p.id)} />
              </label>
            ))}
          </div>

          {/* Alerts (local UI state for the demo) */}
          <div className="space-y-3">
            <h3 className="font-semibold">Smart alerts</h3>
            <label className="flex items-center justify-between text-sm">
              Weekly budget check-in
              <Switch checked={alerts.weekly} onCheckedChange={(v) => setAlerts({ ...alerts, weekly: v })} />
            </label>
            <label className="flex items-center justify-between text-sm">
              Monthly budget summary
              <Switch checked={alerts.monthly} onCheckedChange={(v) => setAlerts({ ...alerts, monthly: v })} />
            </label>
          </div>

          <Button
            variant="outline"
            className="w-full rounded-full"
            onClick={() => {
              resetDemo();
              setPreview(null);
              setCustom(false);
              toast("Demo reset");
            }}
          >
            <RotateCcw /> Reset demo
          </Button>
        </div>
      </details>
    </div>
  );
}
