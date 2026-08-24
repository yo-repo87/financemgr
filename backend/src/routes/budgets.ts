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
