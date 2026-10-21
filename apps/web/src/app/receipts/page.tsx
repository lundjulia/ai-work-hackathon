"use client";

import { useState } from "react";
import { Braces, ChevronDown, Loader2, Plus, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CATEGORY_LABEL, kr } from "@/lib/coach";
import { useSimulateReceipt } from "@/lib/nexi/simulate";
import { useApp } from "@/lib/store";
import type { Category, Receipt } from "@/lib/types";
import { cn } from "@/lib/utils";

const FILTERS: (Category | "all")[] = ["all", "food", "transport", "home", "kids", "leisure", "other"];

function dayKey(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const shop = (r: Receipt) => (r.chain === "Other" ? r.merchant : r.chain);

function ReceiptItem({ r }: { r: Receipt }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          aria-hidden
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full text-sm font-bold",
            r.category === "food" ? "bg-pale-green text-forest" : "bg-mustard/40 text-foreground",
          )}
        >
          {shop(r)[0]}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{shop(r)}</span>
          <span className="block text-xs text-muted-foreground">
            {CATEGORY_LABEL[r.category]} · {time(r.date)}
          </span>
        </span>
        <span className="font-bold tabular-nums">-{kr(r.total)}</span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-3 px-4 pb-4">
          <p className="text-xs text-muted-foreground">{r.merchant}</p>
          {r.aiNote && (
            <p className="flex gap-2 rounded-xl bg-pale-green px-3 py-2 text-sm text-forest">
              <Sparkles className="mt-0.5 size-4 shrink-0" /> <span><b>Penny:</b> {r.aiNote}</span>
            </p>
          )}
          <table className="w-full text-sm">
            <tbody>
              {r.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <td className="py-1 pr-2">
                    {l.qty > 1 && <span className="text-muted-foreground">{l.qty}× </span>}
                    {l.name}
                    {l.category && l.category !== r.category && (
                      <span className="ml-1 rounded-full bg-mustard/40 px-1.5 text-[10px] font-semibold">{CATEGORY_LABEL[l.category]}</span>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-right text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                    {l.kgPerUnit ? `${kr(l.price / (l.qty * l.kgPerUnit))}/kg` : ""}
                  </td>
                  <td className="py-1 text-right whitespace-nowrap tabular-nums">{l.price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </li>
  );
}

export default function ReceiptsPage() {
  const receipts = useApp((s) => s.receipts);
  const connected = useApp((s) => s.nexiConnected);
  const { simulate, busy } = useSimulateReceipt();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [raw, setRaw] = useState(false);

  const shown = receipts
    .filter((r) => filter === "all" || r.category === filter)
    .toSorted((a, b) => b.date.localeCompare(a.date));
  const groups = new Map<string, Receipt[]>(); // not Map.groupBy: needs iOS 17.4+
  for (const r of shown) groups.set(dayKey(r.date), [...(groups.get(dayKey(r.date)) ?? []), r]);

  return (
    <main className="flex flex-col gap-4 px-4 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-28">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Receipts</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex size-2.5" aria-hidden>
              {connected && <span className="absolute inline-flex size-full animate-ping rounded-full bg-mid-green opacity-60 motion-reduce:hidden" />}
              <span className={cn("relative inline-flex size-2.5 rounded-full", connected ? "bg-mid-green" : "bg-muted-foreground")} />
            </span>
            {connected ? "Live from Nexi Smart Receipt" : "Nexi not connected (demo data)"}
          </p>
        </div>
        <button
          type="button"
          onClick={simulate}
          disabled={busy}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Simulate receipt
        </button>
      </header>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "h-8 shrink-0 rounded-full px-3 text-sm font-semibold",
              filter === f ? "bg-forest text-white" : "bg-card text-foreground",
            )}
          >
            {f === "all" ? "All" : CATEGORY_LABEL[f]}
          </button>
        ))}
      </div>

      <label className="flex items-center justify-between rounded-[20px] bg-card px-4 py-3 text-sm font-semibold">
        <span className="flex items-center gap-2">
          <Braces className="size-4" /> Raw JSON from the app
        </span>
        <Switch checked={raw} onCheckedChange={setRaw} />
      </label>

      {raw ? (
        <pre className="max-h-[70dvh] overflow-auto rounded-[20px] bg-[#14231C] p-4 text-[11px] leading-relaxed text-sage">
          {JSON.stringify(shown, null, 2)}
        </pre>
      ) : (
        [...groups].map(([day, rs]) => (
          <section key={day} className="space-y-2">
            <h2 className="flex justify-between px-1 text-sm font-bold">
              {day}
              <span className="font-normal text-muted-foreground tabular-nums">-{kr(rs.reduce((s, r) => s + r.total, 0))}</span>
            </h2>
            <ul className="divide-y divide-border/60 rounded-[20px] bg-card">
              {rs.map((r) => (
                <ReceiptItem key={r.id} r={r} />
              ))}
            </ul>
          </section>
        ))
      )}
      {!raw && shown.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No receipts in this category yet.</p>}
    </main>
  );
}
