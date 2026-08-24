import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { encryptField, decryptField } from "../lib/crypto";
import { buildOpenAiClient } from "../lib/openaiClient";
import { buildFinancialSnapshot } from "../lib/financialSnapshot";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { aiRateLimiter } from "../middleware/rateLimiter";

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.get("/settings", async (req: AuthedRequest, res, next) => {
  try {
    const setting = await prisma.aiSetting.findUnique({ where: { userId: req.userId! } });
    res.json({
      hasKey: Boolean(setting?.openaiApiKeyEncrypted),
      maskedKey: setting?.openaiKeyLastFour ? `sk-...${setting.openaiKeyLastFour}` : null,
      modelPreference: setting?.modelPreference ?? "gpt-4o-mini",
    });
  } catch (err) {
    next(err);
  }
});

const settingsSchema = z.object({
  openaiApiKey: z.string().trim().min(20).max(300).optional(),
  modelPreference: z.string().max(100).optional(),
});

aiRouter.put("/settings", async (req: AuthedRequest, res, next) => {
  try {
    const { openaiApiKey, modelPreference } = settingsSchema.parse(req.body);
    const data: { openaiApiKeyEncrypted?: string; openaiKeyLastFour?: string; modelPreference?: string } = {};
    if (openaiApiKey) {
      data.openaiApiKeyEncrypted = encryptField(openaiApiKey);
      data.openaiKeyLastFour = openaiApiKey.slice(-4);
    }
    if (modelPreference) data.modelPreference = modelPreference;

    const setting = await prisma.aiSetting.upsert({
      where: { userId: req.userId! },
      create: { userId: req.userId!, ...data },
      update: data,
    });
    res.json({
      hasKey: Boolean(setting.openaiApiKeyEncrypted),
      maskedKey: setting.openaiKeyLastFour ? `sk-...${setting.openaiKeyLastFour}` : null,
      modelPreference: setting.modelPreference,
    });
  } catch (err) {
    next(err);
  }
});

aiRouter.get("/messages", async (req: AuthedRequest, res, next) => {
  try {
    const messages = await prisma.aiMessage.findMany({
      where: { userId: req.userId! },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    res.json(messages.map((m) => ({ id: m.id, role: m.role, content: decryptField(m.contentEncrypted), createdAt: m.createdAt })));
  } catch (err) {
    next(err);
  }
});

const askSchema = z.object({ question: z.string().trim().min(1).max(4000) });

aiRouter.post("/ask", aiRateLimiter, async (req: AuthedRequest, res, next) => {
  try {
    const { question } = askSchema.parse(req.body);
    const setting = await prisma.aiSetting.findUnique({ where: { userId: req.userId! } });
    if (!setting?.openaiApiKeyEncrypted) {
      return res.status(400).json({ error: "Add your OpenAI API key in Settings before asking the advisor" });
    }

    const apiKey = decryptField(setting.openaiApiKeyEncrypted);
    const client = buildOpenAiClient(apiKey);
    const snapshot = await buildFinancialSnapshot(req.userId!);

    const systemPrompt = [
      "You are a careful, practical personal finance advisor.",
      "Use the financial snapshot below (the user's real account balances, recent spending by category, and budgets) to give specific, actionable advice.",
      "Be concise. Do not invent numbers not present in the snapshot. Flag any credit card statement dates or upcoming due dates that are relevant.",
      "\n" + snapshot,
    ].join("\n");

    await prisma.aiMessage.create({
      data: { userId: req.userId!, role: "user", contentEncrypted: encryptField(question) },
    });

    const completion = await client.chat.completions.create({
      model: setting.modelPreference || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    });

    const answer = completion.choices[0]?.message?.content ?? "I couldn't generate a response.";

    await prisma.aiMessage.create({
      data: { userId: req.userId!, role: "assistant", contentEncrypted: encryptField(answer) },
    });

    res.json({ answer });
  } catch (err) {
    next(err);
  }
});
