import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const accountsRouter = Router();

accountsRouter.use(requireAuth);

accountsRouter.get("/", async (req: AuthedRequest, res, next) => {
  try {
    const accounts = await prisma.account.findMany({
      where: { plaidItem: { userId: req.userId! } },
      include: { creditCardDetail: true, plaidItem: { select: { institutionName: true } } },
      orderBy: { name: "asc" },
    });
    res.json(accounts);
  } catch (err) {
    next(err);
  }
});
