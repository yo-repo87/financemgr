import { Router } from "express";
import { OAuthProvider } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env, googleOAuthConfigured, appleOAuthConfigured } from "../lib/env";
import { createOAuthState, verifyOAuthState } from "../lib/oauthState";
import { buildGoogleAuthUrl, exchangeGoogleCode } from "../lib/googleOAuth";
import { buildAppleAuthUrl, exchangeAppleCode } from "../lib/appleOAuth";
import { signAccessToken, issueRefreshToken, setAuthCookies } from "../lib/tokens";
import { logger } from "../lib/logger";

export const oauthRouter = Router();

oauthRouter.get("/providers", (_req, res) => {
  res.json({ google: googleOAuthConfigured, apple: appleOAuthConfigured });
});

function failRedirect(res: import("express").Response) {
  res.redirect(`${env.frontendUrl}/login?oauth_error=1`);
}

// Shared account-resolution: an existing link logs straight in; a verified-email
// match to an existing password/passkey account auto-links (standard behavior -
// both Google and Apple verify the emails they report); otherwise a new
// password-less User is created. Every path ends the same way: full session.
async function findOrCreateOAuthUser(
  provider: OAuthProvider,
  providerAccountId: string,
  email: string,
  emailVerified: boolean
): Promise<string> {
  const existingLink = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId } },
  });
  if (existingLink) return existingLink.userId;

  if (emailVerified) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      await prisma.oAuthAccount.create({
        data: { userId: existingUser.id, provider, providerAccountId, email },
      });
      return existingUser.id;
    }
  }

  const user = await prisma.user.create({ data: { email, passwordHash: null } });
  await prisma.oAuthAccount.create({ data: { userId: user.id, provider, providerAccountId, email } });
  return user.id;
}

async function completeOAuthLogin(res: import("express").Response, userId: string) {
  const accessToken = signAccessToken(userId);
  const refreshToken = await issueRefreshToken(userId);
  setAuthCookies(res, accessToken, refreshToken);
  res.redirect(env.frontendUrl);
}

oauthRouter.get("/google/start", (_req, res) => {
  if (!googleOAuthConfigured) return res.status(404).json({ error: "Google sign-in is not configured" });
  res.redirect(buildGoogleAuthUrl(createOAuthState()));
});

oauthRouter.get("/google/callback", async (req, res) => {
  try {
    if (!googleOAuthConfigured) return failRedirect(res);
    const { code, state } = req.query;
    if (typeof code !== "string" || !verifyOAuthState(typeof state === "string" ? state : undefined)) {
      return failRedirect(res);
    }
    const profile = await exchangeGoogleCode(code);
    const userId = await findOrCreateOAuthUser(OAuthProvider.GOOGLE, profile.sub, profile.email, profile.emailVerified);
    await completeOAuthLogin(res, userId);
  } catch (err) {
    logger.error({ err }, "Google OAuth callback failed");
    failRedirect(res);
  }
});

oauthRouter.get("/apple/start", (_req, res) => {
  if (!appleOAuthConfigured) return res.status(404).json({ error: "Apple sign-in is not configured" });
  res.redirect(buildAppleAuthUrl(createOAuthState()));
});

// Apple posts here (response_mode=form_post) rather than a query-string redirect -
// requires express.urlencoded() to be mounted (see index.ts).
oauthRouter.post("/apple/callback", async (req, res) => {
  try {
    if (!appleOAuthConfigured) return failRedirect(res);
    const { code, state } = req.body;
    if (typeof code !== "string" || !verifyOAuthState(typeof state === "string" ? state : undefined)) {
      return failRedirect(res);
    }
    const profile = await exchangeAppleCode(code);
    const userId = await findOrCreateOAuthUser(OAuthProvider.APPLE, profile.sub, profile.email, profile.emailVerified);
    await completeOAuthLogin(res, userId);
  } catch (err) {
    logger.error({ err }, "Apple OAuth callback failed");
    failRedirect(res);
  }
});
