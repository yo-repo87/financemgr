import { Router } from "express";
import { z } from "zod";
import { CredentialPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma";
import {
  buildRegistrationOptions,
  verifyRegistration,
  buildLoginAuthenticationOptions,
  verifyAuthentication,
} from "../lib/webauthn";
import { setChallengeCookie, readChallengeCookie, clearChallengeCookie } from "../lib/challengeCookie";
import { signAccessToken, issueRefreshToken, setAuthCookies } from "../lib/tokens";
import { regenerateBackupCodes } from "../lib/backupCodes";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const webauthnRouter = Router();

const purposeSchema = z.nativeEnum(CredentialPurpose);

webauthnRouter.post("/register/options", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const purpose = purposeSchema.parse(req.body?.purpose);
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "Not found" });

    const options = await buildRegistrationOptions(user.id, user.email, purpose);
    setChallengeCookie(res, options.challenge);
    res.json(options);
  } catch (err) {
    next(err);
  }
});

const registerVerifySchema = z.object({
  response: z.any(),
  purpose: purposeSchema,
  nickname: z.string().trim().max(100).optional(),
});

webauthnRouter.post("/register/verify", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { response, purpose, nickname } = registerVerifySchema.parse(req.body);
    const expectedChallenge = readChallengeCookie(req);
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Registration session expired, please try again" });
    }

    const verification = await verifyRegistration(response, expectedChallenge);
    clearChallengeCookie(res);
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: "Could not verify passkey/security key" });
    }

    const { credential } = verification.registrationInfo;

    const hadAnyTwoFactor = await accountHasTwoFactor(req.userId!);

    await prisma.webAuthnCredential.create({
      data: {
        userId: req.userId!,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64"),
        counter: credential.counter,
        transports: response.response?.transports ?? [],
        purpose,
        nickname: nickname || (purpose === CredentialPurpose.PASSKEY ? "Passkey" : "Security key"),
      },
    });

    let backupCodes: string[] | undefined;
    if (purpose === CredentialPurpose.SECOND_FACTOR && !hadAnyTwoFactor) {
      backupCodes = await regenerateBackupCodes(req.userId!);
    }

    res.status(201).json({ ok: true, backupCodes });
  } catch (err) {
    next(err);
  }
});

webauthnRouter.get("/credentials", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const credentials = await prisma.webAuthnCredential.findMany({
      where: { userId: req.userId! },
      select: { id: true, nickname: true, purpose: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: "asc" },
    });
    res.json(credentials);
  } catch (err) {
    next(err);
  }
});

webauthnRouter.delete("/credentials/:id", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const credential = await prisma.webAuthnCredential.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!credential) return res.status(404).json({ error: "Not found" });
    await prisma.webAuthnCredential.delete({ where: { id: credential.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// --- Passwordless login (passkeys only) ---

webauthnRouter.post("/login/options", async (_req, res, next) => {
  try {
    const options = await buildLoginAuthenticationOptions();
    setChallengeCookie(res, options.challenge);
    res.json(options);
  } catch (err) {
    next(err);
  }
});

const loginVerifySchema = z.object({ response: z.any() });

webauthnRouter.post("/login/verify", async (req, res, next) => {
  try {
    const { response } = loginVerifySchema.parse(req.body);
    const expectedChallenge = readChallengeCookie(req);
    if (!expectedChallenge) {
      return res.status(400).json({ error: "Login session expired, please try again" });
    }

    const credentialId: string | undefined = response?.id;
    const stored = credentialId
      ? await prisma.webAuthnCredential.findUnique({ where: { credentialId } })
      : null;
    if (!stored || stored.purpose !== CredentialPurpose.PASSKEY) {
      clearChallengeCookie(res);
      return res.status(401).json({ error: "Passkey not recognized" });
    }

    const verification = await verifyAuthentication(response, expectedChallenge, stored);
    clearChallengeCookie(res);
    if (!verification.verified) {
      return res.status(401).json({ error: "Could not verify passkey" });
    }

    await prisma.webAuthnCredential.update({
      where: { id: stored.id },
      data: { counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
    });

    const accessToken = signAccessToken(stored.userId);
    const refreshToken = await issueRefreshToken(stored.userId);
    setAuthCookies(res, accessToken, refreshToken);

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    res.json({ id: user!.id, email: user!.email });
  } catch (err) {
    next(err);
  }
});

export async function accountHasTwoFactor(userId: string): Promise<boolean> {
  const [setting, securityKeyCount] = await Promise.all([
    prisma.twoFactorSetting.findUnique({ where: { userId } }),
    prisma.webAuthnCredential.count({ where: { userId, purpose: CredentialPurpose.SECOND_FACTOR } }),
  ]);
  return Boolean(setting?.totpEnabled) || securityKeyCount > 0;
}
