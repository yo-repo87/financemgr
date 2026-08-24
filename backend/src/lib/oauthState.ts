import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "./env";

// Self-contained CSRF token for the OAuth redirect leg - a signed JWT rather than
// a stored cookie, because Apple's callback arrives as a cross-site form POST
// (response_mode=form_post is required whenever the email scope is requested),
// and neither SameSite=Lax nor Strict would deliver a state cookie on that request.
// Signature + expiry alone prove it was issued by us; nothing needs to be looked up.
export function createOAuthState(): string {
  return jwt.sign({ purpose: "oauth_state", nonce: crypto.randomBytes(8).toString("hex") }, env.jwtSecret, {
    expiresIn: "10m",
  });
}

export function verifyOAuthState(state: string | undefined): boolean {
  if (!state) return false;
  try {
    const payload = jwt.verify(state, env.jwtSecret) as { purpose: string };
    return payload.purpose === "oauth_state";
  } catch {
    return false;
  }
}
