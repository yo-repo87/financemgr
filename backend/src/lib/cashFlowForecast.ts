import { prisma } from "./prisma";
import { computeUpcomingDueDates, isoDate } from "./billing";

export interface ForecastPoint {
  date: string;
  balance: number;
  events: { label: string; amount: number }[];
}

export interface ForecastResult {
  startingBalance: number;
  series: ForecastPoint[];
  lowestBalance: number;
  lowestBalanceDate: string;
  threshold: number;
  suggestedSafeToSave: number;
}

function toDateOnlyUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

// Projects the next `days` of balance, walking forward day by day: unpaid Bill
// occurrences (computeUpcomingDueDates from billing.ts) and tracked/new
// DetectedSubscription charges (projected monthly from lastChargedDate)
// subtract; CONFIRMED DetectedIncome occurrences (projected on cadenceDays
// from lastReceivedDate) add. Starting balance is the sum of depository
// account balances only - credit/loan balances are liabilities, not spendable cash.
export async function computeForecast(userId: string, days = 30): Promise<ForecastResult> {
  const today = toDateOnlyUTC(new Date());
  const horizon = new Date(today.getTime() + days * 86400000);

  const [accounts, bills, billPayments, subscriptions, incomes, cashFlowSetting] = await Promise.all([
    prisma.account.findMany({ where: { plaidItem: { userId }, type: "depository" } }),
    prisma.bill.findMany({ where: { userId, active: true } }),
    prisma.billPayment.findMany({ where: { bill: { userId } } }),
    prisma.detectedSubscription.findMany({ where: { userId, status: { in: ["NEW", "TRACKED"] } } }),
    prisma.detectedIncome.findMany({ where: { userId, status: "CONFIRMED" } }),
    prisma.cashFlowSetting.findUnique({ where: { userId } }),
  ]);

  const startingBalance = accounts.reduce((sum, a) => sum + Number(a.currentBalance ?? 0), 0);
  const threshold = Number(cashFlowSetting?.lowBalanceThreshold ?? 0);

  const paidByBill = new Map<string, Set<string>>();
  for (const p of billPayments) {
    if (!paidByBill.has(p.billId)) paidByBill.set(p.billId, new Set());
    paidByBill.get(p.billId)!.add(isoDate(p.dueDate));
  }

  const eventsByDate = new Map<string, { label: string; amount: number }[]>();
  function addEvent(date: Date, label: string, amount: number) {
    if (date < today || date > horizon) return;
    const key = isoDate(date);
    if (!eventsByDate.has(key)) eventsByDate.set(key, []);
    eventsByDate.get(key)!.push({ label, amount });
  }

  for (const bill of bills) {
    const paid = paidByBill.get(bill.id) ?? new Set<string>();
    const occurrences = computeUpcomingDueDates(bill, 24, today).filter((d) => d <= horizon && !paid.has(isoDate(d)));
    for (const d of occurrences) addEvent(d, bill.name, -Number(bill.amount));
  }

  for (const sub of subscriptions) {
    let next = new Date(sub.lastChargedDate);
    for (let i = 0; i < 12 && next <= horizon; i++) {
      next = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()));
      if (next >= today) addEvent(next, sub.displayName, -Number(sub.amount));
    }
  }

  for (const income of incomes) {
    let next = new Date(income.lastReceivedDate);
    const cadence = Math.max(income.cadenceDays, 1);
    for (let i = 0; i < 60 && next <= horizon; i++) {
      next = new Date(next.getTime() + cadence * 86400000);
      if (next >= today) addEvent(next, income.displayName, Number(income.amount));
    }
  }

  const series: ForecastPoint[] = [];
  let running = startingBalance;
  let lowestBalance = startingBalance;
  let lowestBalanceDate = isoDate(today);

  for (let i = 0; i <= days; i++) {
    const date = new Date(today.getTime() + i * 86400000);
    const key = isoDate(date);
    const events = eventsByDate.get(key) ?? [];
    for (const e of events) running += e.amount;
    if (running < lowestBalance) {
      lowestBalance = running;
      lowestBalanceDate = key;
    }
    series.push({ date: key, balance: Math.round(running * 100) / 100, events });
  }

  // "Safe to save": the cushion between the projected low point and the
  // user's threshold, halved as a conservative buffer against the forecast
  // itself being off (unconfirmed income, un-detected irregular expenses).
  const suggestedSafeToSave = Math.max(0, Math.round(((lowestBalance - threshold) / 2) * 100) / 100);

  return {
    startingBalance: Math.round(startingBalance * 100) / 100,
    series,
    lowestBalance: Math.round(lowestBalance * 100) / 100,
    lowestBalanceDate,
    threshold,
    suggestedSafeToSave,
  };
}
