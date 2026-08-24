import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { api } from "./api";
import type { User } from "./auth";

export type CredentialPurpose = "PASSKEY" | "SECOND_FACTOR";

export async function registerWebAuthnCredential(purpose: CredentialPurpose, nickname?: string) {
  const { data: optionsJSON } = await api.post("/api/auth/webauthn/register/options", { purpose });
  const response = await startRegistration({ optionsJSON });
  const { data } = await api.post("/api/auth/webauthn/register/verify", { response, purpose, nickname });
  return data as { ok: true; backupCodes?: string[] };
}

// Passwordless login - no email needed, the browser surfaces any discoverable
// (resident) credential registered for this site.
export async function loginWithPasskey() {
  const { data: optionsJSON } = await api.post("/api/auth/webauthn/login/options");
  const response = await startAuthentication({ optionsJSON });
  const { data } = await api.post("/api/auth/webauthn/login/verify", { response });
  return data as User;
}

// Second-factor challenge during a password login that requires 2FA.
export async function verifyWebAuthnSecondFactor() {
  const { data: optionsJSON } = await api.post("/api/auth/2fa/webauthn/options");
  const response = await startAuthentication({ optionsJSON });
  const { data } = await api.post("/api/auth/2fa/webauthn/verify", { response });
  return data as User;
}
