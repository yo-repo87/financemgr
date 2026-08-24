import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { detectIncome } from "../lib/incomeDetection";
import { computeForecast } from "../lib/cashFlowForecast";
import { sendPushToUser } from "../lib/push";
import { logger } from "../lib/logger";

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// One daily pass per user: detect recurring income, then forecast cash flow
// and alert on a newly-identified low point below the user's threshold.
// CashFlowAlertSent is keyed on (userId, alertDate) so the same projected dip
// only pages the user once, not every day it's still in the forward window.
async function runDailyCashFlowJob(): Promise<void> {
  const userIds = await prisma.plaidItem.findMany({
    where: { status: "active" },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of userIds) {
    try {
      await detectIncome(userId);

      const forecast = await computeForecast(userId, 30);
      if (forecast.lowestBalance >= forecast.threshold) continue;

      const already = await prisma.cashFlowAlertSent.findUnique({
        where: { userId_alertDate: { userId, alertDate: new Date(forecast.lowestBalanceDate) } },
      });
      if (already) continue;

      await prisma.cashFlowAlertSent.create({
        data: { userId, alertDate: new Date(forecast.lowestBalanceDate) },
      });
      await sendPushToUser(userId, {
        title: "Low balance projected",
        body: `Your balance is projected to drop to ${formatCurrency(forecast.lowestBalance)} on ${forecast.lowestBalanceDate}.`,
        url: "/cashflow",
      });
    } catch (err) {
      logger.error({ err, userId }, "Cash flow job failed for user");
    }
  }
}

export function startIncomeDetectionJob() {
  // Once daily, after subscription detection so DetectedSubscription rows are fresh.
  cron.schedule("15 10 * * *", () => {
    logger.info("Running income detection + cash flow forecast");
    runDailyCashFlowJob().catch((err) => logger.error({ err }, "Cash flow job failed"));
  });
}

export { runDailyCashFlowJob };
