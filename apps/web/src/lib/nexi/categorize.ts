// Deterministic categorization: the no-API-key path and the fallback when Claude errors.
import type { Category, Chain } from "@/lib/types";
import { CATEGORY_LABEL, TAKEAWAY, kr } from "@/lib/coach";
import type { NexiReceipt } from "./client";

export const CATEGORIES: Category[] = ["food", "transport", "home", "kids", "leisure", "other"];
const GROCERS: Chain[] = ["Netto", "Bilka", "Føtex", "Rema 1000", "Lidl"];

const RULES: [Category, RegExp][] = [
  ["transport", /rejsekort|dsb|metro|movia|benzin|diesel|parkering|circle k|shell|q8|ok plus|taxa/i],
  ["kids", /fætter br|\bbr\b|lego|bleer|legetøj|malebog|farveblyant|børn/i],
  ["home", /ikea|jysk|bauhaus|silvan|lampe|samla|møbel|sengetøj/i],
  ["leisure", /biograf|nordisk film|billet|popcorn|espresso house|starbucks|baresso|caffe|café|cafe|latte|cappuccino|tivoli/i],
  ["food", TAKEAWAY],
];
const match = (text: string) => RULES.find(([, re]) => re.test(text))?.[0];

export interface Categorized {
  category: Category;
  lineCategories: Category[];
  aiNote: string;
}

export function categorizeByRules(r: Pick<NexiReceipt, "merchant" | "chain" | "lines" | "total">): Categorized {
  const base: Category = GROCERS.includes(r.chain) ? "food" : (match(r.merchant) ?? "other");
  // In a grocery basket only kid/home items break out (e.g. nappies); elsewhere every line follows the shop.
  const lineCategories = r.lines.map((l) => {
    const m = match(l.name);
    return base === "food" ? (m === "kids" || m === "home" ? m : "food") : base;
  });
  const sums = new Map<Category, number>();
  r.lines.forEach((l, i) => sums.set(lineCategories[i], (sums.get(lineCategories[i]) ?? 0) + l.price));
  const category = [...sums].sort((a, b) => b[1] - a[1])[0]?.[0] ?? base;
  return { category, lineCategories, aiNote: noteFor(r, category) };
}

function noteFor(r: Pick<NexiReceipt, "merchant" | "lines" | "total">, category: Category): string {
  if (TAKEAWAY.test(r.merchant)) return `Takeaway night, ${kr(r.total)}. Enjoy it!`;
  if (category === "food") {
    const perKg = r.lines
      .filter((l) => l.kgPerUnit && l.price / (l.qty * l.kgPerUnit) < 30)
      .map((l) => l.name.replace(/\s+\d.*$/, ""));
    return perKg.length
      ? `Groceries, ${r.lines.length} items. Good kr/kg on ${perKg.slice(0, 2).join(" and ").toLowerCase()}.`
      : `Groceries, ${r.lines.length} items.`;
  }
  return `Sorted under ${CATEGORY_LABEL[category].toLowerCase()}.`;
}
