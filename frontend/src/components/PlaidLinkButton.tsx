import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export default function PlaidLinkButton() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    api
      .post("/api/plaid/link-token")
      .then((res) => setLinkToken(res.data.linkToken))
      .catch((err) => setError(err?.response?.data?.error || "Plaid is not configured yet"));
  }, []);

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      await api.post("/api/plaid/exchange", {
        publicToken,
        institutionName: metadata?.institution?.name,
      });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["plaid-items"] });
    },
    [queryClient]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess,
  });

  if (error) {
    return <p className="text-sm text-amber-600">{error}</p>;
  }

  return (
    <button
      onClick={() => open()}
      disabled={!ready || !linkToken}
      className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
    >
      Connect an account
    </button>
  );
}
