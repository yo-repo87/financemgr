import { useOAuthProviders, startGoogleLogin, startAppleLogin } from "../lib/oauth";

// Renders nothing at all - not even a wrapper - for any provider whose
// credentials aren't configured server-side, so an unfinished integration
// never ships as a dead button.
export default function OAuthButtons() {
  const { data: providers } = useOAuthProviders();

  if (!providers || (!providers.google && !providers.apple)) {
    return null;
  }

  return (
    <div className="space-y-2">
      {providers.google && (
        <button
          type="button"
          onClick={startGoogleLogin}
          className="w-full border border-slate-300 text-slate-900 rounded-md py-2 text-sm font-medium hover:bg-slate-50"
        >
          Continue with Google
        </button>
      )}
      {providers.apple && (
        <button
          type="button"
          onClick={startAppleLogin}
          className="w-full border border-slate-300 text-slate-900 rounded-md py-2 text-sm font-medium hover:bg-slate-50"
        >
          Continue with Apple
        </button>
      )}
    </div>
  );
}
