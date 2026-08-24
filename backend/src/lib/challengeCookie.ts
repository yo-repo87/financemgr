import { Request, Response } from "express";
import { env } from "./env";

const isProd = env.nodeEnv === "production";
const COOKIE_NAME = "webauthn_challenge";

// Stateless challenge storage between a WebAuthn .../options call and its matching
// .../verify call. Safe as a plain (non-signed) value: verifyRegistrationResponse /
// verifyAuthenticationResponse cryptographically tie the signed assertion to these
// exact challenge bytes, so a tampered cookie only ever causes verification to fail,
// never a forged login.
export function setChallengeCookie(res: Response, challenge: string) {
  res.cookie(COOKIE_NAME, challenge, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 2 * 60 * 1000,
  });
}

export function readChallengeCookie(req: Request): string | undefined {
  return req.cookies?.[COOKIE_NAME];
}

export function clearChallengeCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, { path: "/api/auth" });
}
