import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Response } from "express";
import { env } from "./env";
import { prisma } from "./prisma";
import { hashToken } from "./crypto";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PENDING_2FA_TTL_MS = 5 * 60 * 1000;

const isProd = env.nodeEnv === "production";

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "15m" });
}

export async function issueRefreshToken(userId: string): Promise<string> {
  const raw = crypto.randomBytes(48).toString("hex");
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });
  return raw;
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict" as const,
    path: "/",
  };
  res.cookie("access_token", accessToken, { ...common, maxAge: ACCESS_TOKEN_TTL_MS });
  res.cookie("refresh_token", refreshToken, { ...common, path: "/api/auth", maxAge: REFRESH_TOKEN_TTL_MS });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth" });
}

// Short-lived, separate from the real session cookies - proves the password step
// passed without granting a real session until the 2FA step also succeeds.
export function setPendingTwoFactorCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId, typ: "pending_2fa" }, env.jwtSecret, { expiresIn: "5m" });
  res.cookie("twofa_pending", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: PENDING_2FA_TTL_MS,
  });
}

export function clearPendingTwoFactorCookie(res: Response) {
  res.clearCookie("twofa_pending", { path: "/api/auth" });
}

export function verifyPendingTwoFactorToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; typ: string };
    return payload.typ === "pending_2fa" ? payload.sub : null;
  } catch {
    return null;
  }
}
