import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { categorical, chrome } from "../lib/chartTheme";

interface CategorySpend {
  category: string;
  total: number;
}

interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
}

// Fixed categorical order per the dataviz palette - the top 7 categories keep
// their slot, everything past that folds into "Other" (slot 8, reserved).
function foldToTop(rows: CategorySpend[]): CategorySpend[] {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  if (sorted.length <= 7) return sorted;
  const top = sorted.slice(0, 7);
  const rest = sorted.slice(7).reduce((sum, r) => sum + r.total, 0);
  return [...top, { category: "Other", total: rest }];
}

export default function Analytics() {
  const { data: byCategory } = useQuery<CategorySpend[]>({
    queryKey: ["spending-by-category"],
    queryFn: () => api.get("/api/analytics/spending-by-category", { params: { days: 30 } }).then((r) => r.data),
  });
  const { data: trend } = useQuery<MonthlyTrend[]>({
    queryKey: ["monthly-trend"],
    queryFn: () => api.get("/api/analytics/monthly-trend", { params: { months: 6 } }).then((r) => r.data),
  });

  const categoryData = byCategory ? foldToTop(byCategory) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Analytics</h1>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-1">Spending by category</h2>
        <p className="text-xs text-slate-400 mb-4">Last 30 days</p>
        {categoryData.length === 0 ? (
          <p className="text-sm text-slate-400">No spending data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, categoryData.length * 40)}>
            <BarChart data={categoryData} layout="vertical" margin={{ left: 16, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} horizontal={false} />
              <XAxis
                type="number"
                tickFormatter={(v) => formatCurrency(v)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={140}
                stroke={chrome.axis}
                tick={{ fill: chrome.primaryText, fontSize: 12 }}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={categorical[i % categorical.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Income vs. expenses</h2>
        <p className="text-xs text-slate-400 mb-4">Last 6 months</p>
        {!trend || trend.length === 0 ? (
          <p className="text-sm text-slate-400">No transaction history yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trend} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
              <XAxis dataKey="month" stroke={chrome.axis} tick={{ fill: chrome.mutedText, fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 12 }}
                width={90}
              />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Income" fill={categorical[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={categorical[1]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
