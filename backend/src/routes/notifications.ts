import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { env, pushConfigured } from "../lib/env";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const notificationsRouter = Router();

notificationsRouter.get("/vapid-public-key", (_req, res) => {
  if (!pushConfigured) return res.status(503).json({ error: "Push notifications are not configured" });
  res.json({ publicKey: env.vapidPublicKey });
});

notificationsRouter.use(requireAuth);

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

notificationsRouter.post("/subscribe", async (req: AuthedRequest, res, next) => {
  try {
    const { endpoint, keys } = subscriptionSchema.parse(req.body);
    const userAgent = req.headers["user-agent"]?.slice(0, 255);

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: { userId: req.userId!, endpoint, p256dh: keys.p256dh, auth: keys.auth, userAgent },
      update: { userId: req.userId!, p256dh: keys.p256dh, auth: keys.auth, userAgent },
    });

    // A fresh subscription implies the user wants notifications again even if
    // they'd previously toggled off - matches turning the Settings switch back on.
    await prisma.notificationSetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, pushEnabled: true },
      update: { pushEnabled: true },
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.delete("/subscribe", async (req: AuthedRequest, res, next) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string().url() }).parse(req.body);
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId! } });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.get("/settings", async (req: AuthedRequest, res, next) => {
  try {
    const [setting, subscriptionCount] = await Promise.all([
      prisma.notificationSetting.findUnique({ where: { userId: req.userId! } }),
      prisma.pushSubscription.count({ where: { userId: req.userId! } }),
    ]);
    res.json({ pushEnabled: setting?.pushEnabled ?? true, subscriptionCount });
  } catch (err) {
    next(err);
  }
});

notificationsRouter.put("/settings", async (req: AuthedRequest, res, next) => {
  try {
    const { pushEnabled } = z.object({ pushEnabled: z.boolean() }).parse(req.body);
    const setting = await prisma.notificationSetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, pushEnabled },
      update: { pushEnabled },
    });
    res.json({ pushEnabled: setting.pushEnabled });
  } catch (err) {
    next(err);
  }
});
