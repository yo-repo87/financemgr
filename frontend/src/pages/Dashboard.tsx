import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { chrome, sequentialBlue } from "../lib/chartTheme";

interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  currentBalance: string | null;
  plaidItem: { institutionName: string | null };
}

interface NetWorthPoint {
  date: string;
  netWorth: number;
}

export default function Dashboard() {
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/api/accounts").then((r) => r.data),
  });
  const { data: trend } = useQuery<NetWorthPoint[]>({
    queryKey: ["net-worth-trend"],
    queryFn: () => api.get("/api/analytics/net-worth-trend").then((r) => r.data),
  });

  const netWorth = (accounts ?? []).reduce((sum, a) => {
    const balance = Number(a.currentBalance ?? 0);
    return sum + (a.type === "credit" || a.type === "loan" ? -balance : balance);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border p-6">
        <p className="text-sm text-slate-500">Net worth</p>
        <p className="text-4xl font-semibold text-slate-900 mt-1">{formatCurrency(netWorth)}</p>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Net worth over time</h2>
        {!trend || trend.length < 2 ? (
          <p className="text-sm text-slate-400">
            Not enough history yet — net worth is recorded each time your accounts sync.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend} margin={{ left: 8, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chrome.gridline} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => formatDate(d)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 12 }}
              />
              <YAxis
                tickFormatter={(v) => formatCurrency(v)}
                stroke={chrome.axis}
                tick={{ fill: chrome.mutedText, fontSize: 12 }}
                width={90}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                labelFormatter={(d) => formatDate(d as string)}
              />
              <Line
                type="monotone"
                dataKey="netWorth"
                stroke={sequentialBlue[450]}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-sm font-medium text-slate-700 mb-4">Accounts</h2>
        {!accounts || accounts.length === 0 ? (
          <p className="text-sm text-slate-400">No accounts connected yet. Head to the Accounts page to connect one.</p>
        ) : (
          <ul className="divide-y">
            {accounts.map((a) => (
              <li key={a.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{a.name}</p>
                  <p className="text-xs text-slate-400">
                    {a.plaidItem.institutionName} •••• {a.mask}
                  </p>
                </div>
                <p className="text-sm font-medium text-slate-900">{formatCurrency(a.currentBalance)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
