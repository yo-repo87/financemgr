import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { formatCurrency, formatCompactCurrency } from "../lib/format";
import { categorical, chrome } from "../lib/chartTheme";

interface Debt {
  id: string;
  name: string;
  balance: number;
  aprPercentage: number;
  minimumPayment: number;
}

interface SchedulePoint {
  month: number;
  totalBalance: number;
}

interface StrategyResult {
  months: number;
  totalInterestPaid: number;
  schedule: SchedulePoint[];
  payoffOrder: string[];
}

interface SimulateResponse {
  debts: Debt[];
  avalanche: StrategyResult | null;
  snowball: StrategyResult | null;
}

function years(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m}mo`;
  return m === 0 ? `${y}yr` : `${y}yr ${m}mo`;
}

export default function DebtPayoff() {
  const [extraPayment, setExtraPayment] = useState("0");
  const [result, setResult] = useState<SimulateResponse | null>(null);

  const { data: debts } = useQuery<Debt[]>({
    queryKey: ["debt-payoff-debts"],
    queryFn: () => api.get("/api/debt-payoff/debts").then((r) => r.data),
  });

  const simulateMutation = useMutation({
    mutationFn: (extraMonthlyPayment: number) =>
      api.post("/api/debt-payoff/simulate", { extraMonthlyPayment }).then((r) => r.data as SimulateResponse),
    onSuccess: (data) => setResult(data),
  });

  function runSimulation() {
    simulateMutation.mutate(Number(extraPayment) || 0);
  }

  const chartData = (() => {
    if (!result?.avalanche || !result?.snowball) return [];
    const maxMonths = Math.max(result.avalanche.schedule.length, result.snowball.schedule.length);
    const points: { month: number; avalanche: number | null; snowball: number | null }[] = [];
    for (let m = 0; m < maxMonths; m++) {
      points.push({
        month: m,
        avalanche: result.avalanche.schedule[m]?.totalBalance ?? 0,
        snowball: result.snowball.schedule[m]?.totalBalance ?? 0,
      });
    }
    return points;
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Debt Payoff Planner</h1>

      {debts && debts.length === 0 && (
        <p className="bg-white rounded-lg border px-4 py-8 text-center text-slate-400 text-sm">
          No credit card debt with APR data found. This planner uses the APR and balance Plaid reports for linked
          credit cards.
        </p>
      )}

      {debts && debts.length > 0 && (
        <>
          <div className="bg-white rounded-lg border p-4 sm:p-6 space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Your debts</h2>
            <div className="divide-y">
              {debts.map((d) => (
                <div key={d.id} className="py-2.5 flex items-center justify-between text-sm">
                  <span className="text-slate-900">{d.name}</span>
                  <span className="text-slate-500">
                    {formatCurrency(d.balance)} · {d.aprPercentage.toFixed(2)}% APR · min{" "}
                    {formatCurrency(d.minimumPayment)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 mb-1">Extra monthly payment</label>
              <input
                type="number"
                min="0"
                step="10"
                value={extraPayment}
                onChange={(e) => setExtraPayment(e.target.value)}
                className="w-full sm:w-48 border rounded-md px-3 py-2.5 sm:py-2 text-sm"
              />
            </div>
            <button
              onClick={runSimulation}
              disabled={simulateMutation.isPending}
              className="bg-slate-900 text-white rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium min-h-[44px] sm:min-h-0 disabled:opacity-50"
            >
              {simulateMutation.isPending ? "Simulating..." : "Simulate"}
            </button>
          </div>

          {result?.avalanche && result?.snowball && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs font-medium" style={{ color: categorical[0] }}>
                    Avalanche (highest APR first)
                  </p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{years(result.avalanche.months)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatCurrency(result.avalanche.totalInterestPaid)} total interest
                  </p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                  <p className="text-xs font-medium" style={{ color: categorical[1] }}>
                    Snowball (smallest balance first)
                  </p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">{years(result.snowball.months)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatCurrency(result.snowball.totalInterestPaid)} total interest
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-lg border p-4 sm:p-6">
                <h2 className="text-sm font-medium text-slate-700 mb-1">Balance over time</h2>
                <p className="text-xs text-slate-400 mb-4">
                  Avalanche minimizes total interest; snowball pays off individual debts sooner for momentum.
                </p>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={chartData} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={(m) => `${m}mo`}
                      stroke={chrome.axis}
                      tick={{ fill: chrome.mutedText, fontSize: 11 }}
                      minTickGap={30}
                    />
                    <YAxis
                      tickFormatter={(v) => formatCompactCurrency(v)}
                      stroke={chrome.axis}
                      tick={{ fill: chrome.mutedText, fontSize: 11 }}
                      width={52}
                    />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} labelFormatter={(m) => `Month ${m}`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="avalanche" name="Avalanche" stroke={categorical[0]} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="snowball" name="Snowball" stroke={categorical[1]} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
