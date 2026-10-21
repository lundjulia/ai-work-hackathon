"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@claude-impact-lab/ui/components/collapsible";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Info,
  OctagonAlert,
  ThumbsDown,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  demoActions,
  useAccountLabel,
  reportDemoError,
} from "@/components/app-state";
import { formatMoney, formatTime } from "@/lib/format";
import type { ActionItem, ActionItemType, Severity } from "@/lib/view-models";

const SEVERITY: Record<
  Severity,
  { label: string; icon: typeof Info; className: string }
> = {
  info: {
    label: "Opportunity",
    icon: Info,
    className: "bg-accent text-accent-foreground",
  },
  warning: {
    label: "Heads up",
    icon: AlertTriangle,
    className: "bg-warning/15 text-warning-foreground",
  },
  critical: {
    label: "Needs you",
    icon: OctagonAlert,
    className: "bg-destructive/10 text-destructive",
  },
};

const TYPE_LABEL: Record<ActionItemType, string> = {
  budget_alert: "Budget",
  transfer: "Transfer",
  insight: "Insight",
  refinancing: "Mortgage",
  risk: "Risk",
};

const AMOUNT_CAPTION: Partial<Record<ActionItemType, string>> = {
  budget_alert: "left this month",
  transfer: "to move",
  refinancing: "saved per month, after tax",
};

const APPROVE_LABEL: Partial<Record<ActionItemType, string>> = {
  transfer: "Approve transfer",
  budget_alert: "Got it",
  refinancing: "Interested",
};

export function transferConfirmation(
  item: ActionItem,
  accountLabel: (id?: string) => string,
) {
  const [from, to] = item.accounts ?? [];
  return `Simulated transfer: ${formatMoney(item.amount)} ${accountLabel(from)} → ${accountLabel(to)}`;
}

export function ActionCard({
  item,
  index = 0,
}: {
  item: ActionItem;
  index?: number;
}) {
  const accountLabel = useAccountLabel();
  const severity = SEVERITY[item.severity] ?? SEVERITY.info;
  const SeverityIcon = severity.icon;
  const isTransfer = item.type === "transfer";
  const [from, to] = item.accounts ?? [];
  const decided = item.status !== "new";
  const [pending, setPending] = useState(false);

  const approve = async () => {
    setPending(true);
    try {
      await demoActions.decide(item.id, "approved");
      if (isTransfer)
        toast.success(transferConfirmation(item, accountLabel), {
          description: "Demo only. No real money moved.",
        });
      else toast.success("Noted. Autopilot will keep an eye on it.");
    } catch (error) {
      reportDemoError(error);
    } finally {
      setPending(false);
    }
  };
  const dismiss = async () => {
    setPending(true);
    try {
      await demoActions.decide(item.id, "dismissed");
      toast("Dismissed", {
        action: {
          label: "Undo",
          onClick: () => {
            void demoActions.reopen(item.id).catch(reportDemoError);
          },
        },
      });
    } catch (error) {
      reportDemoError(error);
    } finally {
      setPending(false);
    }
  };

  return (
    <article
      className={cn(
        "animate-in rounded-3xl bg-card p-5 ring-1 ring-foreground/[0.06] duration-500 fill-mode-both fade-in slide-in-from-bottom-3",
        decided && "bg-card/60",
      )}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            severity.className,
          )}
        >
          <SeverityIcon className="size-3.5" />
          {severity.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {TYPE_LABEL[item.type] ?? "Insight"}
          {formatTime(item.createdAt) ? ` · ${formatTime(item.createdAt)}` : ""}
        </span>
      </div>

      <h3 className="mt-4 text-lg leading-snug font-semibold tracking-tight">
        {item.title}
      </h3>
      {item.body ? (
        <p className="mt-1.5 text-[15px] text-muted-foreground">{item.body}</p>
      ) : null}

      {item.amount ? (
        <div className="mt-4">
          <p className="figure text-3xl font-semibold">
            {formatMoney(item.amount)}
          </p>
          {AMOUNT_CAPTION[item.type] ? (
            <p className="text-xs text-muted-foreground">
              {AMOUNT_CAPTION[item.type]}
            </p>
          ) : null}
        </div>
      ) : null}

      {isTransfer && from && to ? (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-muted px-3 py-2.5 text-sm">
          <span className="truncate">{accountLabel(from)}</span>
          <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{accountLabel(to)}</span>
        </div>
      ) : null}

      {item.rationale ? (
        <Collapsible className="mt-4">
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-primary">
            Why?
            <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-300 ease-out data-[ending-style]:h-0 data-[starting-style]:h-0">
            <p className="pt-2 text-sm leading-relaxed text-muted-foreground">
              {item.rationale}
            </p>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {item.status === "new" ? (
        <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
          <Button
            size="lg"
            className="h-11 text-sm"
            disabled={pending}
            onClick={approve}
          >
            <Check data-icon="inline-start" />
            {APPROVE_LABEL[item.type] ?? "Approve"}
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-11 px-5 text-sm"
            disabled={pending}
            onClick={dismiss}
          >
            Dismiss
          </Button>
        </div>
      ) : (
        <div
          className={cn(
            "mt-5 flex items-start gap-2 rounded-2xl px-3 py-2.5 text-sm",
            item.status === "approved"
              ? "bg-accent text-accent-foreground"
              : "bg-muted text-muted-foreground",
          )}
        >
          {item.status === "approved" ? (
            <Check className="mt-0.5 size-4 shrink-0" />
          ) : (
            <X className="mt-0.5 size-4 shrink-0" />
          )}
          <span>
            {item.status === "approved"
              ? isTransfer
                ? `${transferConfirmation(item, accountLabel)}. Demo only, no real money moved.`
                : "Approved"
              : "Dismissed"}
          </span>
        </div>
      )}

      <div className="mt-3 flex justify-end">
        {item.feedback === "not_useful" ? (
          <span className="text-xs text-muted-foreground">
            Thanks, Autopilot will show fewer like this
          </span>
        ) : (
          <button
            type="button"
            onClick={async () => {
              try {
                await demoActions.markNotUseful(item.id);
                toast("Thanks for the feedback", {
                  description: "Autopilot will tune future runs.",
                });
              } catch (error) {
                reportDemoError(error);
              }
            }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <ThumbsDown className="size-3" />
            Not useful
          </button>
        )}
      </div>
    </article>
  );
}
