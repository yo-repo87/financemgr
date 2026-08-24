export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Compact axis-tick labels ($1.2K, $4.2M) - full formatCurrency is too wide for
// a narrow phone-width chart's y-axis gutter.
export function formatCompactCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const compact = abs >= 1000 ? abs.toLocaleString("en-US", { notation: "compact", maximumFractionDigits: 1 }) : abs.toFixed(0);
  return `${sign}$${compact}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
