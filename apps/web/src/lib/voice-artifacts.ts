import { z } from "zod";

import { amountSchema, calendarDateSchema, goalsSchema } from "./demo-operation-schema";

export const voiceModeSchema = z.enum(["onboarding", "assistant"]);
export type VoiceMode = z.infer<typeof voiceModeSchema>;
export type VoiceSessionOptions = { mode?: VoiceMode; notificationId?: string };
export function hasVoiceNotification(snapshot: { notifications?: { id: string }[] }, notificationId?: string) {
  return notificationId === undefined || Boolean(snapshot.notifications?.some((notification) => notification.id === notificationId));
}

const text = z.string().min(1).max(3000);
const money = z.number().finite().min(-1e12).max(1e12);
const percentage = z.number().finite().nullable();
const category = z.enum(["groceries", "restaurants", "transport", "shopping", "subscriptions", "entertainment"]);
const common = { title: z.string().min(1).max(200), today: calendarDateSchema };
const warnings = z.array(text).max(100);
const action = z.object({
  id: z.string().min(1).max(300), runId: z.string().min(1).max(300),
  type: z.enum(["budget_alert", "transfer", "insight", "refinancing", "risk"]),
  title: text, body: text,
  amount: z.object({ amount: amountSchema, currency: z.enum(["DKK", "EUR"]) }).strict().optional(),
  accounts: z.array(z.string().min(1).max(300)).max(5).optional(),
  severity: z.enum(["info", "warning", "critical"]), status: z.enum(["new", "approved", "dismissed"]),
  rationale: text, createdAt: z.string().datetime({ offset: true }),
  feedback: z.literal("not_useful").optional(), candidateKey: z.string().min(1).max(300).optional(),
  goalRevision: z.number().int().min(0).max(1_000_000).optional(),
  facts: z.record(z.string().min(1).max(100), z.union([money, z.string().max(2000), z.boolean(), z.null()])).optional(),
  triggeredOn: calendarDateSchema.optional(),
}).strict();

/** Data-only cards. Browser components own rendering and confirmed state changes. */
export const voiceArtifactSchema = z.discriminatedUnion("kind", [
  z.object({
    ...common, kind: z.literal("budget"), period: z.enum(["month", "week"]),
    startDate: calendarDateSchema, endDate: calendarDateSchema,
    rows: z.array(z.object({
      category, label: z.string().min(1).max(100), limitDkk: money,
      spentDkk: money, remainingDkk: money, percentUsed: percentage,
    }).strict()).max(6), note: text, warnings,
  }).strict(),
  z.object({
    ...common, kind: z.literal("goals"), monthlyIncomeDkk: amountSchema,
    riskTolerance: z.enum(["conservative", "balanced", "growth"]),
    safetyNet: z.object({
      floorDkk: money, targetMonths: z.number().finite().min(0).max(24),
      bufferDkk: money, targetDkk: money, monthsCovered: z.number().finite().nullable(),
    }).strict(),
    savingsGoal: z.object({
      name: z.string().min(1).max(100), targetDkk: amountSchema, savedDkk: money,
      targetDate: calendarDateSchema, remainingDkk: money, percentDone: percentage,
    }).strict().nullable(), warnings,
  }).strict(),
  z.object({
    ...common, kind: z.literal("forecast"), reliable: z.boolean(), balanceTodayDkk: money,
    nextPayday: calendarDateSchema.nullable(), lowestBalanceDkk: money.nullable(),
    lowestOn: calendarDateSchema.nullable(), minimumBalanceDkk: money,
    points: z.array(z.object({ date: calendarDateSchema, balanceDkk: money }).strict()).max(91),
    bills: z.array(z.object({ name: text, date: calendarDateSchema, amountDkk: money, estimated: z.boolean() }).strict()).max(100),
    warnings,
  }).strict(),
  z.object({ ...common, kind: z.literal("action"), action }).strict(),
  z.object({
    ...common, kind: z.literal("settings"), goals: goalsSchema,
    finishOnboarding: z.boolean(), confirmationRequired: z.literal(true),
  }).strict(),
]);

export type VoiceArtifact = z.infer<typeof voiceArtifactSchema>;
