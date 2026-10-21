"use client";

import { Button } from "@claude-impact-lab/ui/components/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@claude-impact-lab/ui/components/sheet";
import { cn } from "@claude-impact-lab/ui/lib/utils";
import { Check, ChevronRight, Loader2, Lock } from "lucide-react";
import { useState } from "react";

import {
  demoActions,
  useAccounts,
  useDemoState,
  reportDemoError,
} from "@/components/app-state";
import { AccountRow } from "@/components/account-row";
import { BankLogo } from "@/components/brand";
import { DemoBadge } from "@/components/section";
import { formatDate, formatMoney } from "@/lib/format";
import {
  type Account,
  BANKS,
  type Bank,
  type BankId,
  addDays,
} from "@/lib/view-models";

type Phase = "consent" | "fetching" | "done";

const FETCH_STEPS = [
  "Securing connection",
  "Fetching accounts",
  "Reading 90 days of transactions",
];

function ConsentSheet({
  bank,
  open,
  onOpenChange,
}: {
  bank: Bank | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { simulatedDate } = useDemoState();
  const [phase, setPhase] = useState<Phase>("consent");
  const [step, setStep] = useState(0);
  const [accounts, setAccounts] = useState<Account[]>([]);

  const allow = async () => {
    if (!bank) return;
    setPhase("fetching");
    setStep(0);
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1050),
    ];
    try {
      const result = await demoActions.connectBank(bank.id);
      setAccounts(result);
      setPhase("done");
    } catch (error) {
      setPhase("consent");
      reportDemoError(error);
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (phase === "fetching") return;
        onOpenChange(next);
      }}
      onOpenChangeComplete={(next) => {
        if (!next) {
          setPhase("consent");
          setAccounts([]);
        }
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={phase !== "fetching"}
        className="mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-[2rem] border-0 px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {bank ? (
          <div className="space-y-6">
            <div className="mx-auto h-1 w-10 rounded-full bg-foreground/10" />
            <div className="flex items-center gap-3">
              <BankLogo bankId={bank.id} className="size-12 text-base" />
              <div className="space-y-1">
                <SheetTitle className="text-lg font-semibold">
                  {bank.name}
                </SheetTitle>
                <DemoBadge />
              </div>
            </div>

            {phase === "consent" ? (
              <>
                <SheetDescription className="text-sm text-muted-foreground">
                  Autopilot asks {bank.name} for read-only access to:
                </SheetDescription>
                <ul className="space-y-3">
                  {bank.permissions.map((p) => (
                    <li key={p.id} className="flex items-start gap-3">
                      <span className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-accent text-accent-foreground">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      <div>
                        <p className="text-sm font-medium">{p.label}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {p.detail}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="rounded-2xl bg-muted px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
                  Consent lasts {bank.consentDays} days, until{" "}
                  {formatDate(addDays(simulatedDate, bank.consentDays), "long")}
                  . You can revoke it any time. Autopilot cannot move money.
                </div>
                <div className="space-y-2">
                  <Button
                    size="lg"
                    className="h-12 w-full text-base"
                    onClick={allow}
                  >
                    Allow access
                  </Button>
                  <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
                    <Lock className="size-3" />
                    Demo connection with synthetic data. No bank login needed.
                  </p>
                </div>
              </>
            ) : null}

            {phase === "fetching" ? (
              <div className="space-y-4 py-4" aria-live="polite">
                {FETCH_STEPS.map((label, i) => (
                  <div
                    key={label}
                    className={cn(
                      "flex items-center gap-3 text-sm transition-opacity duration-300",
                      i > step && "opacity-35",
                    )}
                  >
                    <span className="flex size-6 items-center justify-center">
                      {i < step ? (
                        <Check
                          className="size-4 text-primary"
                          strokeWidth={3}
                        />
                      ) : i === step ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <span className="size-1.5 rounded-full bg-foreground/30" />
                      )}
                    </span>
                    {label}…
                  </div>
                ))}
              </div>
            ) : null}

            {phase === "done" ? (
              <div className="animate-in space-y-5 duration-500 fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Check className="size-4" strokeWidth={3} />
                  {accounts.length}{" "}
                  {accounts.length === 1 ? "account" : "accounts"} connected
                </div>
                <div className="divide-y divide-border rounded-2xl bg-muted/60 px-4">
                  {accounts.map((a) => (
                    <AccountRow key={a.id} account={a} />
                  ))}
                </div>
                <Button
                  size="lg"
                  className="h-12 w-full text-base"
                  onClick={() => onOpenChange(false)}
                >
                  Done
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function ConnectBanks() {
  const { connectedBanks } = useDemoState();
  const accounts = useAccounts();
  const [active, setActive] = useState<BankId | null>(null);
  const [open, setOpen] = useState(false);
  const bank = BANKS.find((b) => b.id === active) ?? null;

  return (
    <div className="space-y-3">
      {BANKS.map((b, index) => {
        const connected = connectedBanks.includes(b.id);
        const bankAccounts = accounts.filter((a) => a.bankId === b.id);
        const total = bankAccounts.reduce((s, a) => s + a.balanceDkk, 0);
        return (
          <div
            key={b.id}
            className="animate-in rounded-3xl bg-card ring-1 ring-foreground/[0.06] duration-500 fill-mode-both fade-in slide-in-from-bottom-2"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <button
              type="button"
              disabled={connected}
              onClick={() => {
                setActive(b.id);
                setOpen(true);
              }}
              className="flex w-full items-center gap-3 p-4 text-left"
            >
              <BankLogo bankId={b.id} />
              <div className="flex-1">
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {connected
                    ? `${bankAccounts.length} ${bankAccounts.length === 1 ? "account" : "accounts"} · ${formatMoney(total)}`
                    : b.id === "saxo"
                      ? "Investments and cash"
                      : "Accounts and cards"}
                </p>
              </div>
              {connected ? (
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4" strokeWidth={3} />
                </span>
              ) : (
                <span className="flex items-center gap-1 text-sm font-medium text-primary">
                  Connect
                  <ChevronRight className="size-4" />
                </span>
              )}
            </button>
            {connected && bankAccounts.length > 0 ? (
              <div className="divide-y divide-border border-t border-border px-4">
                {bankAccounts.map((a) => (
                  <AccountRow key={a.id} account={a} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      <ConsentSheet bank={bank} open={open} onOpenChange={setOpen} />
    </div>
  );
}
