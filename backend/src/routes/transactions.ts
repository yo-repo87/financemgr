import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { normalizeMerchantKey } from "../lib/subscriptionDetection";

export const transactionsRouter = Router();

transactionsRouter.use(requireAuth);

const querySchema = z.object({
  category: z.string().optional(),
  accountId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

transactionsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const q = querySchema.parse(req.query);
    const [transactions, recurringMerchants] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          account: { plaidItem: { userId: req.userId! } },
          ...(q.category ? { category: q.category } : {}),
          ...(q.accountId ? { accountId: q.accountId } : {}),
          ...(q.search ? { name: { contains: q.search, mode: "insensitive" } } : {}),
          ...(q.from || q.to
            ? { date: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(q.to) } : {}) } }
            : {}),
        },
        orderBy: { date: "desc" },
        take: q.limit,
        skip: q.offset,
        include: { account: { select: { name: true, mask: true } } },
      }),
      // NEW + TRACKED merchant keys from the subscription-detection feature -
      // DISMISSED ones are excluded so a transaction the user already said
      // "not a subscription" about doesn't keep getting flagged.
      prisma.detectedSubscription.findMany({
        where: { userId: req.userId!, status: { in: ["NEW", "TRACKED"] } },
        select: { merchantKey: true },
      }),
    ]);

    const recurringKeys = new Set(recurringMerchants.map((m) => m.merchantKey));
    res.json(
      transactions.map((t) => ({
        ...t,
        isRecurring: recurringKeys.has(normalizeMerchantKey(t.merchantName || t.name)),
      }))
    );
  } catch (err) {
    next(err);
  }
});

transactionsRouter.get("/categories", async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.transaction.findMany({
      where: { account: { plaidItem: { userId: req.userId! } }, category: { not: null } },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });
    res.json(rows.map((r) => r.category).filter((c): c is string => Boolean(c)));
  } catch (err) {
    next(err);
  }
});

const categorySchema = z.object({ category: z.string().trim().min(1).max(100) });

// Corrects one transaction's category and remembers the correction for that
// merchant so future synced transactions inherit it automatically (see
// plaidSync.ts) - Plaid's auto-categorization isn't always right.
transactionsRouter.patch("/:id/category", async (req: AuthedRequest, res, next) => {
  try {
    const transaction = await prisma.transaction.findFirst({
      where: { id: req.params.id, account: { plaidItem: { userId: req.userId! } } },
    });
    if (!transaction) return res.status(404).json({ error: "Not found" });

    const { category } = categorySchema.parse(req.body);
    const merchantKey = normalizeMerchantKey(transaction.merchantName || transaction.name);

    const [updated] = await prisma.$transaction([
      prisma.transaction.update({ where: { id: transaction.id }, data: { category } }),
      prisma.categoryOverride.upsert({
        where: { userId_merchantKey: { userId: req.userId!, merchantKey } },
        create: { userId: req.userId!, merchantKey, category },
        update: { category },
      }),
    ]);

    res.json(updated);
  } catch (err) {
    next(err);
  }
});
