import { FIXTURE_ACCOUNTS, DEMO_DATE, FIXTURE_END } from "@claude-impact-lab/finance";
import { z } from "zod";

import type { DemoState } from "./demo-types";
import { amountSchema, calendarDateSchema, goalsSchema } from "./demo-operation-schema";
import { demoNotificationSchema } from "./demo-notifications";

export type PersistedDemoState = DemoState & { goalsRevision: number };
export const DEMO_SNAPSHOT_MAX_BYTES = 262_144;
const identifier = z.string().min(1).max(300);
const revision = z.number().int().min(0).max(1_000_000);
const clockDate = calendarDateSchema.refine((value) => value >= DEMO_DATE && value <= FIXTURE_END, "Demo date is outside the synthetic activity range.");
const timestamp = z.string().max(40).datetime({ offset: true });
const accountIds = new Set(FIXTURE_ACCOUNTS.map((account) => account.id));
const accountId = identifier.refine((value) => accountIds.has(value), "Unknown fixture account.");
const facts = z.record(z.string().min(1).max(100), z.union([z.number().finite().min(-1e12).max(1e12), z.string().max(2000), z.boolean(), z.null()]))
  .refine((value) => Object.keys(value).length <= 64, "Too many evidence fields.");
const actionSchema = z.object({
  id: identifier, runId: identifier,
  type: z.enum(["budget_alert", "transfer", "insight", "refinancing", "risk"]),
  title: z.string().min(1).max(300), body: z.string().min(1).max(3000),
  amount: z.object({ amount: amountSchema, currency: z.enum(["DKK", "EUR"]) }).strict().optional(),
  accounts: z.array(accountId).max(5).refine((ids) => new Set(ids).size === ids.length).optional(),
  severity: z.enum(["info", "warning", "critical"]), status: z.enum(["new", "approved", "dismissed"]),
  rationale: z.string().min(1).max(3000), createdAt: timestamp,
  feedback: z.literal("not_useful").optional(), candidateKey: identifier.optional(),
  goalRevision: revision.optional(), facts: facts.optional(), triggeredOn: calendarDateSchema.optional(),
}).strict();
const runSchema = z.object({
  id: identifier, date: clockDate, ranAt: timestamp, summary: z.string().min(1).max(1000),
  checks: z.array(z.string().min(1).max(300)).max(20), newItemCount: z.number().int().min(0).max(100),
  goalRevision: revision.optional(), engine: z.literal("claude").optional(),
}).strict();

/** Browser snapshots are bounded editable demo input, not a trusted financial ledger. */
export const persistedDemoStateSchema: z.ZodType<PersistedDemoState> = z.object({
  version: z.literal(1), simulatedDate: clockDate,
  connectedBanks: z.array(z.enum(["danske", "revolut", "saxo"])).max(3).refine((banks) => new Set(banks).size === banks.length, "Bank connections must be unique."),
  onboarded: z.boolean(), goals: goalsSchema,
  adjustments: z.record(accountId, z.number().finite().min(-10_000_000).max(10_000_000)),
  actions: z.array(actionSchema).max(100), runs: z.array(runSchema).max(100), goalsRevision: revision,
  nexiConnected: z.boolean().default(false),
  notifications: z.array(demoNotificationSchema).max(100).default([]),
}).strict().superRefine((state, context) => {
  if (new Set(state.notifications?.map((item) => item.id)).size !== state.notifications?.length) context.addIssue({ code: "custom", message: "Notification IDs must be unique." });
  if (new Set(state.actions.map((item) => item.id)).size !== state.actions.length) context.addIssue({ code: "custom", message: "Action IDs must be unique." });
  if (new Set(state.runs.map((run) => run.id)).size !== state.runs.length) context.addIssue({ code: "custom", message: "Run IDs must be unique." });
  if (state.runs.some((run) => run.date > state.simulatedDate || (run.goalRevision ?? 0) > state.goalsRevision)) context.addIssue({ code: "custom", message: "Run metadata cannot be ahead of the demo state." });
});

export const autopilotSnapshotRequestSchema = z.object({
  operation: z.literal("runAutopilot"), snapshot: persistedDemoStateSchema,
}).strict();
