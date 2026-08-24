import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

const redirectUri = `${env.backendPublicUrl}/api/auth/oauth/google/callback`;

function buildClient(): OAuth2Client {
  return new OAuth2Client(env.googleClientId, env.googleClientSecret, redirectUri);
}

export function buildGoogleAuthUrl(state: string): string {
  const client = buildClient();
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    state,
  });
}

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export async function exchangeGoogleCode(code: string): Promise<GoogleProfile> {
  const client = buildClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google token exchange did not return an id_token");
  }
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Google id_token missing required claims");
  }
  return { sub: payload.sub, email: payload.email, emailVerified: Boolean(payload.email_verified) };
}
