import { useState, useEffect, FormEvent } from "react";
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

interface BudgetSuggestion {
  category: string;
  avgMonthlySpend: number;
  suggestedLimit: number;
  currentLimit: number | null;
}

interface SuggestionRow {
  checked: boolean;
  limit: string;
}

function SuggestBudgets({ onApplied }: { onApplied: () => void }) {
  const { data: suggestions, isLoading } = useQuery<BudgetSuggestion[]>({
    queryKey: ["budget-suggestions"],
    queryFn: () => api.get("/api/budgets/suggestions").then((r) => r.data),
  });
  const [rows, setRows] = useState<Record<string, SuggestionRow>>({});
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!suggestions) return;
    setRows((prev) => {
      const next: Record<string, SuggestionRow> = {};
      for (const s of suggestions) {
        next[s.category] = prev[s.category] ?? {
          // Pre-select categories with no existing budget yet; leave already-budgeted
          // ones unchecked so applying never silently overwrites a deliberate choice.
          checked: s.currentLimit === null,
          limit: String(s.suggestedLimit),
        };
      }
      return next;
    });
  }, [suggestions]);

  async function applySelected() {
    setError(null);
    setApplying(true);
    try {
      const selected = Object.entries(rows).filter(([, r]) => r.checked && Number(r.limit) > 0);
      await Promise.all(
        selected.map(([category, r]) => api.post("/api/budgets", { category, monthlyLimit: r.limit }))
      );
      onApplied();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not apply budgets");
    } finally {
      setApplying(false);
    }
  }

  const selectedCount = Object.values(rows).filter((r) => r.checked).length;

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Suggested budgets</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Based on your average monthly spend per category over the last 3 months. Adjust any amount before
          applying, or uncheck ones you don't want.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading && <p className="text-sm text-slate-400">Crunching your spending history...</p>}
      {suggestions && suggestions.length === 0 && (
        <p className="text-sm text-slate-400">Not enough transaction history yet to suggest budgets.</p>
      )}

      {suggestions && suggestions.length > 0 && (
        <div className="divide-y">
          {suggestions.map((s) => {
            const row = rows[s.category];
            if (!row) return null;
            return (
              <div key={s.category} className="py-2.5 flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) =>
                    setRows((r) => ({ ...r, [s.category]: { ...r[s.category], checked: e.target.checked } }))
                  }
                  className="w-4 h-4"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">{s.category}</p>
                  <p className="text-xs text-slate-400">
                    Avg {formatCurrency(s.avgMonthlySpend)}/mo
                    {s.currentLimit !== null && ` · current budget ${formatCurrency(s.currentLimit)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-slate-400">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={row.limit}
                    onChange={(e) =>
                      setRows((r) => ({ ...r, [s.category]: { ...r[s.category], limit: e.target.value } }))
                    }
                    className="w-24 border rounded-md px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {suggestions && suggestions.length > 0 && (
        <button
          onClick={applySelected}
          disabled={applying || selectedCount === 0}
          className="bg-slate-900 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {applying ? "Applying..." : `Apply ${selectedCount} budget${selectedCount === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  );
}

export default function Budgets() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

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

  function onSuggestionsApplied() {
    setShowSuggestions(false);
    queryClient.invalidateQueries({ queryKey: ["budgets"] });
    queryClient.invalidateQueries({ queryKey: ["budget-vs-actual"] });
    queryClient.invalidateQueries({ queryKey: ["budget-suggestions"] });
  }

  const actualsByCategory = new Map((actuals ?? []).map((a) => [a.category, a]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Budgets</h1>
        {!showSuggestions && (
          <button
            onClick={() => setShowSuggestions(true)}
            className="w-full sm:w-auto border border-slate-300 text-slate-900 rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium min-h-[44px] sm:min-h-0"
          >
            Suggest budgets
          </button>
        )}
      </div>

      {showSuggestions && <SuggestBudgets onApplied={onSuggestionsApplied} />}

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
