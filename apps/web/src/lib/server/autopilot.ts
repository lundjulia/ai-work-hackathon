import type { ActionCandidate, Goals as FinanceGoals } from "@claude-impact-lab/finance";
import { z } from "zod";

import { ENV } from "../../env.server";
import { buildFinanceView } from "../finance-view";
import type { ActionItem, ActionItemType, AutopilotRun } from "../view-models";
import { dailyReviewPrompt } from "./autopilot-prompt";
import { DemoError } from "./demo-errors";
import { persistedDemoStateSchema, type PersistedDemoState } from "../demo-state-schema";

export const AUTOPILOT_MODEL = "claude-haiku-5-5";
export const autopilotConfigured = () => Boolean(ENV.ANTHROPIC_API_KEY?.trim());

export const reviewResultSchema = z.object({
  candidateKeys: z.array(z.string()).max(3).refine((keys) => new Set(keys).size === keys.length, "Keys must be unique."),
  summary: z.string().trim().min(1).max(240).refine((summary) => !/[\d%\n]|\b(DKK|EUR|kr|kroner|percent)\b/i.test(summary), "Summary must be qualitative."),
}).strict();
export type DailyReview = z.infer<typeof reviewResultSchema>;

export async function selectDailyCandidates(input: { date: string; goals: FinanceGoals; candidates: ActionCandidate[] }): Promise<DailyReview> {
  const apiKey = ENV.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new DemoError("autopilot_not_configured", "Penny needs an ANTHROPIC_API_KEY on the server.", 503);
  const allowed = input.candidates.map((candidate) => candidate.key);
  let response: Response;
  try {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      signal: AbortSignal.timeout(35_000),
      body: JSON.stringify({
        model: AUTOPILOT_MODEL, max_tokens: 512, system: dailyReviewPrompt,
        messages: [{ role: "user", content: `<daily_review>\n${JSON.stringify(input)}\n</daily_review>` }],
        tool_choice: { type: "tool", name: "submit_daily_review" },
        tools: [{
          name: "submit_daily_review",
          description: "Submit the daily review by selecting existing computed findings in priority order.",
          input_schema: {
            type: "object", additionalProperties: false, required: ["candidateKeys", "summary"],
            properties: {
              candidateKeys: { type: "array", maxItems: 3, uniqueItems: true, items: allowed.length ? { type: "string", enum: allowed } : { type: "string" }, description: "Existing candidate keys in priority order. Empty when no relevant findings need attention." },
              summary: { type: "string", maxLength: 240, description: "One plain qualitative sentence. No numbers, amounts, percentages, counts, markdown or newlines. Reflect the selected findings or truthfully report no relevant findings." },
            },
          },
        }],
      }),
    });
  } catch {
    throw new DemoError("autopilot_unavailable", "Claude could not finish the review. Your saved state is unchanged; retry the run.", 502);
  }
  if (!response.ok) throw new DemoError("autopilot_unavailable", `Claude could not finish the review (HTTP ${response.status}). Retry after checking the server configuration.`, 502);
  let raw: unknown;
  try { raw = await response.json(); }
  catch { throw new DemoError("autopilot_invalid_review", "Claude returned an unreadable review. No actions were saved; retry the run.", 502); }
  const content = z.object({ content: z.array(z.object({ type: z.string(), name: z.string().optional(), input: z.unknown().optional() })) }).safeParse(raw);
  const toolCalls = content.success ? content.data.content.filter((block) => block.type === "tool_use") : [];
  const parsed = toolCalls.length === 1 && toolCalls[0]?.name === "submit_daily_review" ? reviewResultSchema.safeParse(toolCalls[0].input) : undefined;
  if (!parsed?.success || parsed.data.candidateKeys.some((key) => !allowed.includes(key))) {
    throw new DemoError("autopilot_invalid_review", "Claude returned an invalid review. No actions were saved; retry the run.", 502);
  }
  if (input.candidates.some((candidate) => candidate.severity === "high") && !input.candidates.some((candidate) => candidate.severity === "high" && parsed.data.candidateKeys.includes(candidate.key))) {
    throw new DemoError("autopilot_invalid_review", "Claude omitted an urgent finding. No actions were saved; retry the run.", 502);
  }
  return parsed.data;
}

const actionType: Record<ActionCandidate["type"], ActionItemType> = {
  budget_alert: "budget_alert", transfer_suggestion: "transfer", subscription_change: "insight", anomaly: "insight",
  refinancing: "refinancing", loan_consolidation: "insight", risk_check: "risk", safety_net: "risk", connection_issue: "insight",
};

function findRun(state: PersistedDemoState): AutopilotRun | undefined {
  return state.runs.find((run) => run.date === state.simulatedDate && run.goalRevision === state.goalsRevision);
}

