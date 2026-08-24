import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { CredentialPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { encryptField, decryptField } from "../lib/crypto";
import { generateTotpSecret, buildTotpQrCode, verifyTotpCode } from "../lib/totp";
import { regenerateBackupCodes, countRemainingBackupCodes, consumeBackupCode } from "../lib/backupCodes";
import { buildSecondFactorAuthenticationOptions, verifyAuthentication } from "../lib/webauthn";
import { setChallengeCookie, readChallengeCookie, clearChallengeCookie } from "../lib/challengeCookie";
import { signAccessToken, issueRefreshToken, setAuthCookies, clearPendingTwoFactorCookie } from "../lib/tokens";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { requirePendingTwoFactor, PendingTwoFactorRequest } from "../middleware/pendingTwoFactor";
import { authRateLimiter } from "../middleware/rateLimiter";
import { accountHasTwoFactor } from "./webauthn";

export const twoFactorRouter = Router();

// --- Authenticated management endpoints ---

twoFactorRouter.get("/status", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const [setting, securityKeyCount, backupCodesRemaining] = await Promise.all([
      prisma.twoFactorSetting.findUnique({ where: { userId: req.userId! } }),
      prisma.webAuthnCredential.count({ where: { userId: req.userId!, purpose: CredentialPurpose.SECOND_FACTOR } }),
      countRemainingBackupCodes(req.userId!),
    ]);
    res.json({
      totpEnabled: Boolean(setting?.totpEnabled),
      securityKeyCount,
      backupCodesRemaining,
    });
  } catch (err) {
    next(err);
  }
});

twoFactorRouter.post("/totp/setup", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "Not found" });

    const secret = generateTotpSecret();
    await prisma.twoFactorSetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, totpSecretEncrypted: encryptField(secret), totpEnabled: false },
      update: { totpSecretEncrypted: encryptField(secret), totpEnabled: false },
    });

    const qrCodeDataUrl = await buildTotpQrCode(secret, user.email);
    res.json({ secret, qrCodeDataUrl });
  } catch (err) {
    next(err);
  }
});

const codeSchema = z.object({ code: z.string().trim().min(6).max(9) });

twoFactorRouter.post("/totp/confirm", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { code } = codeSchema.parse(req.body);
    const setting = await prisma.twoFactorSetting.findUnique({ where: { userId: req.userId! } });
    if (!setting?.totpSecretEncrypted) {
      return res.status(400).json({ error: "Start TOTP setup first" });
    }
    const secret = decryptField(setting.totpSecretEncrypted);
    if (!verifyTotpCode(secret, code)) {
      return res.status(400).json({ error: "Invalid code" });
    }

    const hadAnyTwoFactor = await accountHasTwoFactor(req.userId!);
    await prisma.twoFactorSetting.update({ where: { userId: req.userId! }, data: { totpEnabled: true } });

    let backupCodes: string[] | undefined;
    if (!hadAnyTwoFactor) {
      backupCodes = await regenerateBackupCodes(req.userId!);
    }

    res.json({ ok: true, backupCodes });
  } catch (err) {
    next(err);
  }
});

const disableSchema = z.object({ password: z.string().min(1) });

twoFactorRouter.post("/totp/disable", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { password } = disableSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: "Incorrect password" });
    }
    await prisma.twoFactorSetting.update({
      where: { userId: req.userId! },
      data: { totpEnabled: false, totpSecretEncrypted: null },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

twoFactorRouter.post("/backup-codes/regenerate", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const codes = await regenerateBackupCodes(req.userId!);
    res.json({ backupCodes: codes });
  } catch (err) {
    next(err);
  }
});

// --- Login-time 2FA challenge endpoints (pending session, not yet a full login) ---

async function completeLogin(res: import("express").Response, userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = await issueRefreshToken(userId);
  setAuthCookies(res, accessToken, refreshToken);
  clearPendingTwoFactorCookie(res);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return { id: user!.id, email: user!.email };
}

twoFactorRouter.post(
  "/verify-totp",
  authRateLimiter,
  requirePendingTwoFactor,
  async (req: PendingTwoFactorRequest, res, next) => {
    try {
      const { code } = codeSchema.parse(req.body);
      const setting = await prisma.twoFactorSetting.findUnique({ where: { userId: req.pendingUserId! } });
      if (!setting?.totpEnabled || !setting.totpSecretEncrypted) {
        return res.status(400).json({ error: "TOTP is not enabled on this account" });
      }
      const secret = decryptField(setting.totpSecretEncrypted);
      if (!verifyTotpCode(secret, code)) {
        return res.status(401).json({ error: "Invalid code" });
      }
      res.json(await completeLogin(res, req.pendingUserId!));
    } catch (err) {
      next(err);
    }
  }
);

twoFactorRouter.post(
  "/verify-backup-code",
  authRateLimiter,
  requirePendingTwoFactor,
  async (req: PendingTwoFactorRequest, res, next) => {
    try {
      const { code } = z.object({ code: z.string().trim().min(4).max(20) }).parse(req.body);
      const valid = await consumeBackupCode(req.pendingUserId!, code);
      if (!valid) {
        return res.status(401).json({ error: "Invalid or already-used backup code" });
      }
      res.json(await completeLogin(res, req.pendingUserId!));
    } catch (err) {
      next(err);
    }
  }
);

twoFactorRouter.post(
  "/webauthn/options",
  requirePendingTwoFactor,
  async (req: PendingTwoFactorRequest, res, next) => {
    try {
      const options = await buildSecondFactorAuthenticationOptions(req.pendingUserId!);
      setChallengeCookie(res, options.challenge);
      res.json(options);
    } catch (err) {
      next(err);
    }
  }
);

twoFactorRouter.post(
  "/webauthn/verify",
  requirePendingTwoFactor,
  async (req: PendingTwoFactorRequest, res, next) => {
    try {
      const { response } = z.object({ response: z.any() }).parse(req.body);
      const expectedChallenge = readChallengeCookie(req);
      if (!expectedChallenge) {
        return res.status(400).json({ error: "Verification session expired, please try again" });
      }

      const credentialId: string | undefined = response?.id;
      const stored = credentialId
        ? await prisma.webAuthnCredential.findFirst({
            where: { credentialId, userId: req.pendingUserId!, purpose: CredentialPurpose.SECOND_FACTOR },
          })
        : null;
      if (!stored) {
        clearChallengeCookie(res);
        return res.status(401).json({ error: "Security key not recognized" });
      }

      const verification = await verifyAuthentication(response, expectedChallenge, stored);
      clearChallengeCookie(res);
      if (!verification.verified) {
        return res.status(401).json({ error: "Could not verify security key" });
      }

      await prisma.webAuthnCredential.update({
        where: { id: stored.id },
        data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
      });

      res.json(await completeLogin(res, req.pendingUserId!));
    } catch (err) {
      next(err);
    }
  }
);
