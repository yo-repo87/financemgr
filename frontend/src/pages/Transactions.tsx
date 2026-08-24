import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  account: { name: string; mask: string | null };
}

export default function Transactions() {
  const [search, setSearch] = useState("");

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["transactions", search],
    queryFn: () =>
      api
        .get("/api/transactions", { params: { search: search || undefined, limit: 200 } })
        .then((r) => r.data),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Transactions</h1>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm w-64"
        />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
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
                  {t.merchantName || t.name}
                  {t.pending && <span className="ml-2 text-xs text-amber-600">pending</span>}
                </td>
                <td className="px-4 py-2 text-slate-500">
                  {t.account.name} •••• {t.account.mask}
                </td>
                <td className="px-4 py-2 text-slate-500">{t.category || "Uncategorized"}</td>
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