/** Feedback applies to a finding's subject, even when its date, amount or goal target changes. */
function findingFamily(input: { key?: string; accounts?: string[]; facts?: Record<string, number | string | boolean | null> }) {
  const prefix = input.key?.split(":")[0] ?? "unknown";
  const subject = input.facts?.category ?? input.facts?.merchant ?? input.facts?.provider ?? "";
  return `${prefix}|${input.accounts?.join("|") ?? ""}|${subject}`;
}

export function candidateSuppressed(candidate: ActionCandidate, state: PersistedDemoState): boolean {
  const family = findingFamily(candidate);
  return state.actions.some((item) => {
    const sameFamily = findingFamily({ key: item.candidateKey, accounts: item.accounts, facts: item.facts }) === family;
    if (item.feedback === "not_useful" && sameFamily) return true;
    if (candidate.type === "transfer_suggestion" && item.type === "transfer" && sameFamily) {
      const run = state.runs.find((run) => run.id === item.runId);
      const sameMonth = run?.date.slice(0, 7) === state.simulatedDate.slice(0, 7);
      if (item.status === "dismissed" && item.goalRevision !== state.goalsRevision) return false;
      return sameMonth;
    }
    return item.candidateKey === candidate.key;
  });
}

export async function runAutopilotSnapshot(snapshot: PersistedDemoState, select = selectDailyCandidates) {
  if (select === selectDailyCandidates && !autopilotConfigured()) throw new DemoError("autopilot_not_configured", "Penny needs an ANTHROPIC_API_KEY on the server.", 503);
  const parsed = persistedDemoStateSchema.safeParse(snapshot);
  if (!parsed.success) throw new DemoError("invalid_snapshot", "The supplied demo snapshot is invalid.");
  const original = { state: parsed.data };
  const existingRun = findRun(original.state);
  if (existingRun) return { state: original.state, run: existingRun, items: [] as ActionItem[] };
  if (!original.state.connectedBanks.length) throw new DemoError("banks_required", "Connect a demo bank before running Penny.");
  const view = await buildFinanceView(original.state);
  const candidates = view.candidates.filter((candidate) => !candidateSuppressed(candidate, original.state));
  const selected = await select({ date: original.state.simulatedDate, goals: view.domainGoals, candidates });
  const reviewed = reviewResultSchema.safeParse(selected);
  if (!reviewed.success || reviewed.data.candidateKeys.some((key) => !candidates.some((candidate) => candidate.key === key))) {
    throw new DemoError("autopilot_invalid_review", "Claude returned an invalid review. No actions were saved; retry the run.", 502);
  }
  const review = reviewed.data;
  if (candidates.some((candidate) => candidate.severity === "high") && !candidates.some((candidate) => candidate.severity === "high" && review.candidateKeys.includes(candidate.key))) {
    throw new DemoError("autopilot_invalid_review", "Claude omitted an urgent finding. No actions were saved; retry the run.", 502);
  }
  const now = new Date().toISOString();
  const runId = crypto.randomUUID();
  const items: ActionItem[] = review.candidateKeys.map((key) => {
    const candidate = candidates.find((value) => value.key === key);
    if (!candidate) throw new DemoError("autopilot_invalid_review", "The review contained an unknown finding.", 502);
    return {
      id: crypto.randomUUID(), runId, type: actionType[candidate.type], title: candidate.title, body: candidate.body,
      ...(candidate.amount !== undefined ? { amount: { amount: candidate.amount, currency: "DKK" as const } } : {}),
      ...(candidate.accounts ? { accounts: candidate.accounts } : {}),
      severity: { low: "info", medium: "warning", high: "critical" }[candidate.severity] as ActionItem["severity"],
      status: "new", rationale: candidate.rationale, createdAt: now, candidateKey: candidate.key, goalRevision: original.state.goalsRevision,
      facts: candidate.facts, triggeredOn: candidate.triggeredOn,
    };
  });
  const run: AutopilotRun = { id: runId, date: original.state.simulatedDate, ranAt: now, summary: review.summary, checks: ["Connected account balances", "Budget and recurring charges", "Cash safety and financial goals", "Computed investment and loan insights"], newItemCount: items.length, goalRevision: original.state.goalsRevision, engine: "claude" };
  const state = { ...original.state, runs: [run, ...original.state.runs], actions: [...items, ...original.state.actions] };
  const checked = persistedDemoStateSchema.safeParse(state);
  if (!checked.success) throw new DemoError("snapshot_capacity", "The demo has too many saved reviews. Reset the demo to continue.", 409);
  return { state: checked.data, run, items };
}
