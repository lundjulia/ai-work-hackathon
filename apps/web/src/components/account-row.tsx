import { formatMoney } from "@/lib/format";
import type { Account } from "@/lib/view-models";

export function AccountRow({ account }: { account: Account }) {
  const detail =
    account.kind === "investment" && account.cashDkk !== undefined
      ? `Cash ${formatMoney(account.cashDkk)} · Positions ${formatMoney(account.positionsDkk)}`
      : account.maskedNumber;
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm">{account.name || "Account"}</p>
        {detail ? <p className="truncate text-xs text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="figure text-sm font-medium">{formatMoney(account.balance)}</p>
        {account.currency !== "DKK" ? (
          <p className="figure text-xs text-muted-foreground">≈ {formatMoney(account.balanceDkk)}</p>
        ) : null}
      </div>
    </div>
  );
}
