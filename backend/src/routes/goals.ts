import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const goalsRouter = Router();

goalsRouter.use(requireAuth);

goalsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: req.userId!, active: true },
      include: { contributions: { orderBy: { date: "desc" } } },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      goals.map((g) => ({
        ...g,
        savedAmount: g.contributions.reduce((sum, c) => sum + Number(c.amount), 0),
      }))
    );
  } catch (err) {
    next(err);
  }
});

const goalSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: z.coerce.number().positive().max(100_000_000),
  targetDate: z.coerce.date().optional(),
});

goalsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const data = goalSchema.parse(req.body);
    const goal = await prisma.savingsGoal.create({ data: { ...data, userId: req.userId! } });
    res.status(201).json(goal);
  } catch (err) {
    next(err);
  }
});

goalsRouter.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!existing) return res.status(404).json({ error: "Not found" });
    const data = goalSchema.parse(req.body);
    const goal = await prisma.savingsGoal.update({ where: { id: existing.id }, data });
    res.json(goal);
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!goal) return res.status(404).json({ error: "Not found" });
    // Soft-delete: keep contribution history around instead of cascading it away.
    await prisma.savingsGoal.update({ where: { id: goal.id }, data: { active: false } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const contributionSchema = z.object({
  amount: z.coerce.number().positive().max(10_000_000),
  date: z.coerce.date(),
  note: z.string().trim().max(200).optional(),
});

goalsRouter.post("/:id/contributions", async (req: AuthedRequest, res, next) => {
  try {
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!goal) return res.status(404).json({ error: "Not found" });
    const data = contributionSchema.parse(req.body);
    const contribution = await prisma.savingsContribution.create({ data: { ...data, goalId: goal.id } });
    res.status(201).json(contribution);
  } catch (err) {
    next(err);
  }
});

goalsRouter.delete("/:id/contributions/:contributionId", async (req: AuthedRequest, res, next) => {
  try {
    const goal = await prisma.savingsGoal.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!goal) return res.status(404).json({ error: "Not found" });
    await prisma.savingsContribution.deleteMany({ where: { id: req.params.contributionId, goalId: goal.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
