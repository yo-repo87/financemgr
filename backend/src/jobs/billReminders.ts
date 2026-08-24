import cron from "node-cron";
import { BillReminderKind } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { computeCurrentCycle, isoDate } from "../lib/billing";
import { sendPushToUser } from "../lib/push";
import { pushConfigured } from "../lib/env";
import { logger } from "../lib/logger";

const DUE_SOON_WINDOW_DAYS = 3;

function formatCurrency(amount: string): string {
  return Number(amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

async function maybeSendReminder(
  billId: string,
  userId: string,
  billName: string,
  amount: string,
  dueDate: Date,
  kind: BillReminderKind
): Promise<void> {
  try {
    await prisma.billReminderSent.create({ data: { billId, dueDate, kind } });
  } catch {
    // Unique constraint hit - already sent for this (bill, cycle, kind).
    return;
  }

  const title = kind === "OVERDUE" ? `${billName} is overdue` : `${billName} due soon`;
  const body =
    kind === "OVERDUE"
      ? `${formatCurrency(amount)} was due ${isoDate(dueDate)}.`
      : `${formatCurrency(amount)} is due ${isoDate(dueDate)}.`;

  await sendPushToUser(userId, { title, body, url: "/bills" });
}

async function checkBillReminders(): Promise<void> {
  const bills = await prisma.bill.findMany({ where: { active: true } });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const bill of bills) {
    try {
      const payments = await prisma.billPayment.findMany({ where: { billId: bill.id } });
      const paidDueDates = new Set(payments.map((p) => isoDate(p.dueDate)));
      const cycle = computeCurrentCycle(bill, paidDueDates);
      if (!cycle || cycle.isPaid) continue;

      const daysUntilDue = Math.round((cycle.dueDate.getTime() - today.getTime()) / 86400000);
      if (daysUntilDue < 0) {
        await maybeSendReminder(bill.id, bill.userId, bill.name, bill.amount.toString(), cycle.dueDate, "OVERDUE");
      } else if (daysUntilDue <= DUE_SOON_WINDOW_DAYS) {
        await maybeSendReminder(bill.id, bill.userId, bill.name, bill.amount.toString(), cycle.dueDate, "UPCOMING");
      }
    } catch (err) {
      logger.error({ err, billId: bill.id }, "Bill reminder check failed");
    }
  }
}

export function startBillReminderJob() {
  if (!pushConfigured) {
    logger.info("Push notifications not configured, skipping bill reminder job");
    return;
  }

  // Once daily.
  cron.schedule("0 9 * * *", () => {
    logger.info("Running bill reminder check");
    checkBillReminders().catch((err) => logger.error({ err }, "Bill reminder job failed"));
  });
}

// Exported for direct invocation (verification / manual trigger), separate
// from the cron wrapper above.
export { checkBillReminders };
