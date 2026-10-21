"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Search, Sparkles } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Coach } from "@/components/avatar/coach";
import { useApp } from "@/lib/store";
import type { Offer, Receipt } from "@/lib/types";
import snapshot from "@/data/offers.json";
import { basketByChain, basketLines, cheapestByKg, offersFor, rankMeals, type CostedMeal } from "@/lib/offers";
import { INGREDIENTS, RECIPES } from "@/lib/offers/meals";
import { cn } from "@/lib/utils";

const kr = (n: number, d = 0) => `${n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })} kr`;
const perKg = (n: number) => `${kr(n, n < 100 ? 2 : 0)}/kg`;
const weight = (kg: number) => (kg < 1 ? `${Math.round(kg * 1000)} g` : `${kg.toLocaleString("en-US")} kg`);

const CARD = "rounded-[20px] bg-white p-4";
const CHIP = "inline-flex items-center rounded-full bg-[#DCEBDD] px-2.5 py-0.5 text-xs font-semibold text-[#1F4A39]";
const MUTED = "text-[#6B746E]";

export default function MealsPage() {
  const [offers, setOffers] = useState<Offer[]>(snapshot as Offer[]);
  const [source, setSource] = useState<"live" | "snapshot">("snapshot");

  useEffect(() => {
    fetch("/api/offers")
      .then((r) => r.json())
      .then((d: { source: "live" | "snapshot"; offers: Offer[] }) => {
        if (d.offers?.length) {
          setOffers(d.offers);
          setSource(d.source);
        }
      })
      .catch(() => {}); // keep the bundled snapshot
  }, []);

  const meals = useMemo(() => rankMeals(RECIPES, offers, INGREDIENTS), [offers]);

  return (
    <main className="flex min-h-full flex-col gap-4 bg-[#F2F2EE] px-4 pt-5 pb-6 text-[#14231C]">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Meals this week</h1>
        <p className={cn("text-sm", MUTED)}>
          Tilbudsaviser from Netto, Bilka, Føtex, Rema 1000 & Lidl, compared by kr/kg.{" "}
          <span className={CHIP}>{source === "live" ? "Live offers" : "Offer snapshot"}</span>
        </p>
      </header>

      <Tabs defaultValue="meals" className="gap-4">
        <TabsList className="h-10 w-full rounded-full bg-white p-1">
          <TabsTrigger value="meals" className="rounded-full data-active:bg-[#DCEBDD] data-active:text-[#1F4A39]">Cheapest meals</TabsTrigger>
          <TabsTrigger value="compare" className="rounded-full data-active:bg-[#DCEBDD] data-active:text-[#1F4A39]">Compare</TabsTrigger>
          <TabsTrigger value="saved" className="rounded-full data-active:bg-[#DCEBDD] data-active:text-[#1F4A39]">Did we save?</TabsTrigger>
        </TabsList>
        <TabsContent value="meals"><MealsTab meals={meals} /></TabsContent>
        <TabsContent value="compare"><CompareTab offers={offers} /></TabsContent>
        <TabsContent value="saved"><SavedTab offers={offers} /></TabsContent>
      </Tabs>
    </main>
  );
}

/* ---------- Cheapest meals ---------- */

