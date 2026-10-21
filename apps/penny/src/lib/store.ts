"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppNotification, Category, Goal, Pledge, Profile, Receipt } from "./types";
import seedReceipts from "@/data/receipts.json";

const DEFAULT_PROFILE: Profile = {
  familyName: "Jensen",
  income: 52000,
  riskTolerance: "low",
  safetyNetTarget: 30000,
  safetyNetCurrent: 12000,
  budgets: { food: 7800, transport: 2000, home: 3000, kids: 1500, leisure: 1200, other: 800 },
};

const DEFAULT_GOAL: Goal = { name: "Summer trip to Italy", emoji: "🇮🇹", target: 15000, saved: 6400, monthly: 1200 };

/** Secondary "Start investing" pot from the Figma Goals screen. The app never picks investments. */
const DEFAULT_INVESTING = { saved: 2000, target: 10000 };

interface AppState {
  user: { name: string; email: string } | null;
  nexiConnected: boolean;
  receipts: Receipt[];
  goal: Goal;
  investing: { saved: number; target: number };
  profile: Profile;
  pledges: Pledge[];
  notifications: AppNotification[];

  signIn: () => void;
  signOut: () => void;
  connectNexi: () => void;
  addReceipt: (r: Receipt) => void;
  addNotification: (n: Omit<AppNotification, "id" | "at">) => void;
  markNotificationsRead: () => void;
  setGoal: (g: Partial<Goal>) => void;
  setProfile: (p: Partial<Profile>) => void;
  addPledge: (text: string) => void;
  togglePledge: (id: string) => void;
  resetDemo: () => void;
}

const initial = () => ({
  user: null,
  nexiConnected: false,
  receipts: seedReceipts as Receipt[],
  goal: DEFAULT_GOAL,
  investing: DEFAULT_INVESTING,
  profile: DEFAULT_PROFILE,
  pledges: [] as Pledge[],
  notifications: [] as AppNotification[],
});

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...initial(),
      signIn: () => set({ user: { name: "Mette Jensen", email: "demo@family.dk" } }),
      signOut: () => set({ user: null }),
      connectNexi: () => set({ nexiConnected: true }),
      addReceipt: (r) => set((s) => ({ receipts: [r, ...s.receipts] })),
      addNotification: (n) =>
        set((s) => ({
          notifications: [{ ...n, id: crypto.randomUUID(), at: new Date().toISOString() }, ...s.notifications],
        })),
      markNotificationsRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      setGoal: (g) => set((s) => ({ goal: { ...s.goal, ...g } })),
      setProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
      addPledge: (text) =>
        set((s) => ({
          pledges: [{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), active: true }, ...s.pledges],
        })),
      togglePledge: (id) => set((s) => ({ pledges: s.pledges.map((p) => (p.id === id ? { ...p, active: !p.active } : p)) })),
      resetDemo: () => set(initial()),
    }),
    { name: "family-budget" },
  ),
);

/** Spend per category for the current calendar month. */
export function spentThisMonth(receipts: Receipt[], now = new Date()): Record<Category, number> {
  const out: Record<Category, number> = { food: 0, transport: 0, home: 0, kids: 0, leisure: 0, other: 0 };
  for (const r of receipts) {
    const d = new Date(r.date);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) out[r.category] += r.total;
  }
  return out;
}

/** Food spend for the current Mon–Sun week, and the weekly food budget (monthly / 4.33). */
export function foodThisWeek(receipts: Receipt[], monthlyFoodBudget: number, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const spent = receipts
    .filter((r) => r.category === "food" && new Date(r.date) >= start && new Date(r.date) <= now)
    .reduce((sum, r) => sum + r.total, 0);
  const budget = Math.round(monthlyFoodBudget / 4.33);
  const daysLeft = 7 - ((now.getDay() + 6) % 7) - 1;
  return { spent, budget, left: budget - spent, daysLeft };
}
