import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { registerWebAuthnCredential } from "../lib/webauthn";

interface Status {
  totpEnabled: boolean;
  securityKeyCount: number;
  backupCodesRemaining: number;
}

interface Credential {
  id: string;
  nickname: string | null;
  purpose: "PASSKEY" | "SECOND_FACTOR";
}

function BackupCodesReveal({ codes, onDismiss }: { codes: string[]; onDismiss: () => void }) {
  return (
    <div className="border border-amber-300 bg-amber-50 rounded-md p-4 space-y-3">
      <p className="text-sm font-medium text-amber-900">
        Save these backup codes now — each works once, and this is the only time they'll be shown.
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-sm text-amber-900">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <button
        onClick={onDismiss}
        className="text-sm font-medium text-amber-900 underline underline-offset-2"
      >
        I've saved these codes
      </button>
    </div>
  );
}

export default function TwoFactorManager() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<string[] | null>(null);
  const [totpSetup, setTotpSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [addingKey, setAddingKey] = useState(false);

  const { data: status } = useQuery<Status>({
    queryKey: ["two-factor-status"],
    queryFn: () => api.get("/api/auth/2fa/status").then((r) => r.data),
  });
  const { data: credentials } = useQuery<Credential[]>({
    queryKey: ["webauthn-credentials"],
    queryFn: () => api.get("/api/auth/webauthn/credentials").then((r) => r.data),
  });
  const securityKeys = (credentials ?? []).filter((c) => c.purpose === "SECOND_FACTOR");

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["two-factor-status"] });
    queryClient.invalidateQueries({ queryKey: ["webauthn-credentials"] });
  }

  const setupMutation = useMutation({
    mutationFn: () => api.post("/api/auth/2fa/totp/setup"),
    onSuccess: (res) => {
      setError(null);
      setTotpSetup(res.data);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.post("/api/auth/2fa/totp/confirm", { code: totpCode }),
    onSuccess: (res) => {
      setError(null);
      setTotpSetup(null);
      setTotpCode("");
      if (res.data.backupCodes) setRevealedCodes(res.data.backupCodes);
      invalidateAll();
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Invalid code"),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => api.post("/api/auth/2fa/totp/disable", { password }),
    onSuccess: () => {
      setError(null);
      invalidateAll();
    },
    onError: (err: any) => setError(err?.response?.data?.error || "Could not disable"),
  });

  const removeKeyMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/auth/webauthn/credentials/${id}`),
    onSuccess: invalidateAll,
  });

  const regenerateMutation = useMutation({
    mutationFn: () => api.post("/api/auth/2fa/backup-codes/regenerate"),
    onSuccess: (res) => {
      setRevealedCodes(res.data.backupCodes);
      invalidateAll();
    },
  });

  async function addSecurityKey() {
    setError(null);
    setAddingKey(true);
    try {
      const nickname = window.prompt("Name this security key (e.g. \"YubiKey\")") || undefined;
      const result = await registerWebAuthnCredential("SECOND_FACTOR", nickname);
      if (result.backupCodes) setRevealedCodes(result.backupCodes);
      invalidateAll();
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not register that security key");
    } finally {
      setAddingKey(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-6 space-y-6">
      <div>
        <h2 className="text-sm font-medium text-slate-700">Two-factor authentication</h2>
        <p className="text-xs text-slate-400 mt-1">
          When enabled, signing in with your password also requires a code or security key.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {revealedCodes && <BackupCodesReveal codes={revealedCodes} onDismiss={() => setRevealedCodes(null)} />}

      {/* Authenticator app (TOTP) */}
      <div className="border-t pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Authenticator app</p>
          {status?.totpEnabled ? (
            <button
              onClick={() => {
                const password = window.prompt("Confirm your password to disable 2FA");
                if (password) disableMutation.mutate(password);
              }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Disable
            </button>
          ) : !totpSetup ? (
            <button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Set up
            </button>
          ) : null}
        </div>

        {status?.totpEnabled && <p className="text-xs text-emerald-600">Enabled</p>}

        {totpSetup && (
          <div className="space-y-3">
            <img src={totpSetup.qrCodeDataUrl} alt="Scan with your authenticator app" className="w-40 h-40" />
            <p className="text-xs text-slate-400">
              Or enter this key manually: <span className="font-mono">{totpSetup.secret}</span>
            </p>
            <div className="flex gap-2">
              <input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                placeholder="6-digit code"
                className="border rounded-md px-3 py-1.5 text-sm w-32"
              />
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={confirmMutation.isPending || totpCode.length < 6}
                className="bg-slate-900 text-white text-sm font-medium px-3 py-1.5 rounded-md disabled:opacity-50"
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Security key as 2FA */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">Security key</p>
          <button
            onClick={addSecurityKey}
            disabled={addingKey}
            className="text-xs text-slate-600 hover:text-slate-900"
          >
            {addingKey ? "Waiting for device..." : "Add a security key"}
          </button>
        </div>
        {securityKeys.length === 0 ? (
          <p className="text-xs text-slate-400">No security keys registered for 2FA.</p>
        ) : (
          <ul className="divide-y">
            {securityKeys.map((k) => (
              <li key={k.id} className="py-1.5 flex items-center justify-between text-sm">
                <span>{k.nickname || "Security key"}</span>
                <button
                  onClick={() => removeKeyMutation.mutate(k.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Backup codes */}
      <div className="border-t pt-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">Backup codes</p>
          <p className="text-xs text-slate-400">{status?.backupCodesRemaining ?? 0} unused codes remaining</p>
        </div>
        <button
          onClick={() => regenerateMutation.mutate()}
          disabled={regenerateMutation.isPending}
          className="text-xs text-slate-600 hover:text-slate-900"
        >
          Generate new codes
        </button>
      </div>
    </div>
  );
}
