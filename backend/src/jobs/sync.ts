import cron from "node-cron";
import { prisma } from "../lib/prisma";
import { syncPlaidItem } from "../lib/plaidSync";
import { plaidConfigured } from "../lib/plaidClient";
import { logger } from "../lib/logger";

export function startSyncJob() {
  if (!plaidConfigured) {
    logger.info("Plaid not configured, skipping scheduled sync job");
    return;
  }

  // Every 6 hours.
  cron.schedule("0 */6 * * *", async () => {
    const items = await prisma.plaidItem.findMany({ where: { status: "active" } });
    logger.info({ count: items.length }, "Running scheduled Plaid sync");
    for (const item of items) {
      try {
        await syncPlaidItem(item.id);
      } catch (err) {
        logger.error({ err, itemId: item.id }, "Scheduled sync failed for item");
      }
    }
  });
}
