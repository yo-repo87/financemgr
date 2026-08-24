import { useQuery } from "@tanstack/react-query";
import { api } from "./api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3141";

interface OAuthProviders {
  google: boolean;
  apple: boolean;
}

export function useOAuthProviders() {
  return useQuery<OAuthProviders>({
    queryKey: ["oauth-providers"],
    queryFn: () => api.get("/api/auth/oauth/providers").then((r) => r.data),
    staleTime: Infinity,
  });
}

// Full top-level navigations, not fetch/XHR - the provider's consent screen
// can't run inside an ajax request.
export function startGoogleLogin() {
  window.location.href = `${API_BASE}/api/auth/oauth/google/start`;
}

export function startAppleLogin() {
  window.location.href = `${API_BASE}/api/auth/oauth/apple/start`;
}
