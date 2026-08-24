import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { decryptField } from "../lib/crypto";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { clearAuthCookies } from "../lib/tokens";
import { plaidClient, plaidConfigured } from "../lib/plaidClient";
import { logger } from "../lib/logger";

export const accountRouter = Router();

accountRouter.use(requireAuth);

// Everything meaningfully "the user's data" - deliberately excludes
// credential material (password hash, Plaid access tokens, TOTP secret,
// WebAuthn keys, push subscription keys) since those aren't portable data,
// they're the app's own auth material and would be meaningless outside it.
accountRouter.get("/export", async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.userId!;
    const [
      user,
      accounts,
      transactions,
      budgets,
      bills,
      billPayments,
      subscriptions,
      goals,
      contributions,
      aiMessages,
    ] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
      prisma.account.findMany({
        where: { plaidItem: { userId } },
        include: { plaidItem: { select: { institutionName: true } }, creditCardDetail: true, holdings: true },
      }),
      prisma.transaction.findMany({ where: { account: { plaidItem: { userId } } }, orderBy: { date: "desc" } }),
      prisma.budget.findMany({ where: { userId } }),
      prisma.bill.findMany({ where: { userId } }),
      prisma.billPayment.findMany({ where: { userId } }),
      prisma.detectedSubscription.findMany({ where: { userId } }),
      prisma.savingsGoal.findMany({ where: { userId } }),
      prisma.savingsContribution.findMany({ where: { goal: { userId } } }),
      prisma.aiMessage.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    ]);

    res.setHeader("Content-Disposition", "attachment; filename=financemgr-export.json");
    res.json({
      exportedAt: new Date().toISOString(),
      user,
      accounts,
      transactions,
      budgets,
      bills,
      billPayments,
      subscriptions,
      savingsGoals: goals,
      savingsContributions: contributions,
      aiMessages: aiMessages.map((m) => ({
        role: m.role,
        content: decryptField(m.contentEncrypted),
        createdAt: m.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const deleteSchema = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string().optional(),
});

accountRouter.delete("/", async (req: AuthedRequest, res, next) => {
  try {
    const { email, password } = deleteSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "Not found" });

    if (email !== user.email) {
      return res.status(400).json({ error: "Email confirmation does not match" });
    }
    // OAuth-only accounts have no password to confirm - the authenticated
    // session is the only factor they have, same reasoning used elsewhere
    // (security questions, 2FA disable) for this exact null-password case.
    if (user.passwordHash && !(password && (await argon2.verify(user.passwordHash, password)))) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    if (plaidConfigured) {
      const items = await prisma.plaidItem.findMany({ where: { userId: user.id } });
      for (const item of items) {
        try {
          await plaidClient.itemRemove({ access_token: decryptField(item.accessTokenEncrypted) });
        } catch (err) {
          // Best-effort - a dead/already-revoked item at Plaid's end should
          // never block the user from deleting their own account.
          logger.warn({ err, itemId: item.id }, "Plaid itemRemove failed during account deletion, continuing");
        }
      }
    }

    // Every relation in the schema cascades from User, so this alone removes everything.
    await prisma.user.delete({ where: { id: user.id } });
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
