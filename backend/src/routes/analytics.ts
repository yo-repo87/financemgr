import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

// Spending by category for the trailing N days (default 30). Plaid convention:
// positive transaction amount = money out (spend), negative = money in (income/refund).
analyticsRouter.get("/spending-by-category", async (req: AuthedRequest, res, next) => {
  try {
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days);
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await prisma.transaction.groupBy({
      by: ["category"],
      where: {
        account: { plaidItem: { userId: req.userId! } },
        date: { gte: since },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    res.json(
      rows.map((r) => ({ category: r.category ?? "Uncategorized", total: Number(r._sum.amount ?? 0) }))
    );
  } catch (err) {
    next(err);
  }
});

// Income vs expenses per month for the trailing N months (default 6).
analyticsRouter.get("/monthly-trend", async (req: AuthedRequest, res, next) => {
  try {
    const months = z.coerce.number().int().min(1).max(24).default(6).parse(req.query.months);
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const transactions = await prisma.transaction.findMany({
      where: { account: { plaidItem: { userId: req.userId! } }, date: { gte: since } },
      select: { amount: true, date: true },
    });

    const byMonth = new Map<string, { income: number; expenses: number }>();
    for (const t of transactions) {
      const key = `${t.date.getUTCFullYear()}-${String(t.date.getUTCMonth() + 1).padStart(2, "0")}`;
      const entry = byMonth.get(key) ?? { income: 0, expenses: 0 };
      const amt = Number(t.amount);
      if (amt > 0) entry.expenses += amt;
      else entry.income += Math.abs(amt);
      byMonth.set(key, entry);
    }

    const result = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v }));
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Net worth over time, built from BalanceSnapshot rows recorded at each Plaid sync.
analyticsRouter.get("/net-worth-trend", async (req: AuthedRequest, res, next) => {
  try {
    const snapshots = await prisma.balanceSnapshot.findMany({
      where: { userId: req.userId! },
      orderBy: { date: "asc" },
    });
    res.json(snapshots.map((s) => ({ date: s.date.toISOString().slice(0, 10), netWorth: Number(s.netWorth) })));
  } catch (err) {
    next(err);
  }
});

// Budget vs actual spend for the current calendar month.
analyticsRouter.get("/budget-vs-actual", async (req: AuthedRequest, res, next) => {
  try {
    const budgets = await prisma.budget.findMany({ where: { userId: req.userId! } });
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const spend = await prisma.transaction.groupBy({
      by: ["category"],
      where: {
        account: { plaidItem: { userId: req.userId! } },
        date: { gte: startOfMonth },
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    });
    const spendByCategory = new Map(spend.map((s) => [s.category ?? "Uncategorized", Number(s._sum.amount ?? 0)]));

    res.json(
      budgets.map((b) => ({
        category: b.category,
        limit: Number(b.monthlyLimit),
        spent: spendByCategory.get(b.category) ?? 0,
      }))
    );
  } catch (err) {
    next(err);
  }
});
