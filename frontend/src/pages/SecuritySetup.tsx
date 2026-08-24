import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { registerWebAuthnCredential } from "../lib/webauthn";
import TwoFactorManager from "../components/TwoFactorManager";

export default function SecuritySetup() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [addingPasskey, setAddingPasskey] = useState(false);
  const [passkeyAdded, setPasskeyAdded] = useState(false);
  const [showTwoFactor, setShowTwoFactor] = useState(false);

  async function addPasskey() {
    setError(null);
    setAddingPasskey(true);
    try {
      const nickname = window.prompt("Name this passkey (e.g. \"iPhone\", \"YubiKey\")") || undefined;
      await registerWebAuthnCredential("PASSKEY", nickname);
      setPasskeyAdded(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not register that passkey/security key");
    } finally {
      setAddingPasskey(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900">Secure your account</h1>
          <p className="text-sm text-slate-500 mt-1">
            Optional, but recommended for an account tied to your finances. You can always do this later in
            Settings.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 text-center">{error}</p>}

        <div className="bg-white rounded-lg border p-6 space-y-3">
          <h2 className="text-sm font-medium text-slate-700">Add a passkey</h2>
          <p className="text-xs text-slate-400">
            Sign in with your fingerprint, face, PIN, or a hardware security key instead of a password.
          </p>
          {passkeyAdded ? (
            <p className="text-sm text-emerald-600">Passkey added.</p>
          ) : (
            <button
              onClick={addPasskey}
              disabled={addingPasskey}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md disabled:opacity-50"
            >
              {addingPasskey ? "Waiting for device..." : "Add a passkey"}
            </button>
          )}
        </div>

        {showTwoFactor ? (
          <TwoFactorManager />
        ) : (
          <div className="bg-white rounded-lg border p-6 space-y-3">
            <h2 className="text-sm font-medium text-slate-700">Set up two-factor authentication</h2>
            <p className="text-xs text-slate-400">
              Require an authenticator app code or security key in addition to your password.
            </p>
            <button
              onClick={() => setShowTwoFactor(true)}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-md"
            >
              Set up 2FA
            </button>
          </div>
        )}

        <div className="text-center">
          <button onClick={() => navigate("/")} className="text-sm text-slate-500 hover:text-slate-900">
            {passkeyAdded || showTwoFactor ? "Continue" : "Skip for now"}
          </button>
        </div>
      </div>
    </div>
  );
}
