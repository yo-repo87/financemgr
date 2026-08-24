import { useState, FormEvent } from "react";
import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api } from "../lib/api";
import { loginWithPasskey, verifyWebAuthnSecondFactor } from "../lib/webauthn";
import OAuthButtons from "../components/OAuthButtons";

type Step = "password" | "totp" | "backup_code";

export default function Login() {
  const { login, completeLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const passwordResetSuccess = Boolean((location.state as { passwordResetSuccess?: boolean } | null)?.passwordResetSuccess);
  const oauthError = searchParams.get("oauth_error") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<Step>("password");
  const [methods, setMethods] = useState<string[]>([]);

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.requiresTwoFactor) {
        setMethods(result.methods);
        setStep(result.methods.includes("totp") ? "totp" : "backup_code");
      } else {
        navigate("/");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const endpoint = step === "totp" ? "/api/auth/2fa/verify-totp" : "/api/auth/2fa/verify-backup-code";
      const { data } = await api.post(endpoint, { code });
      completeLogin(data);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Invalid code");
    } finally {
      setSubmitting(false);
    }
  }

  async function onSecurityKey() {
    setError(null);
    setSubmitting(true);
    try {
      const user = await verifyWebAuthnSecondFactor();
      completeLogin(user);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Could not verify security key");
    } finally {
      setSubmitting(false);
    }
  }

  async function onPasskeyLogin() {
    setError(null);
    setSubmitting(true);
    try {
      const user = await loginWithPasskey();
      completeLogin(user);
      navigate("/");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Passkey sign-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (step !== "password") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <form onSubmit={onCodeSubmit} className="bg-white p-8 rounded-lg shadow-sm border w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-slate-900">Verify it's you</h1>
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {step === "totp" ? "Authenticator code" : "Backup code"}
            </label>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={step === "totp" ? "6-digit code" : "XXXX-XXXX"}
              className="w-full border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Verifying..." : "Verify"}
          </button>

          <div className="text-sm text-slate-500 text-center space-x-3">
            {methods.includes("webauthn") && (
              <button type="button" onClick={onSecurityKey} className="text-slate-900 font-medium">
                Use security key
              </button>
            )}
            {step === "totp" && methods.includes("backup_code") && (
              <button type="button" onClick={() => setStep("backup_code")} className="text-slate-900 font-medium">
                Use a backup code
              </button>
            )}
            {step === "backup_code" && methods.includes("totp") && (
              <button type="button" onClick={() => setStep("totp")} className="text-slate-900 font-medium">
                Use authenticator app
              </button>
            )}
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="bg-white p-8 rounded-lg shadow-sm border w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">Sign in to FinanceMgr</h1>
        {passwordResetSuccess && (
          <p className="text-sm text-emerald-600">Password reset. Please sign in with your new password.</p>
        )}
        {oauthError && <p className="text-sm text-red-600">Sign-in failed, please try again.</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        <OAuthButtons />

        <button
          type="button"
          onClick={onPasskeyLogin}
          disabled={submitting}
          className="w-full border border-slate-300 text-slate-900 rounded-md py-2 text-sm font-medium disabled:opacity-50"
        >
          Sign in with a passkey
        </button>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex-1 border-t" />
          or
          <div className="flex-1 border-t" />
        </div>

        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs text-slate-500 hover:text-slate-900">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-slate-900 text-white rounded-md py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-sm text-slate-500 text-center">
          No account? <Link to="/register" className="text-slate-900 font-medium">Register</Link>
        </p>
      </div>
    </div>
  );
}
