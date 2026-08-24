import jwt from "jsonwebtoken";
import crypto from "crypto";
import { Response } from "express";
import { env } from "./env";
import { prisma } from "./prisma";
import { hashToken } from "./crypto";

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
