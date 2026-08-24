import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { formatCurrency, formatCompactCurrency, formatDate } from "../lib/format";
import { categorical, chrome, status } from "../lib/chartTheme";

interface ForecastPoint {
  date: string;
  balance: number;
  events: { label: string; amount: number }[];
}

interface Forecast {
  startingBalance: number;
  series: ForecastPoint[];
  lowestBalance: number;
  lowestBalanceDate: string;
  threshold: number;
  suggestedSafeToSave: number;
}

interface DetectedIncome {
  id: string;
  displayName: string;
  amount: string;
  cadenceDays: number;
  lastReceivedDate: string;
  occurrenceCount: number;
  status: "NEW" | "CONFIRMED";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const point: ForecastPoint = payload[0].payload;
  return (
    <div className="bg-white border rounded-md shadow-sm px-3 py-2 text-xs space-y-1">
      <p className="font-medium text-slate-700">{formatDate(label)}</p>
      <p className="text-slate-900 font-semibold">{formatCurrency(point.balance)}</p>
      {point.events.map((e, i) => (
        <p key={i} className={e.amount < 0 ? "text-slate-500" : "text-emerald-600"}>
          {e.label} {e.amount < 0 ? "-" : "+"}
          {formatCurrency(Math.abs(e.amount))}
        </p>
      ))}
    </div>
  );
}

export default function CashFlow() {
  const queryClient = useQueryClient();
  const [thresholdInput, setThresholdInput] = useState<string | null>(null);

  const { data: forecast } = useQuery<Forecast>({
    queryKey: ["cashflow-forecast"],
    queryFn: () => api.get("/api/cashflow/forecast", { params: { days: 30 } }).then((r) => r.data),
  });

  const { data: incomes } = useQuery<DetectedIncome[]>({
    queryKey: ["detected-income"],
    queryFn: () => api.get("/api/cashflow/income").then((r) => r.data),
  });

  const thresholdMutation = useMutation({
    mutationFn: (lowBalanceThreshold: number) => api.put("/api/cashflow/settings", { lowBalanceThreshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashflow-forecast"] });
      setThresholdInput(null);
    },
  });

  const incomeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "CONFIRMED" | "DISMISSED" }) =>
      api.patch(`/api/cashflow/income/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detected-income"] });
      queryClient.invalidateQueries({ queryKey: ["cashflow-forecast"] });
    },
  });

  const isLow = forecast ? forecast.lowestBalance < forecast.threshold : false;
  const newIncomes = (incomes ?? []).filter((i) => i.status === "NEW");
  const confirmedIncomes = (incomes ?? []).filter((i) => i.status === "CONFIRMED");

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Cash Flow</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-slate-500">Current balance</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {forecast ? formatCurrency(forecast.startingBalance) : "—"}
          </p>
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-slate-500">Lowest projected (30d)</p>
          <p className={`text-lg font-semibold mt-1 ${isLow ? "text-red-600" : "text-slate-900"}`}>
            {forecast ? formatCurrency(forecast.lowestBalance) : "—"}
          </p>
          {forecast && <p className="text-xs text-slate-400 mt-0.5">{formatDate(forecast.lowestBalanceDate)}</p>}
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-slate-500">Low-balance alert threshold</p>
          {thresholdInput === null ? (
            <button
              onClick={() => setThresholdInput(String(forecast?.threshold ?? 0))}
              className="text-lg font-semibold text-slate-900 mt-1 underline decoration-dotted underline-offset-2"
            >
              {forecast ? formatCurrency(forecast.threshold) : "—"}
            </button>
          ) : (
            <div className="flex items-center gap-1 mt-1">
              <input
                type="number"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                className="w-20 border rounded px-1.5 py-0.5 text-sm"
                autoFocus
              />
              <button
                onClick={() => thresholdMutation.mutate(Number(thresholdInput))}
                className="text-xs text-emerald-600 font-medium"
              >
                Save
              </button>
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border p-3 sm:p-4">
          <p className="text-xs text-slate-500">Safe to save</p>
          <p className="text-lg font-semibold text-emerald-600 mt-1">
            {forecast ? formatCurrency(forecast.suggestedSafeToSave) : "—"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Toward a goal, without risking the buffer</p>
        </div>
      </div>

      {isLow && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          Your balance is projected to dip below your ${forecast!.threshold} threshold on{" "}
          {formatDate(forecast!.lowestBalanceDate)}.
        </div>
      )}

      <div className="bg-white rounded-lg border p-4 sm:p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-1">30-day projected balance</h2>
        <p className="text-xs text-slate-400 mb-4">Based on unpaid bills, tracked subscriptions, and confirmed income</p>
        {!forecast || forecast.series.length === 0 ? (
          <p className="text-sm text-slate-400">Not enough data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={forecast.series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={categorical[0]} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={categorical[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => formatDate(v)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 11 }}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={(v) => formatCompactCurrency(v)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 11 }}
                width={56}
              />
              <ReferenceLine y={forecast.threshold} stroke={status.critical} strokeDasharray="4 4" />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={categorical[0]}
                strokeWidth={2}
                fill="url(#balanceFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {newIncomes.length > 0 && (
        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <h2 className="text-sm font-medium text-slate-700 mb-1">Possible income sources detected</h2>
          <p className="text-xs text-slate-400 mb-4">
            Confirm to include in your cash flow forecast, or dismiss if this isn't recurring income.
          </p>
          <div className="space-y-2">
            {newIncomes.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 border rounded-md px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{i.displayName}</p>
                  <p className="text-xs text-slate-400">
                    {formatCurrency(i.amount)} every ~{i.cadenceDays}d · last {formatDate(i.lastReceivedDate)} ·{" "}
                    {i.occurrenceCount}x seen
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => incomeStatusMutation.mutate({ id: i.id, status: "CONFIRMED" })}
                    className="text-xs font-medium text-emerald-600 border border-emerald-200 rounded px-2 py-1"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => incomeStatusMutation.mutate({ id: i.id, status: "DISMISSED" })}
                    className="text-xs font-medium text-slate-500 border rounded px-2 py-1"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {confirmedIncomes.length > 0 && (
        <div className="bg-white rounded-lg border p-4 sm:p-6">
          <h2 className="text-sm font-medium text-slate-700 mb-3">Confirmed income sources</h2>
          <div className="space-y-2">
            {confirmedIncomes.map((i) => (
              <div key={i.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{i.displayName}</span>
                <span className="text-slate-500">
                  {formatCurrency(i.amount)} / {i.cadenceDays}d
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
