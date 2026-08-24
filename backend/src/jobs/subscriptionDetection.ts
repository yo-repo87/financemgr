import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { detectSubscriptions } from "../lib/subscriptionDetection";
import { sendPushToUser } from "../lib/push";
import { logger } from "../lib/logger";

function formatCurrency(amount: string): string {
  return Number(amount).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

// Runs detection for every user (independent of whether push is configured -
// the Subscriptions panel on the Bills page needs fresh data either way), then
// sends exactly one notification per subscription the first time it's found.
// sendPushToUser itself no-ops if push isn't configured or the user has it
// disabled, so no separate gate is needed here for the notify step.
async function checkSubscriptions(): Promise<void> {
  const userIds = await prisma.plaidItem.findMany({
    where: { status: "active" },
    select: { userId: true },
    distinct: ["userId"],
  });

  for (const { userId } of userIds) {
    try {
      await detectSubscriptions(userId);

      const unnotified = await prisma.detectedSubscription.findMany({
        where: { userId, status: "NEW", notifiedAt: null },
      });

      for (const sub of unnotified) {
        await prisma.detectedSubscription.update({ where: { id: sub.id }, data: { notifiedAt: new Date() } });
        await sendPushToUser(userId, {
          title: "New subscription detected",
          body: `${sub.displayName} — ${formatCurrency(sub.amount.toString())}/mo, charged ${sub.occurrenceCount} times.`,
          url: "/bills",
        });
      }
    } catch (err) {
      logger.error({ err, userId }, "Subscription detection failed");
    }
  }
}

export function startSubscriptionDetectionJob() {
  // Once daily.
  cron.schedule("0 10 * * *", () => {
    logger.info("Running subscription detection");
    checkSubscriptions().catch((err) => logger.error({ err }, "Subscription detection job failed"));
  });
}

export { checkSubscriptions };
