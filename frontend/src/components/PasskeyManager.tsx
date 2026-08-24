import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { registerWebAuthnCredential } from "../lib/webauthn";
import { formatDate } from "../lib/format";

interface Credential {
  id: string;
  nickname: string | null;
  purpose: "PASSKEY" | "SECOND_FACTOR";
  createdAt: string;
  lastUsedAt: string | null;
}

export default function PasskeyManager() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: credentials } = useQuery<Credential[]>({
    queryKey: ["webauthn-credentials"],
    queryFn: () => api.get("/api/auth/webauthn/credentials").then((r) => r.data),
  });
  const passkeys = (credentials ?? []).filter((c) => c.purpose === "PASSKEY");

  const removeMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/auth/webauthn/credentials/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] }),
  });

  async function addPasskey() {
    setError(null);
    setAdding(true);
    try {
      const nickname = window.prompt("Name this passkey (e.g. \"iPhone\", \"YubiKey\")") || undefined;
      await registerWebAuthnCredential("PASSKEY", nickname);
      queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not register that passkey/security key");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-700">Passkeys &amp; security keys</h2>
          <p className="text-xs text-slate-400 mt-1">
            Sign in without a password using a fingerprint, face scan, PIN, or hardware security key.
          </p>
        </div>
        <button
          onClick={addPasskey}
          disabled={adding}
          className="bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
        >
          {adding ? "Waiting for device..." : "Add a passkey"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {passkeys.length === 0 ? (
        <p className="text-sm text-slate-400">No passkeys registered yet.</p>
      ) : (
        <ul className="divide-y">
          {passkeys.map((c) => (
            <li key={c.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-slate-900">{c.nickname || "Passkey"}</p>
                <p className="text-xs text-slate-400">
                  Added {formatDate(c.createdAt)}
                  {c.lastUsedAt ? ` · last used ${formatDate(c.lastUsedAt)}` : ""}
                </p>
              </div>
              <button
                onClick={() => removeMutation.mutate(c.id)}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
