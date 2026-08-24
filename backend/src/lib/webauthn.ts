import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { env } from "./env";
import { prisma } from "./prisma";
import { CredentialPurpose } from "@prisma/client";

export const rpID = env.webauthnRpId;
export const rpName = env.webauthnRpName;
export const origin = env.webauthnOrigin;

export async function buildRegistrationOptions(userId: string, userEmail: string, purpose: CredentialPurpose) {
  const existing = await prisma.webAuthnCredential.findMany({ where: { userId } });
  return generateRegistrationOptions({
    rpName,
    rpID,
    userName: userEmail,
    userDisplayName: userEmail,
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection:
      purpose === CredentialPurpose.PASSKEY
        ? { residentKey: "required", userVerification: "required" }
        : { residentKey: "discouraged", userVerification: "preferred" },
  });
}

export async function verifyRegistration(
  response: RegistrationResponseJSON,
  expectedChallenge: string
): Promise<VerifiedRegistrationResponse> {
  return verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
  });
}

export async function buildLoginAuthenticationOptions() {
  // No allowCredentials - the browser surfaces any discoverable (resident) credential
  // for this RP, which is what makes passwordless passkey login possible.
  return generateAuthenticationOptions({
    rpID,
    userVerification: "required",
  });
}

export async function buildSecondFactorAuthenticationOptions(userId: string) {
  const credentials = await prisma.webAuthnCredential.findMany({
    where: { userId, purpose: CredentialPurpose.SECOND_FACTOR },
  });
  return generateAuthenticationOptions({
    rpID,
    userVerification: "discouraged",
    allowCredentials: credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
  });
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
  expectedChallenge: string,
  storedCredential: { credentialId: string; publicKey: string; counter: number; transports: string[] }
): Promise<VerifiedAuthenticationResponse> {
  return verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: storedCredential.credentialId,
      publicKey: new Uint8Array(Buffer.from(storedCredential.publicKey, "base64")),
      counter: storedCredential.counter,
      transports: storedCredential.transports as AuthenticatorTransportFuture[],
    },
  });
}
