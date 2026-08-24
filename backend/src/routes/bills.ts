import { Router } from "express";
import { z } from "zod";
import { BillRecurrence } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { computeCurrentCycle, isoDate } from "../lib/billing";
import { matchTransactionsToBills } from "../lib/billMatching";

export const billsRouter = Router();

billsRouter.use(requireAuth);

async function paidDueDatesByBill(billIds: string[]): Promise<Map<string, Set<string>>> {
  if (billIds.length === 0) return new Map();
  const payments = await prisma.billPayment.findMany({ where: { billId: { in: billIds } } });
  const map = new Map<string, Set<string>>();
  for (const p of payments) {
    if (!map.has(p.billId)) map.set(p.billId, new Set());
    map.get(p.billId)!.add(isoDate(p.dueDate));
  }
  return map;
}

billsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const bills = await prisma.bill.findMany({
      where: { userId: req.userId!, active: true },
      orderBy: { name: "asc" },
    });
    const paidMap = await paidDueDatesByBill(bills.map((b) => b.id));

    res.json(
      bills.map((b) => {
        const cycle = computeCurrentCycle(b, paidMap.get(b.id) ?? new Set());
        return {
          id: b.id,
          name: b.name,
          amount: b.amount,
          category: b.category,
          recurrence: b.recurrence,
          anchorDueDate: b.anchorDueDate,
          autoDetectKeyword: b.autoDetectKeyword,
          currentCycle: cycle
            ? { dueDate: cycle.dueDate, isPaid: cycle.isPaid, isOverdue: !cycle.isPaid && cycle.dueDate < new Date() }
            : null,
        };
      })
    );
  } catch (err) {
    next(err);
  }
});

billsRouter.get("/upcoming", async (req: AuthedRequest, res, next) => {
  try {
    const days = z.coerce.number().int().min(1).max(365).default(30).parse(req.query.days);
    const horizon = new Date(Date.now() + days * 86400000);

    const bills = await prisma.bill.findMany({ where: { userId: req.userId!, active: true } });
    const paidMap = await paidDueDatesByBill(bills.map((b) => b.id));

    const upcoming = bills
      .map((b) => {
        const cycle = computeCurrentCycle(b, paidMap.get(b.id) ?? new Set());
        if (!cycle || cycle.isPaid || cycle.dueDate > horizon) return null;
        return {
          billId: b.id,
          name: b.name,
          amount: b.amount,
          dueDate: cycle.dueDate,
          isOverdue: cycle.dueDate < new Date(),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

    res.json(upcoming);
  } catch (err) {
    next(err);
  }
});

const billSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.coerce.number().positive().max(10_000_000),
  category: z.string().trim().max(100).optional(),
  recurrence: z.nativeEnum(BillRecurrence),
  anchorDueDate: z.coerce.date(),
  autoDetectKeyword: z.string().trim().max(100).optional(),
});

billsRouter.post("/", async (req: AuthedRequest, res, next) => {
  try {
    const data = billSchema.parse(req.body);
    const bill = await prisma.bill.create({
      data: { ...data, userId: req.userId! },
    });
    if (bill.autoDetectKeyword) {
      await matchTransactionsToBills(req.userId!);
    }
    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
});

billsRouter.put("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!existing) return res.status(404).json({ error: "Not found" });

    const data = billSchema.parse(req.body);
    const bill = await prisma.bill.update({ where: { id: existing.id }, data });
    if (bill.autoDetectKeyword) {
      await matchTransactionsToBills(req.userId!);
    }
    res.json(bill);
  } catch (err) {
    next(err);
  }
});

billsRouter.delete("/:id", async (req: AuthedRequest, res, next) => {
  try {
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!bill) return res.status(404).json({ error: "Not found" });
    await prisma.bill.delete({ where: { id: bill.id } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

billsRouter.get("/:id/payments", async (req: AuthedRequest, res, next) => {
  try {
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!bill) return res.status(404).json({ error: "Not found" });

    const payments = await prisma.billPayment.findMany({
      where: { billId: bill.id },
      orderBy: { dueDate: "desc" },
      include: { transaction: { select: { name: true, merchantName: true } } },
    });
    res.json(payments);
  } catch (err) {
    next(err);
  }
});

const markPaidSchema = z.object({
  dueDate: z.coerce.date(),
  amountPaid: z.coerce.number().positive().max(10_000_000).optional(),
});

billsRouter.post("/:id/payments", async (req: AuthedRequest, res, next) => {
  try {
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!bill) return res.status(404).json({ error: "Not found" });

    const { dueDate, amountPaid } = markPaidSchema.parse(req.body);
    const payment = await prisma.billPayment.upsert({
      where: { billId_dueDate: { billId: bill.id, dueDate } },
      create: {
        billId: bill.id,
        userId: req.userId!,
        dueDate,
        paidAt: new Date(),
        amountPaid: amountPaid ?? bill.amount,
      },
      update: { paidAt: new Date(), amountPaid: amountPaid ?? bill.amount },
    });
    res.status(201).json(payment);
  } catch (err) {
    next(err);
  }
});

billsRouter.delete("/:id/payments/:dueDate", async (req: AuthedRequest, res, next) => {
  try {
    const bill = await prisma.bill.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!bill) return res.status(404).json({ error: "Not found" });

    const dueDate = z.coerce.date().parse(req.params.dueDate);
    await prisma.billPayment.deleteMany({ where: { billId: bill.id, dueDate } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
