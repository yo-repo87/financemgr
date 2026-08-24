import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { formatCurrency, formatDate } from "../lib/format";
import PlaidLinkButton from "../components/PlaidLinkButton";

interface CreditCardDetail {
  lastStatementIssueDate: string | null;
  estimatedNextClosingDate: string | null;
  lastStatementBalance: string | null;
  minimumPaymentAmount: string | null;
  nextPaymentDueDate: string | null;
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
  plaidItem: { institutionName: string | null };
}

interface PlaidItem {
  id: string;
  institutionName: string | null;
  status: string;
  lastSyncedAt: string | null;
}

export default function Accounts() {
  const queryClient = useQueryClient();
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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Accounts</h1>
        <PlaidLinkButton />
      </div>

      {items && items.length > 0 && (
        <div className="bg-white rounded-lg border p-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-700 mb-2">Connected institutions</h2>
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between text-sm">
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
          </div>
        ))}
      </div>
    </div>
  );
}
