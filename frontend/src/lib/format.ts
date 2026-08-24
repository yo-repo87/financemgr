export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
