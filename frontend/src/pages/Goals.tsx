import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import { status, categorical } from "../lib/chartTheme";

interface Contribution {
  id: string;
  amount: string;
  date: string;
  note: string | null;
}

interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  targetDate: string | null;
  savedAmount: number;
  contributions: Contribution[];
}

interface Forecast {
  suggestedSafeToSave: number;
}

function ContributeForm({ goalId, onDone }: { goalId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const mutation = useMutation({
    mutationFn: () => api.post(`/api/goals/${goalId}/contributions`, { amount, date }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      onDone();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (Number(amount) > 0) mutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2 mt-2">
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 border rounded-md px-2 py-1.5 text-sm"
        autoFocus
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border rounded-md px-2 py-1.5 text-sm"
      />
      <button type="submit" className="text-sm font-medium text-emerald-600" disabled={mutation.isPending}>
        Add
      </button>
      <button type="button" onClick={onDone} className="text-sm text-slate-400">
        Cancel
      </button>
    </form>
  );
}

export default function Goals() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [contributingTo, setContributingTo] = useState<string | null>(null);

  const { data: goals } = useQuery<Goal[]>({
    queryKey: ["goals"],
    queryFn: () => api.get("/api/goals").then((r) => r.data),
  });

  const { data: forecast } = useQuery<Forecast>({
    queryKey: ["cashflow-forecast"],
    queryFn: () => api.get("/api/cashflow/forecast", { params: { days: 30 } }).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/api/goals", { name, targetAmount, targetDate: targetDate || undefined }),
    onSuccess: () => {
      setName("");
      setTargetAmount("");
      setTargetDate("");
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/goals/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["goals"] }),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (name.trim() && Number(targetAmount) > 0) createMutation.mutate();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">Savings Goals</h1>

      {forecast && forecast.suggestedSafeToSave > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
          Based on your cash flow forecast, you could safely set aside about{" "}
          <span className="font-semibold">{formatCurrency(forecast.suggestedSafeToSave)}</span> toward a goal right
          now without risking your low-balance buffer.
        </div>
      )}

      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-4 flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-500 mb-1">Goal name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Emergency fund"
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div className="sm:w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">Target amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div className="sm:w-40">
          <label className="block text-xs font-medium text-slate-500 mb-1">Target date (optional)</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          className="bg-slate-900 text-white rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium min-h-[44px] sm:min-h-0"
        >
          Add goal
        </button>
      </form>

      <div className="space-y-3">
        {(goals ?? []).map((g) => {
          const target = Number(g.targetAmount);
          const pct = Math.min(100, (g.savedAmount / target) * 100);
          const complete = g.savedAmount >= target;
          return (
            <div key={g.id} className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-slate-900">{g.name}</p>
                  {g.targetDate && <p className="text-xs text-slate-400">by {formatDate(g.targetDate)}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-500">
                    {formatCurrency(g.savedAmount)} / {formatCurrency(target)}
                  </p>
                  <button onClick={() => deleteMutation.mutate(g.id)} className="text-xs text-red-500 hover:text-red-700">
                    Remove
                  </button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: complete ? status.good : categorical[0] }}
                />
              </div>
              {contributingTo === g.id ? (
                <ContributeForm goalId={g.id} onDone={() => setContributingTo(null)} />
              ) : (
                <button
                  onClick={() => setContributingTo(g.id)}
                  className="text-xs text-slate-500 underline decoration-dotted underline-offset-2 mt-2"
                >
                  Log a contribution
                </button>
              )}
            </div>
          );
        })}
        {goals && goals.length === 0 && <p className="text-sm text-slate-400">No savings goals yet.</p>}
      </div>
    </div>
  );
}
