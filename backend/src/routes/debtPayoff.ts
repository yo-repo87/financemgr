import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { simulatePayoff, Debt } from "../lib/debtPayoff";

export const debtPayoffRouter = Router();

debtPayoffRouter.use(requireAuth);

// Only credit-card accounts carry APR/minimum-payment data today (from
// Plaid's /liabilities/get) - loan-type accounts (mortgage, student) aren't
// synced with liabilities detail yet, so they're excluded rather than
// simulated with guessed numbers.
async function loadDebts(userId: string): Promise<Debt[]> {
  const accounts = await prisma.account.findMany({
    where: { plaidItem: { userId }, type: "credit" },
    include: { creditCardDetail: true },
  });

  return accounts
    .filter((a) => a.creditCardDetail?.aprPercentage != null && Number(a.currentBalance ?? 0) > 0)
    .map((a) => ({
      id: a.id,
      name: a.name,
      balance: Number(a.currentBalance ?? 0),
      aprPercentage: Number(a.creditCardDetail!.aprPercentage),
      minimumPayment: Number(a.creditCardDetail!.minimumPaymentAmount ?? Number(a.currentBalance ?? 0) * 0.02),
    }));
}

debtPayoffRouter.get("/debts", async (req: AuthedRequest, res, next) => {
  try {
    res.json(await loadDebts(req.userId!));
  } catch (err) {
    next(err);
  }
});

const simulateSchema = z.object({ extraMonthlyPayment: z.coerce.number().min(0).max(1_000_000).default(0) });

debtPayoffRouter.post("/simulate", async (req: AuthedRequest, res, next) => {
  try {
    const { extraMonthlyPayment } = simulateSchema.parse(req.body);
    const debts = await loadDebts(req.userId!);
    if (debts.length === 0) return res.json({ debts: [], avalanche: null, snowball: null });
    res.json({ debts, ...simulatePayoff(debts, extraMonthlyPayment) });
  } catch (err) {
    next(err);
  }
});
