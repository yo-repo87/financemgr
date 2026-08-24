import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { categorical } from "../lib/chartTheme";
import PlaidLinkButton from "../components/PlaidLinkButton";

interface CreditCardDetail {
  lastStatementIssueDate: string | null;
  estimatedNextClosingDate: string | null;
  lastStatementBalance: string | null;
  minimumPaymentAmount: string | null;
  nextPaymentDueDate: string | null;
}

interface Holding {
  id: string;
  symbol: string | null;
  name: string;
  quantity: string;
  costBasis: string | null;
  currentPrice: string | null;
  currentValue: string | null;
}

interface Account {
  id: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  creditLimit: string | null;
  creditCardDetail: CreditCardDetail | null;
  holdings: Holding[];
  plaidItem: { institutionName: string | null };
}

// Fixed categorical order per the dataviz palette - top 7 holdings by value
// keep their slot, everything past that folds into "Other" (slot 8, reserved).
function foldHoldings(holdings: Holding[]): { name: string; value: number }[] {
  const sorted = [...holdings].sort((a, b) => Number(b.currentValue ?? 0) - Number(a.currentValue ?? 0));
  const top = sorted.slice(0, 7).map((h) => ({ name: h.symbol || h.name, value: Number(h.currentValue ?? 0) }));
  if (sorted.length <= 7) return top;
  const rest = sorted.slice(7).reduce((sum, h) => sum + Number(h.currentValue ?? 0), 0);
  return [...top, { name: "Other", value: rest }];
}

function HoldingsSection({ holdings }: { holdings: Holding[] }) {
  const pieData = foldHoldings(holdings);
  return (
    <div className="mt-2">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 divide-y">
          {holdings.map((h) => {
            const value = Number(h.currentValue ?? 0);
            const cost = h.costBasis != null ? Number(h.costBasis) : null;
            const gainLoss = cost != null ? value - cost : null;
            return (
              <div key={h.id} className="py-2 flex items-center justify-between text-xs">
                <div>
                  <p className="font-medium text-slate-900">{h.symbol || h.name}</p>
                  <p className="text-slate-400">{Number(h.quantity)} shares</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{formatCurrency(value)}</p>
                  {gainLoss !== null && (
                    <p className={gainLoss >= 0 ? "text-emerald-600" : "text-red-600"}>
                      {gainLoss >= 0 ? "+" : ""}
                      {formatCurrency(gainLoss)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {pieData.length > 1 && (
          <div className="w-full sm:w-40 h-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={35} outerRadius={60} paddingAngle={2}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={categorical[i % categorical.length]} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

interface PlaidItem {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
}

export default function Accounts() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => api.get("/api/accounts").then((r) => r.data),
  });
  const { data: items } = useQuery<PlaidItem[]>({
    queryKey: ["plaid-items"],
    queryFn: () => api.get("/api/plaid/items").then((r) => r.data),
  });

  const syncMutation = useMutation({
    mutationFn: (itemId: string) => api.post(`/api/plaid/items/${itemId}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["plaid-items"] });
      queryClient.invalidateQueries({ queryKey: ["net-worth-trend"] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => api.delete(`/api/plaid/items/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["plaid-items"] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Accounts</h1>
        <PlaidLinkButton />
      </div>

      {items && items.length > 0 && (
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-700 mb-2">Connected institutions</h2>
          {items.map((item) => (
            <div key={item.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 text-sm">
              <div>
                <span className="font-medium text-slate-900">{item.institutionName || "Unknown institution"}</span>
                <span className="text-slate-400 ml-2">
                  {item.lastSyncedAt ? `synced ${formatDate(item.lastSyncedAt)}` : "never synced"}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => syncMutation.mutate(item.id)}
                  disabled={syncMutation.isPending}
                  className="text-slate-600 hover:text-slate-900"
                >
                  Sync now
                </button>
                <button
                  onClick={() => {
                    if (confirm("Disconnect this institution? This removes its accounts and transaction history.")) {
                      removeMutation.mutate(item.id);
                    }
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(accounts ?? []).map((a) => (
          <div key={a.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-slate-900">{a.name}</p>
                <p className="text-xs text-slate-400">
                  {a.plaidItem.institutionName} •••• {a.mask} · {a.subtype || a.type}
                </p>
              </div>
              <p className="text-lg font-semibold text-slate-900">{formatCurrency(a.currentBalance)}</p>
            </div>

            {a.creditCardDetail && (
              <div className="mt-3 pt-3 border-t text-xs text-slate-500 space-y-1">
                <p>
                  Last statement balance:{" "}
                  <span className="font-medium text-slate-700">{formatCurrency(a.creditCardDetail.lastStatementBalance)}</span>
                </p>
                <p>
                  Minimum payment:{" "}
                  <span className="font-medium text-slate-700">{formatCurrency(a.creditCardDetail.minimumPaymentAmount)}</span>
                  {" due "}
                  <span className="font-medium text-slate-700">{formatDate(a.creditCardDetail.nextPaymentDueDate)}</span>
                </p>
                <p>
                  Estimated next statement close:{" "}
                  <span className="font-medium text-slate-700">
                    {formatDate(a.creditCardDetail.estimatedNextClosingDate)}
                  </span>{" "}
                  <span className="text-slate-400">(estimate — Plaid does not guarantee this date)</span>
                </p>
              </div>
            )}

            {a.holdings.length > 0 && (
              <>
                <button
                  onClick={() => toggleExpanded(a.id)}
                  className="mt-3 pt-3 border-t w-full text-left text-xs font-medium text-slate-500 flex items-center justify-between"
                >
                  <span>{a.holdings.length} holding{a.holdings.length === 1 ? "" : "s"}</span>
                  <span>{expanded.has(a.id) ? "Hide" : "Show"}</span>
                </button>
                {expanded.has(a.id) && <HoldingsSection holdings={a.holdings} />}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
