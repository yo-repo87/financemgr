import { useState, FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bill,
  BillInput,
  BillPayment,
  BillRecurrence,
  fetchBills,
  fetchBillPayments,
  createBill,
  updateBill,
  deleteBill,
  markBillPaid,
  markBillUnpaid,
} from "../lib/bills";
import { formatCurrency, formatDate } from "../lib/format";
import { status } from "../lib/chartTheme";

const RECURRENCE_LABELS: Record<BillRecurrence, string> = {
  ONE_TIME: "One time",
  WEEKLY: "Weekly",
  BIWEEKLY: "Every 2 weeks",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

const EMPTY_FORM: BillInput = {
  name: "",
  amount: "",
  category: "",
  recurrence: "MONTHLY",
  anchorDueDate: "",
  autoDetectKeyword: "",
};

function BillForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial: BillInput & { id?: string };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<BillInput>(initial);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () => (initial.id ? updateBill(initial.id, form) : createBill(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-upcoming"] });
      onSaved();
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Could not save bill"),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    saveMutation.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border p-4 space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Rent"
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Recurrence</label>
          <select
            value={form.recurrence}
            onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value as BillRecurrence }))}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm bg-white"
          >
            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {form.recurrence === "ONE_TIME" ? "Due date" : "First due date"}
          </label>
          <input
            required
            type="date"
            value={form.anchorDueDate}
            onChange={(e) => setForm((f) => ({ ...f, anchorDueDate: e.target.value }))}
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Category (optional)</label>
          <input
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            placeholder="e.g. Housing"
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Auto-detect keyword (optional)</label>
          <input
            value={form.autoDetectKeyword}
            onChange={(e) => setForm((f) => ({ ...f, autoDetectKeyword: e.target.value }))}
            placeholder='e.g. "flex"'
            className="w-full border rounded-md px-3 py-2.5 sm:py-2 text-sm"
          />
        </div>
      </div>
      <p className="text-xs text-slate-400">
        If a synced transaction's name matches the auto-detect keyword, this bill's next due cycle is marked paid
        automatically — e.g. "flex" catches Flex rent-split withdrawals once your bank account is connected.
      </p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saveMutation.isPending}
          className="bg-slate-900 text-white rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium disabled:opacity-50 min-h-[44px] sm:min-h-0"
        >
          {saveMutation.isPending ? "Saving..." : "Save bill"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-500 hover:text-slate-900 min-h-[44px] sm:min-h-0"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function PaymentHistory({ billId }: { billId: string }) {
  const queryClient = useQueryClient();
  const { data: payments } = useQuery<BillPayment[]>({
    queryKey: ["bill-payments", billId],
    queryFn: () => fetchBillPayments(billId),
  });

  const unmarkMutation = useMutation({
    mutationFn: (dueDate: string) => markBillUnpaid(billId, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bill-payments", billId] });
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-upcoming"] });
    },
  });

  if (!payments) return null;
  if (payments.length === 0) {
    return <p className="text-xs text-slate-400 px-4 pb-4">No payments recorded yet.</p>;
  }

  return (
    <ul className="divide-y border-t">
      {payments.map((p) => (
        <li key={p.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
          <div>
            <p className="text-slate-900">{formatDate(p.dueDate)}</p>
            <p className="text-xs text-slate-400">
              {p.transactionId ? "Auto-detected" : "Marked paid manually"}
              {p.transaction ? ` · ${p.transaction.merchantName || p.transaction.name}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-600">{formatCurrency(p.amountPaid)}</span>
            <button
              onClick={() => unmarkMutation.mutate(p.dueDate)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Undo
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Bills() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const { data: bills } = useQuery<Bill[]>({ queryKey: ["bills"], queryFn: fetchBills });

  const markPaidMutation = useMutation({
    mutationFn: ({ billId, dueDate }: { billId: string; dueDate: string }) => markBillPaid(billId, dueDate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-upcoming"] });
      queryClient.invalidateQueries({ queryKey: ["bill-payments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBill(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bills"] });
      queryClient.invalidateQueries({ queryKey: ["bills-upcoming"] });
    },
  });

  function openAddForm() {
    setEditingBill(null);
    setShowForm(true);
  }

  function openEditForm(bill: Bill) {
    setEditingBill(bill);
    setShowForm(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">Bills</h1>
        {!showForm && (
          <button
            onClick={openAddForm}
            className="w-full sm:w-auto bg-slate-900 text-white rounded-md px-4 py-2.5 sm:py-2 text-sm font-medium min-h-[44px] sm:min-h-0"
          >
            Add a bill
          </button>
        )}
      </div>

      {showForm && (
        <BillForm
          initial={
            editingBill
              ? {
                  id: editingBill.id,
                  name: editingBill.name,
                  amount: editingBill.amount,
                  category: editingBill.category ?? "",
                  recurrence: editingBill.recurrence,
                  anchorDueDate: editingBill.anchorDueDate.slice(0, 10),
                  autoDetectKeyword: editingBill.autoDetectKeyword ?? "",
                }
              : EMPTY_FORM
          }
          onCancel={() => setShowForm(false)}
          onSaved={() => setShowForm(false)}
        />
      )}

      <div className="space-y-3">
        {(bills ?? []).map((b) => (
          <div key={b.id} className="bg-white rounded-lg border">
            <div className="p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-slate-900">{b.name}</p>
                  {b.category && <span className="text-xs text-slate-400">{b.category}</span>}
                  {b.autoDetectKeyword && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      auto: {b.autoDetectKeyword}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {RECURRENCE_LABELS[b.recurrence]}
                  {b.currentCycle && (
                    <>
                      {" · "}
                      <span style={{ color: b.currentCycle.isOverdue ? status.critical : undefined }}>
                        {b.currentCycle.isPaid ? "Paid" : b.currentCycle.isOverdue ? "Overdue" : "Due"}{" "}
                        {formatDate(b.currentCycle.dueDate)}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900 whitespace-nowrap">{formatCurrency(b.amount)}</p>
            </div>

            <div className="px-4 pb-4 flex flex-wrap items-center gap-3 text-xs">
              {b.currentCycle && !b.currentCycle.isPaid && (
                <button
                  onClick={() => markPaidMutation.mutate({ billId: b.id, dueDate: b.currentCycle!.dueDate })}
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  Mark paid
                </button>
              )}
              <button
                onClick={() => setExpandedBillId(expandedBillId === b.id ? null : b.id)}
                className="text-slate-500 hover:text-slate-900"
              >
                {expandedBillId === b.id ? "Hide history" : "View history"}
              </button>
              <button onClick={() => openEditForm(b)} className="text-slate-500 hover:text-slate-900">
                Edit
              </button>
              <button
                onClick={() => {
                  if (confirm(`Delete "${b.name}"? This also removes its payment history.`)) {
                    deleteMutation.mutate(b.id);
                  }
                }}
                className="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>

            {expandedBillId === b.id && <PaymentHistory billId={b.id} />}
          </div>
        ))}
        {bills && bills.length === 0 && !showForm && (
          <p className="bg-white rounded-lg border px-4 py-8 text-center text-slate-400 text-sm">
            No bills yet. Add rent or any recurring payment to start tracking due dates.
          </p>
        )}
      </div>
    </div>
  );
}
