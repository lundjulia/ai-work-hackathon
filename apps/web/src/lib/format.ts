import type { Currency, Money } from "./view-models";

const numberFormat = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "DKK 18,500". Shows decimals only when the amount has them. */
export function formatMoney(
  value: number | Money | undefined | null,
  currency: Currency = "DKK",
  options: { signed?: boolean } = {},
): string {
  if (value === undefined || value === null) return "—";
  const amount = typeof value === "number" ? value : value.amount;
  const cur = typeof value === "number" ? currency : value.currency;
  if (!Number.isFinite(amount)) return "—";
  const abs = Math.abs(amount);
  const digits = Number.isInteger(abs) ? numberFormat.format(abs) : decimalFormat.format(abs);
  const sign = amount < 0 ? "−" : options.signed && amount > 0 ? "+" : "";
  return `${sign}${cur} ${digits}`;
}

export function formatNumber(value: number | undefined | null): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return "—";
  return numberFormat.format(value);
}

export function formatDate(
  iso: string | undefined | null,
  style: "short" | "long" | "weekday" = "short",
): string {
  if (!iso) return "—";
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "—";
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }
      : style === "weekday"
        ? { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" };
  return d.toLocaleDateString("en-GB", options);
}

export function formatTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
