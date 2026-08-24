import { prisma } from "./prisma";
import { computeUpcomingDueDates, isoDate } from "./billing";
import { logger } from "./logger";

const MATCH_WINDOW_DAYS = 7;

// Links already-synced transactions to the nearest unpaid bill cycle for every
// active bill with an autoDetectKeyword set (e.g. "flex" for Flex rent-split
// withdrawals). Called after every Plaid sync and once whenever a bill's
// keyword is set/changed (as a backfill over transaction history already synced).
// Idempotent: a transaction already linked to any BillPayment is never
// reconsidered, so re-running is always safe.
export async function matchTransactionsToBills(userId: string): Promise<void> {
  const bills = await prisma.bill.findMany({
    where: { userId, active: true, autoDetectKeyword: { not: null } },
  });

  for (const bill of bills) {
    const keyword = bill.autoDetectKeyword?.trim();
    if (!keyword) continue;

    try {
      const candidates = await prisma.transaction.findMany({
        where: {
          account: { plaidItem: { userId } },
          billPayments: { none: {} },
          OR: [
            { name: { contains: keyword, mode: "insensitive" } },
            { merchantName: { contains: keyword, mode: "insensitive" } },
          ],
        },
        orderBy: { date: "asc" },
      });
      if (candidates.length === 0) continue;

      const existingPayments = await prisma.billPayment.findMany({ where: { billId: bill.id } });
      const paidDueDates = new Set(existingPayments.map((p) => isoDate(p.dueDate)));

      for (const txn of candidates) {
        const windowStart = new Date(txn.date.getTime() - MATCH_WINDOW_DAYS * 86400000);
        const windowEnd = new Date(txn.date.getTime() + MATCH_WINDOW_DAYS * 86400000);
        const occurrences = computeUpcomingDueDates(bill, 10, windowStart).filter((d) => d <= windowEnd);

        let nearest: Date | null = null;
        let nearestDelta = Infinity;
        for (const occ of occurrences) {
          if (paidDueDates.has(isoDate(occ))) continue;
          const delta = Math.abs(occ.getTime() - txn.date.getTime());
          if (delta < nearestDelta) {
            nearestDelta = delta;
            nearest = occ;
          }
        }
        if (!nearest) continue;

        await prisma.billPayment.upsert({
          where: { billId_dueDate: { billId: bill.id, dueDate: nearest } },
          create: {
            billId: bill.id,
            userId,
            dueDate: nearest,
            paidAt: txn.date,
            amountPaid: txn.amount,
            transactionId: txn.id,
          },
          update: { paidAt: txn.date, amountPaid: txn.amount, transactionId: txn.id },
        });
        paidDueDates.add(isoDate(nearest));
      }
    } catch (err) {
      // One bill's matching failing shouldn't block sync or other bills.
      logger.error({ err, billId: bill.id }, "Bill auto-match failed");
    }
  }
}
