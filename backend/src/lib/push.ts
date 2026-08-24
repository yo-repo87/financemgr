import webpush from "web-push";
import { env, pushConfigured } from "./env";
import { prisma } from "./prisma";
import { logger } from "./logger";

if (pushConfigured) {
  webpush.setVapidDetails(env.vapidSubject, env.vapidPublicKey, env.vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

// Sends to every subscription on file for a user, skipping entirely if
// they've toggled notifications off (see NotificationSetting in Settings.tsx)
// or if VAPID isn't configured. Expired/revoked subscriptions (404/410 from
// the push service) are cleaned up as they're discovered.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!pushConfigured) return;

  const setting = await prisma.notificationSetting.findUnique({ where: { userId } });
  if (setting && !setting.pushEnabled) return;

  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subscriptions.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          logger.error({ err, subscriptionId: sub.id }, "Push send failed");
        }
      }
    })
  );
}
