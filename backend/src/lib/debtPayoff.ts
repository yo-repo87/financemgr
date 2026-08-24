export interface Debt {
  id: string;
  name: string;
  balance: number;
  aprPercentage: number;
  minimumPayment: number;
}

export interface PayoffSchedulePoint {
  month: number;
  totalBalance: number;
}

export interface PayoffResult {
  months: number;
  totalInterestPaid: number;
  schedule: PayoffSchedulePoint[];
  payoffOrder: string[];
}

const MAX_MONTHS = 600; // 50 years - a hard stop for the case where payments don't cover interest

// Simulates month-by-month amortization across all debts, always paying at
// least the minimum on every debt and directing all remaining budget (the
// extra payment, plus minimums freed up as debts get paid off) at whichever
// debt is first in `order`. Pure computation - nothing persisted, this backs
// a POST /simulate endpoint that re-runs on every request.
function simulate(debts: Debt[], order: string[], extraMonthlyPayment: number): PayoffResult {
  const balances = new Map(debts.map((d) => [d.id, d.balance]));
  const minimums = new Map(debts.map((d) => [d.id, d.minimumPayment]));
  const aprs = new Map(debts.map((d) => [d.id, d.aprPercentage]));

  const schedule: PayoffSchedulePoint[] = [];
  let totalInterestPaid = 0;
  let month = 0;

  const remaining = () => [...balances.values()].reduce((s, b) => s + b, 0);

  schedule.push({ month: 0, totalBalance: Math.round(remaining() * 100) / 100 });

  while (remaining() > 0.01 && month < MAX_MONTHS) {
    month++;
    let budget = extraMonthlyPayment;

    // Interest accrual + minimum payment on every open debt.
    for (const id of order) {
      const balance = balances.get(id)!;
      if (balance <= 0) continue;
      const monthlyRate = aprs.get(id)! / 100 / 12;
      const interest = balance * monthlyRate;
      totalInterestPaid += interest;
      const minPayment = Math.min(minimums.get(id)!, balance + interest);
      balances.set(id, balance + interest - minPayment);
      budget += minimums.get(id)! - minPayment; // freed-up budget if this payment closed the debt out
    }

    // Remaining budget (extra payment + anything freed up) goes to the
    // highest-priority debt still open, then cascades down `order`.
    for (const id of order) {
      if (budget <= 0) break;
      const balance = balances.get(id)!;
      if (balance <= 0) continue;
      const applied = Math.min(budget, balance);
      balances.set(id, balance - applied);
      budget -= applied;
    }

    schedule.push({ month, totalBalance: Math.round(remaining() * 100) / 100 });
  }

  return {
    months: month,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    schedule,
    payoffOrder: order,
  };
}

export function simulatePayoff(debts: Debt[], extraMonthlyPayment: number) {
  const avalancheOrder = [...debts].sort((a, b) => b.aprPercentage - a.aprPercentage).map((d) => d.id);
  const snowballOrder = [...debts].sort((a, b) => a.balance - b.balance).map((d) => d.id);

  return {
    avalanche: simulate(debts, avalancheOrder, extraMonthlyPayment),
    snowball: simulate(debts, snowballOrder, extraMonthlyPayment),
  };
}
