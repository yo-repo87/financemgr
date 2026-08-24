import { Router } from "express";
import { z } from "zod";
import { Products, CountryCode } from "plaid";
import { plaidClient, plaidConfigured } from "../lib/plaidClient";
import { prisma } from "../lib/prisma";
import { encryptField } from "../lib/crypto";
import { syncPlaidItem } from "../lib/plaidSync";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { logger } from "../lib/logger";

export const plaidRouter = Router();

plaidRouter.use(requireAuth);

function assertPlaidConfigured(res: import("express").Response): boolean {
  if (!plaidConfigured) {
    res.status(503).json({ error: "Plaid is not configured on this server yet. Add PLAID_CLIENT_ID and PLAID_SECRET to .env." });
    return false;
  }
  return true;
}

plaidRouter.post("/link-token", async (req: AuthedRequest, res, next) => {
  try {
    if (!assertPlaidConfigured(res)) return;
    const resp = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.userId! },
      client_name: "FinanceMgr",
      // Investments only applies to newly-linked accounts - existing
      // connections need to be re-linked (Plaid Link update mode) to grant
      // this product, since Plaid can't retroactively add scopes to a token.
      products: [Products.Transactions, Products.Liabilities, Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    res.json({ linkToken: resp.data.link_token });
  } catch (err) {
    next(err);
  }
});

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().max(255).optional(),
});

plaidRouter.post("/exchange", async (req: AuthedRequest, res, next) => {
  try {
    if (!assertPlaidConfigured(res)) return;
    const { publicToken, institutionName } = exchangeSchema.parse(req.body);
    const exchangeResp = await plaidClient.itemPublicTokenExchange({ public_token: publicToken });
    const { access_token, item_id } = exchangeResp.data;

    const plaidItem = await prisma.plaidItem.create({
      data: {
        userId: req.userId!,
        plaidItemId: item_id,
        accessTokenEncrypted: encryptField(access_token),
        institutionName,
      },
    });

    await syncPlaidItem(plaidItem.id);
    res.status(201).json({ id: plaidItem.id, institutionName: plaidItem.institutionName });
  } catch (err) {
    next(err);
  }
});

plaidRouter.get("/items", async (req: AuthedRequest, res, next) => {
  try {
    const items = await prisma.plaidItem.findMany({
      where: { userId: req.userId! },
      select: { id: true, institutionName: true, status: true, lastSyncedAt: true, createdAt: true },
    });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

plaidRouter.post("/items/:id/sync", async (req: AuthedRequest, res, next) => {
  try {
    const item = await prisma.plaidItem.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!item) return res.status(404).json({ error: "Not found" });
    await syncPlaidItem(item.id);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Manual Plaid sync failed");
    next(err);
  }
});

plaidRouter.delete("/items/:id", async (req: AuthedRequest, res, next) => {
  try {
    const item = await prisma.plaidItem.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!item) return res.status(404).json({ error: "Not found" });
    await prisma.plaidItem.delete({ where: { id: item.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
