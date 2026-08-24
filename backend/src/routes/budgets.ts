import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const budgetsRouter = Router();

budgetsRouter.use(requireAuth);

budgetsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({ where: { userId: req.userId! }, orderBy: { category: "asc" } });
    res.json(budgets);
  } catch (err) {
    next(err);
  }
});

const SUGGESTION_LOOKBACK_MONTHS = 3;

// Proposes a monthly limit per category from actual average spend over the
// trailing 3 months - a starting point to accept or adjust, not a final answer.
budgetsRouter.get("/suggestions", async (req: AuthedRequest, res, next) => {
  try {
    const since = new Date();
    since.setMonth(since.getMonth() - SUGGESTION_LOOKBACK_MONTHS);

    const [spend, budgets] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["category"],
        where: {
          account: { plaidItem: { userId: req.userId! } },
          date: { gte: since },
          amount: { gt: 0 },
        },
        _sum: { amount: true },
      }),
      prisma.budget.findMany({ where: { userId: req.userId! } }),
    ]);

    const currentByCategory = new Map(budgets.map((b) => [b.category, Number(b.monthlyLimit)]));

    const suggestions = spend
      .map((s) => {
        const category = s.category ?? "Uncategorized";
        const totalSpent = Number(s._sum.amount ?? 0);
        const avgMonthlySpend = totalSpent / SUGGESTION_LOOKBACK_MONTHS;
        return {
          category,
          avgMonthlySpend,
          suggestedLimit: Math.round(avgMonthlySpend),
          currentLimit: currentByCategory.get(category) ?? null,
        };
      })
      .sort((a, b) => b.avgMonthlySpend - a.avgMonthlySpend);

    res.json(suggestions);
  } catch (err) {
    next(err);
  }
});

const budgetSchema = z.object({
  category: z.string().trim().min(1).max(100),
  monthlyLimit: z.coerce.number().positive().max(10_000_000),
});

budgetsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const { category, monthlyLimit } = budgetSchema.parse(req.body);
    const budget = await prisma.budget.upsert({
      where: { userId_category: { userId: req.userId!, category } },
      create: { userId: req.userId!, category, monthlyLimit },
      update: { monthlyLimit },
    });
    res.status(201).json(budget);
  } catch (err) {
    next(err);
  }
});

budgetsRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const budget = await prisma.budget.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!budget) return res.status(404).json({ error: "Not found" });
    await prisma.budget.delete({ where: { id: budget.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
