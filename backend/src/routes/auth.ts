import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashToken } from "../lib/crypto";
import { signAccessToken, issueRefreshToken, setAuthCookies, clearAuthCookies } from "../lib/tokens";
import { authRateLimiter } from "../middleware/rateLimiter";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(10, "Password must be at least 10 characters").max(256),
});

authRouter.post("/register", authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.create({ data: { email, passwordHash } });

    const accessToken = signAccessToken(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    setAuthCookies(res, accessToken, refreshToken);

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = credentialsSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    // Constant response shape whether the user exists or not, to avoid user enumeration.
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const accessToken = signAccessToken(user.id);
    const refreshToken = await issueRefreshToken(user.id);
    setAuthCookies(res, accessToken, refreshToken);

    res.json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const raw = req.cookies?.refresh_token;
    if (!raw) return res.status(401).json({ error: "No refresh token" });

    const tokenHash = hashToken(raw);
    const record = await prisma.refreshToken.findFirst({ where: { tokenHash, revoked: false } });
    if (!record || record.expiresAt < new Date()) {
      return res.status(401).json({ error: "Refresh token invalid or expired" });
    }

    // Rotate: revoke the used token and issue a new one.
    await prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
    const accessToken = signAccessToken(record.userId);
    const newRefreshToken = await issueRefreshToken(record.userId);
    setAuthCookies(res, accessToken, newRefreshToken);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const raw = req.cookies?.refresh_token;
    if (raw) {
      await prisma.refreshToken.updateMany({ where: { tokenHash: hashToken(raw) }, data: { revoked: true } });
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});