function MealsTab({ meals }: { meals: CostedMeal[] }) {
  const foodBudget = useApp((s) => s.profile.budgets.food);
  const [planned, setPlanned] = useState(false);
  const week = meals.slice(0, 5);
  const weekCost = week.reduce((s, m) => s + m.cost, 0);
  const weeklyBudget = (foodBudget * 12) / 52;

  return (
    <div className="flex flex-col gap-3">
      {planned ? (
        <section className="rounded-[20px] bg-[#1F4A39] p-4 text-white">
          <p className="text-sm text-[#A8D5AF]">5 dinners planned this week</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {kr(weekCost)} <span className="text-base font-medium text-white/70">of {kr(weeklyBudget)} weekly food budget</span>
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-[#A8D5AF]" style={{ width: `${Math.min(100, (weekCost / weeklyBudget) * 100)}%` }} />
          </div>
          <ol className="mt-3 space-y-1 text-sm">
            {week.map((m, i) => (
              <li key={m.recipe.id} className="flex justify-between gap-2">
                <span>{["Mon", "Tue", "Wed", "Thu", "Fri"][i]} · {m.recipe.emoji} {m.recipe.name}</span>
                <span className="font-semibold tabular-nums">{kr(m.cost)}</span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-white/80">
            Dinners use {Math.round((weekCost / weeklyBudget) * 100)}% of the weekly food budget, leaving {kr(weeklyBudget - weekCost)} for breakfast, lunch and the rest.
          </p>
        </section>
      ) : (
        <button
          onClick={() => setPlanned(true)}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#1F4A39] font-bold text-white active:scale-[0.99]"
        >
          <Sparkles className="size-4" /> Plan this week
        </button>
      )}

      {meals.map((m) => (
        <MealCard key={m.recipe.id} m={m} />
      ))}
      <p className={cn("px-1 text-xs", MUTED)}>Cost = amount needed × cheapest kr/kg on offer. Items not on offer use a normal shelf price. 4 servings.</p>
    </div>
  );
}

function MealCard({ m }: { m: CostedMeal }) {
  return (
    <details className={cn(CARD, "group")}>
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span className="text-3xl" aria-hidden>{m.recipe.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="font-bold leading-tight">{m.recipe.name}</p>
          <p className="mt-0.5 text-2xl font-extrabold tabular-nums">
            {kr(m.perServing, 1)} <span className={cn("text-sm font-medium", MUTED)}>per serving · {kr(m.cost)} total</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.chains.map((c) => (
              <span key={c} className={CHIP}>{c}</span>
            ))}
            {m.savings >= 1 && <span className="rounded-full bg-[#F2C24B]/30 px-2.5 py-0.5 text-xs font-semibold">Save {kr(m.savings)} vs average</span>}
          </div>
        </div>
        <ChevronDown className={cn("mt-1 size-5 shrink-0 transition-transform group-open:rotate-180", MUTED)} aria-hidden />
      </summary>
      <ul className="mt-3 divide-y divide-[#DADAD5] text-sm">
        {m.items.map((i) => (
          <li key={i.ingredient.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="font-semibold">{i.ingredient.label} <span className={cn("font-normal", MUTED)}>· {weight(i.kg)}</span></p>
              <p className={cn("truncate text-xs", MUTED)}>
                {i.offer ? `${i.offer.chain} · ${i.offer.product}` : "Not on offer · normal price"}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-bold tabular-nums">{kr(i.cost, 2)}</p>
              <p className={cn("text-xs tabular-nums", MUTED)}>{perKg(i.pricePerKg)}</p>
            </div>
          </li>
        ))}
      </ul>
    </details>
  );
}

/* ---------- Compare chains ---------- */

function CompareTab({ offers }: { offers: Offer[] }) {
  const [q, setQ] = useState("Hakket oksekød");
  const term = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (!term) return [];
    const ids = INGREDIENTS.filter((i) => i.label.toLowerCase().includes(term)).map((i) => i.id);
    return offers
      .filter((o) => o.product.toLowerCase().includes(term) || ids.includes(o.category ?? ""))
      .sort((a, b) => a.pricePerKg - b.pricePerKg);
  }, [offers, term]);
  const bestKg = results[0];
  const bestPack = results.reduce<Offer | undefined>((a, b) => (!a || b.price < a.price ? b : a), undefined);
  const misleads = bestKg && bestPack && bestPack !== bestKg && bestPack.pricePerKg > bestKg.pricePerKg;

  return (
    <div className="flex flex-col gap-3">
      <label className="relative block">
        <span className="sr-only">Search an ingredient</span>
        <Search className={cn("absolute top-1/2 left-3.5 size-4 -translate-y-1/2", MUTED)} aria-hidden />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search an ingredient…" className="h-11 rounded-full border-0 bg-white pl-10" />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {INGREDIENTS.filter((i) => offersFor(offers, i.id).length).map((i) => (
          <button key={i.id} onClick={() => setQ(i.label)} className={cn(CHIP, "py-1", q === i.label && "bg-[#1F4A39] text-white")}>
            {i.label}
          </button>
        ))}
      </div>

      {misleads && (
        <section className="rounded-[20px] bg-[#1F4A39] p-4 text-white">
          <p className="font-bold">Cheapest pack ≠ cheapest food</p>
          <p className="mt-1 text-sm text-white/80">
            {bestPack.chain}&apos;s pack looks cheapest at {kr(bestPack.price, 2)}, but it&apos;s {perKg(bestPack.pricePerKg)}.{" "}
            {bestKg.chain} is {perKg(bestKg.pricePerKg)}, {Math.round((1 - bestKg.pricePerKg / bestPack.pricePerKg) * 100)}% less per kg.
          </p>
        </section>
      )}

      {term && !results.length && <p className={cn(CARD, "text-sm", MUTED)}>No offers for “{q}” this week.</p>}
      <ul className="flex flex-col gap-2">
        {results.map((o, idx) => (
          <li key={`${o.chain}-${o.product}-${o.price}-${idx}`} className={cn(CARD, "flex items-center gap-3", o === bestKg && "ring-2 ring-[#1F4A39]")}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={CHIP}>{o.chain}</span>
                {o === bestKg && <span className="rounded-full bg-[#1F4A39] px-2.5 py-0.5 text-xs font-semibold text-white">Cheapest per kg</span>}
                {misleads && o === bestPack && <span className="rounded-full bg-[#F2C24B]/40 px-2.5 py-0.5 text-xs font-semibold">Lowest pack price</span>}
              </div>
              <p className="mt-1 truncate text-sm font-semibold">{o.product}</p>
              <p className={cn("text-xs", MUTED)}>
                {kr(o.price, 2)} for {weight(o.kg)} · until {new Date(o.validTo).toLocaleDateString("da-DK", { day: "numeric", month: "short" })}
              </p>
            </div>
            <p className="shrink-0 text-right text-xl font-extrabold tabular-nums">
              {kr(o.pricePerKg, o.pricePerKg < 100 ? 2 : 0)}
              <span className={cn("block text-xs font-medium", MUTED)}>per kg</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Did we save? ---------- */

function recentReceipts(receipts: Receipt[]): Receipt[] {
  // shortcut: "this week" = last 7 days, falling back to the latest receipt so the demo always has data
  const cutoff = Date.now() - 7 * 864e5;
  const week = receipts.filter((r) => new Date(r.date).getTime() >= cutoff);
  return week.length ? week : receipts.slice(0, 1);
}

function SavedTab({ offers }: { offers: Offer[] }) {
  const receipts = useApp((s) => s.receipts);
  const lines = useMemo(() => basketLines(recentReceipts(receipts), INGREDIENTS), [receipts]);
  const b = useMemo(() => basketByChain(lines, offers), [lines, offers]);

  if (!lines.length)
    return (
      <div className={CARD}>
        <Coach mood="think" size="sm" message="No grocery lines with weights yet. Connect Nexi and your next receipt shows up here." />
      </div>
    );

  const shops = [...new Set(lines.map((l) => l.chain))].join(" & ");
  const best = b.chains[0];
  const saved = b.avg - b.paid;
  const couldSave = b.paid - best.total;
  const headline =
    saved >= 1 ? `You saved ${kr(saved)} shopping at ${shops} this week!` : `${shops} cost ${kr(-saved)} more than the average chain this week.`;
  const tip =
    couldSave >= 1
      ? `Same basket at ${best.chain} would have been ${kr(couldSave)} cheaper with this week's offers.`
      : `Nobody beats what you paid. ${shops} was the right call.`;

  return (
    <div className="flex flex-col gap-3">
      <section className="flex items-center gap-3 rounded-[20px] bg-[#1F4A39] p-4 text-white">
        <Coach mood={saved >= 1 ? "cheer" : "comfort"} size="sm" />
        <div>
          <p className="font-bold">{headline}</p>
          <p className="mt-1 text-sm text-white/80">{tip}</p>
        </div>
      </section>

      <section className={CARD}>
        <p className="font-bold">Your basket</p>
        <p className={cn("text-xs", MUTED)}>Receipt lines we could match, by kr/kg</p>
        <ul className="mt-2 divide-y divide-[#DADAD5] text-sm">
          {lines.map((l, i) => {
            const o = cheapestByKg(offersFor(offers, l.ingredient.id));
            return (
              <li key={i} className="flex items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className={cn("text-xs", MUTED)}>{l.chain} · {weight(l.kg)} · {perKg(l.paid / l.kg)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-bold tabular-nums">{kr(l.paid, 2)}</p>
                  {o && <p className={cn("text-xs", MUTED)}>best: {o.chain} {perKg(o.pricePerKg)}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={CARD}>
        <p className="font-bold">Same basket at each chain</p>
        <ul className="mt-2 space-y-2 text-sm">
          <li className="flex justify-between font-semibold"><span>You paid</span><span className="tabular-nums">{kr(b.paid, 2)}</span></li>
          {b.chains.map((c) => (
            <li key={c.chain} className="flex items-center justify-between">
              <span className={c === best ? CHIP : ""}>{c.chain}</span>
              <span className={cn("tabular-nums", c.total < b.paid ? "font-semibold text-[#1F4A39]" : MUTED)}>{kr(c.total, 2)}</span>
            </li>
          ))}
        </ul>
        <p className={cn("mt-2 text-xs", MUTED)}>Uses each chain&apos;s best offer kr/kg; items a chain has no offer on keep the price you paid.</p>
      </section>
    </div>
  );
}
