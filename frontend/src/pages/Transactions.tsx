import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";

interface Transaction {
  id: string;
  amount: string;
  date: string;
  name: string;
  merchantName: string | null;
  category: string | null;
  pending: boolean;
  isRecurring: boolean;
  account: { name: string; mask: string | null };
}

function RecurringBadge() {
  return (
    <span
      title="Matches a detected recurring subscription - check for duplicate charges or a trial that converted"
      className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3">
        <path d="M17 2.1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12.1v-2a4 4 0 0 1 4-4h14" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 21.9l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M21 11.9v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Subscription
    </span>
  );
}

export default function Transactions() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      api.patch(`/api/transactions/${id}/category`, { category }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
    },
  });

  function editCategory(t: Transaction) {
    const next = window.prompt(
      `Category for "${t.merchantName || t.name}" (applies to future charges from this merchant too):`,
      t.category || ""
    );
    if (next && next.trim() && next.trim() !== t.category) {
      updateCategoryMutation.mutate({ id: t.id, category: next.trim() });
    }
  }

  const { data: categories } = useQuery<string[]>({
    queryKey: ["transaction-categories"],
    queryFn: () => api.get("/api/transactions/categories").then((r) => r.data),
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["transactions", search, category, from, to],
    queryFn: () =>
      api
        .get("/api/transactions", {
          params: {
            search: search || undefined,
            category: category || undefined,
            from: from || undefined,
            to: to || undefined,
            limit: 200,
          },
        })
        .then((r) => r.data),
  });

  const hasFilters = Boolean(search || category || from || to);
  function clearFilters() {
    setSearch("");
    setCategory("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Transactions</h1>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-2 sm:py-1.5 text-sm w-full sm:w-64"
        />
      </div>

      <div className="bg-white rounded-lg border p-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border rounded-md px-3 py-2 sm:py-1.5 text-sm bg-white"
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-full border rounded-md px-3 py-2 sm:py-1.5 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-full border rounded-md px-3 py-2 sm:py-1.5 text-sm"
          />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm text-slate-500 hover:text-slate-900 sm:pb-1.5">
            Clear filters
          </button>
        )}
      </div>

      {/* Phone: card list */}
      <div className="md:hidden space-y-2">
        {(transactions ?? []).map((t) => (
          <div key={t.id} className="bg-white rounded-lg border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-medium text-slate-900 truncate">{t.merchantName || t.name}</p>
                  {t.pending && <span className="text-xs text-amber-600">pending</span>}
                  {t.isRecurring && <RecurringBadge />}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {formatDate(t.date)} · {t.account.name} •••• {t.account.mask}
                </p>
                <button
                  onClick={() => editCategory(t)}
                  className="text-xs text-slate-400 underline decoration-dotted underline-offset-2"
                >
                  {t.category || "Uncategorized"}
                </button>
              </div>
              <p className={`text-sm font-medium whitespace-nowrap ${Number(t.amount) > 0 ? "text-slate-900" : "text-emerald-600"}`}>
                {formatCurrency(t.amount)}
              </p>
            </div>
          </div>
        ))}
        {transactions && transactions.length === 0 && (
          <p className="bg-white rounded-lg border px-4 py-8 text-center text-slate-400 text-sm">
            No transactions found.
          </p>
        )}
      </div>

      {/* Tablet/desktop: table */}
      <div className="hidden md:block bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(transactions ?? []).map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-slate-500">{formatDate(t.date)}</td>
                <td className="px-4 py-2 text-slate-900">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{t.merchantName || t.name}</span>
                    {t.pending && <span className="text-xs text-amber-600">pending</span>}
                    {t.isRecurring && <RecurringBadge />}
                  </div>
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {t.account.name} •••• {t.account.mask}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  <button
                    onClick={() => editCategory(t)}
                    className="underline decoration-dotted underline-offset-2 hover:text-slate-900"
                  >
                    {t.category || "Uncategorized"}
                  </button>
                </td>
                <td className={`px-4 py-2 text-right font-medium ${Number(t.amount) > 0 ? "text-slate-900" : "text-emerald-600"}`}>
                  {formatCurrency(t.amount)}
                </td>
              </tr>
            ))}
            {transactions && transactions.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
