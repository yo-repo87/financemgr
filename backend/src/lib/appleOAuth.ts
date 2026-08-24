import jwt from "jsonwebtoken";
import { env } from "./env";

const AUTHORIZE_URL = "https://appleid.apple.com/auth/authorize";
const TOKEN_URL = "https://appleid.apple.com/auth/token";

const redirectUri = `${env.backendPublicUrl}/api/auth/oauth/apple/callback`;

export function buildAppleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.appleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "email",
    // Required by Apple whenever the email/name scope is requested - the
    // callback arrives as a form POST rather than a query-string GET.
    response_mode: "form_post",
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

// Apple doesn't use a static client secret - it's a short-lived ES256 JWT we sign
// ourselves with the private key from the .p8 file, proving control of the
// registered Services ID. Regenerated fresh for each exchange.
function buildClientSecret(): string {
  return jwt.sign({}, env.applePrivateKey, {
    algorithm: "ES256",
    issuer: env.appleTeamId,
    subject: env.appleClientId,
    audience: "https://appleid.apple.com",
    expiresIn: "5m",
    keyid: env.appleKeyId,
  });
}

export interface AppleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
}

export async function exchangeAppleCode(code: string): Promise<AppleProfile> {
  const body = new URLSearchParams({
    client_id: env.appleClientId,
    client_secret: buildClientSecret(),
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!resp.ok) {
    throw new Error(`Apple token exchange failed: ${resp.status}`);
  }
  const data = (await resp.json()) as { id_token?: string };
  if (!data.id_token) {
    throw new Error("Apple token exchange did not return an id_token");
  }

  // Decoded, not signature-verified: this id_token arrived directly from Apple's
  // token endpoint over the server-to-server HTTPS call just above, not from
  // client-supplied data - the same trust boundary as the request itself, so
  // re-verifying the signature (which would need Apple's JWKS) is redundant here.
  const claims = jwt.decode(data.id_token) as { sub?: string; email?: string; email_verified?: boolean | string } | null;
  if (!claims?.sub || !claims.email) {
    throw new Error("Apple id_token missing required claims");
  }
  return { sub: claims.sub, email: claims.email, emailVerified: claims.email_verified === true || claims.email_verified === "true" };
}
