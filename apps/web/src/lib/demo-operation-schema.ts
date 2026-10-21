import { z } from "zod";

export const amountSchema = z.number().finite().min(0).max(10_000_000);
export const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Use a valid calendar date.");
export const goalsSchema = z.object({
  monthlyIncome: amountSchema,
  riskTolerance: z.enum(["conservative", "balanced", "growth"]),
  safetyNetMonths: z.number().finite().min(0).max(24),
  savingsGoal: z.object({ name: z.string().trim().min(1).max(100), target: amountSchema, date: calendarDateSchema }).strict(),
  budgets: z.object({
    groceries: amountSchema, restaurants: amountSchema, transport: amountSchema,
    shopping: amountSchema, subscriptions: amountSchema, entertainment: amountSchema,
  }).strict(),
}).strict();
const bankId = z.enum(["danske", "revolut", "saxo"]);
const id = z.string().min(1).max(200);
export const demoOperationSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("connectBank"), bankId }).strict(),
  z.object({ operation: z.literal("disconnectBank"), bankId }).strict(),
  z.object({ operation: z.literal("saveGoals"), goals: goalsSchema }).strict(),
  z.object({ operation: z.literal("completeOnboarding"), goals: goalsSchema }).strict(),
  z.object({ operation: z.literal("advanceDays"), days: z.number().int().min(1).max(14) }).strict(),
  z.object({ operation: z.literal("runAutopilot") }).strict(),
  z.object({ operation: z.literal("decide"), id, decision: z.enum(["approved", "dismissed"]) }).strict(),
  z.object({ operation: z.literal("reopen"), id }).strict(),
  z.object({ operation: z.literal("markNotUseful"), id }).strict(),
  z.object({ operation: z.literal("reset") }).strict(),
  z.object({ operation: z.literal("connectNexi") }).strict(),
  z.object({ operation: z.literal("triggerEvent"), kind: z.enum(["receipt", "budget", "review", "goal"]) }).strict(),
  z.object({ operation: z.literal("readNotification"), id }).strict(),
]);

export type DemoOperation = z.infer<typeof demoOperationSchema>;
