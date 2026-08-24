import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeForecast } from "../lib/cashFlowForecast";

export const cashflowRouter = Router();

cashflowRouter.use(requireAuth);

cashflowRouter.get("/forecast", async (req: AuthedRequest, res, next) => {
  try {
    const days = z.coerce.number().int().min(7).max(90).default(30).parse(req.query.days);
    const forecast = await computeForecast(req.userId!, days);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({ lowBalanceThreshold: z.coerce.number().min(0) });

cashflowRouter.put("/settings", async (req: AuthedRequest, res, next) => {
  try {
    const { lowBalanceThreshold } = settingsSchema.parse(req.body);
    const setting = await prisma.cashFlowSetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, lowBalanceThreshold },
      update: { lowBalanceThreshold },
    });
    res.json(setting);
  } catch (err) {
    next(err);
  }
});

cashflowRouter.get("/income", async (req: AuthedRequest, res, next) => {
  try {
    const incomes = await prisma.detectedIncome.findMany({
      where: { userId: req.userId!, status: { in: ["NEW", "CONFIRMED"] } },
      orderBy: { lastReceivedDate: "desc" },
    });
    res.json(incomes);
  } catch (err) {
    next(err);
  }
});

const incomeStatusSchema = z.object({ status: z.enum(["CONFIRMED", "DISMISSED"]) });

cashflowRouter.patch("/income/:id", async (req: AuthedRequest, res, next) => {
  try {
    const { status } = incomeStatusSchema.parse(req.body);
    const income = await prisma.detectedIncome.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!income) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.detectedIncome.update({ where: { id: income.id }, data: { status } });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
