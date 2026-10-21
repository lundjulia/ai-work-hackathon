// Shared data contract. Change only via the main thread.

export type Category = "food" | "transport" | "home" | "kids" | "leisure" | "other";

export type Chain = "Netto" | "Bilka" | "Føtex" | "Rema 1000" | "Lidl" | "Other";

export interface ReceiptLine {
  name: string;
  qty: number;
  /** Weight/volume of one unit in kg (or litres), when known. Enables kr/kg comparisons. */
  kgPerUnit?: number;
  price: number; // DKK, line total
  category?: Category;
}

/** Shape mirrors a Nexi Smart Receipt payload as we assume it arrives (faked). */
export interface Receipt {
  id: string;
  merchant: string;
  chain: Chain;
  date: string; // ISO
  total: number; // DKK
  lines: ReceiptLine[];
  category: Category; // dominant category, set by AI categorization
  aiNote?: string; // plain-language one-liner from the AI
  source: "nexi";
}

export interface Goal {
  name: string;
  emoji: string;
  target: number; // DKK
  saved: number; // DKK
  monthly: number; // DKK set aside per month
}

export type RiskTolerance = "low" | "medium" | "high";

export interface Profile {
  familyName: string;
  income: number; // monthly net DKK
  riskTolerance: RiskTolerance;
  safetyNetTarget: number;
  safetyNetCurrent: number;
  budgets: Record<Category, number>; // monthly DKK per category
}

/** User feedback / commitments, e.g. "No candy this week!" */
export interface Pledge {
  id: string;
  text: string;
  createdAt: string;
  active: boolean;
}

export interface AppNotification {
  id: string;
  kind: "win" | "nudge" | "tip" | "receipt";
  title: string;
  body: string;
  at: string; // ISO
  read?: boolean;
}

export interface Offer {
  chain: Exclude<Chain, "Other">;
  product: string;
  price: number; // DKK per pack
  kg: number; // pack weight in kg (or litres)
  pricePerKg: number;
  validFrom: string;
  validTo: string;
  category?: string; // e.g. "meat", "veg", "dairy"
}
