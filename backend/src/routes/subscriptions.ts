import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const subscriptionsRouter = Router();

subscriptionsRouter.use(requireAuth);

subscriptionsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const subscriptions = await prisma.detectedSubscription.findMany({
      where: { userId: req.userId! },
      orderBy: { amount: "desc" },
    });
    res.json(subscriptions);
  } catch (err) {
    next(err);
  }
});

subscriptionsRouter.post("/:id/dismiss", async (req: AuthedRequest, res, next) => {
  try {
    const sub = await prisma.detectedSubscription.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!sub) return res.status(404).json({ error: "Not found" });
    const updated = await prisma.detectedSubscription.update({
      where: { id: sub.id },
      data: { status: "DISMISSED" },
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Bridges a detected subscription into a real, managed Bill (same creation
// path as POST /api/bills) - after this it behaves like any other bill:
// due-date reminders, payment history, etc.
subscriptionsRouter.post("/:id/track", async (req: AuthedRequest, res, next) => {
  try {
    const sub = await prisma.detectedSubscription.findFirst({ where: { id: req.params.id, userId: req.userId! } });
    if (!sub) return res.status(404).json({ error: "Not found" });

    const [bill] = await prisma.$transaction([
      prisma.bill.create({
        data: {
          userId: req.userId!,
          name: sub.displayName,
          amount: sub.amount,
          recurrence: "MONTHLY",
          anchorDueDate: sub.lastChargedDate,
        },
      }),
      prisma.detectedSubscription.update({ where: { id: sub.id }, data: { status: "TRACKED" } }),
    ]);

    res.status(201).json(bill);
  } catch (err) {
    next(err);
  }
});
