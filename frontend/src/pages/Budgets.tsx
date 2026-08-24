import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import { status } from "../lib/chartTheme";

interface Budget {
  id: string;
  category: string;
  monthlyLimit: string;
}

interface BudgetVsActual {
  category: string;
  limit: number;
  spent: number;
}

export default function Budgets() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");

  const { data: budgets } = useQuery<Budget[]>({
    queryKey: ["budgets"],
    queryFn: () => api.get("/api/budgets").then((r) => r.data),
  });
  const { data: actuals } = useQuery<BudgetVsActual[]>({
    queryKey: ["budget-vs-actual"],
    queryFn: () => api.get("/api/analytics/budget-vs-actual").then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: () => api.post("/api/budgets", { category, monthlyLimit: limit }),
    onSuccess: () => {
      setCategory("");
      setLimit("");
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/budgets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (category.trim() && limit) saveMutation.mutate();
  }

  const actualsByCategory = new Map((actuals ?? []).map((a) => [a.category, a]));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Budgets</h1>

      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Groceries"
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div className="sm:w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">Monthly limit</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-slate-900 text-white rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium min-h-[44px] sm:min-h-0"
        >
          Save budget
        </button>
      </form>

      <div className="space-y-3">
        {(budgets ?? []).map((b) => {
          const actual = actualsByCategory.get(b.category);
          const spent = actual?.spent ?? 0;
          const pct = Math.min(100, (spent / Number(b.monthlyLimit)) * 100);
          const over = spent > Number(b.monthlyLimit);
          return (
            <div key={b.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-slate-900">{b.category}</p>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500">
                    {formatCurrency(spent)} / {formatCurrency(b.monthlyLimit)}
                  </p>
                  <button onClick={() => deleteMutation.mutate(b.id)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: over ? status.critical : status.good }}
                />
              </div>
            </div>
          );
        })}
        {budgets && budgets.length === 0 && <p className="text-sm text-slate-400">No budgets set yet.</p>}
      </div>
    </div>
  );
}
