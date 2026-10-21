import { cn } from "@claude-impact-lab/ui/lib/utils";

import type { BankId } from "@/lib/view-models";

/** Penny mark: a rounded tile with a rising, steady path. Placeholder until branding lands. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className={cn("size-10", className)}>
      <rect width="40" height="40" rx="12" className="fill-primary" />
      <path
        d="M10 27.5 17.5 20l5 4.5L30 13"
        fill="none"
        className="stroke-primary-foreground"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="13" r="2.6" className="fill-primary-foreground" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span className="text-base font-semibold tracking-tight">Penny</span>
    </span>
  );
}

const BANK_STYLE: Record<BankId, { bg: string; fg: string; label: string }> = {
  danske: { bg: "#003755", fg: "#ffffff", label: "D" },
  revolut: { bg: "#191c1f", fg: "#ffffff", label: "R" },
  saxo: { bg: "#1f3e8c", fg: "#ffffff", label: "S" },
};

/** Neutral bank monogram (no trademarked logos). */
export function BankLogo({ bankId, className }: { bankId: BankId; className?: string }) {
  const style = BANK_STYLE[bankId] ?? { bg: "#64748b", fg: "#fff", label: "?" };
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
        className,
      )}
      style={{ backgroundColor: style.bg, color: style.fg }}
    >
      {style.label}
    </span>
  );
}
