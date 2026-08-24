import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { SECURITY_QUESTIONS, isValidQuestionId, normalizeAnswer, getQuestionText } from "../lib/securityQuestions";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const securityQuestionsRouter = Router();

securityQuestionsRouter.get("/pool", (_req, res) => {
  res.json(SECURITY_QUESTIONS);
});

securityQuestionsRouter.get("/status", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.securityQuestion.findMany({
      where: { userId: req.userId! },
      select: { questionId: true },
    });
    res.json({
      configured: rows.length >= 3,
      questions: rows.map((r) => ({ questionId: r.questionId, text: getQuestionText(r.questionId) })),
    });
  } catch (err) {
    next(err);
  }
});

const questionAnswerSchema = z.object({
  questionId: z.string().refine(isValidQuestionId, "Unknown question"),
  answer: z.string().trim().min(1).max(200),
});

const setupSchema = z.object({
  questions: z.array(questionAnswerSchema).length(3),
});

function assertDistinctQuestions(questions: { questionId: string }[]) {
  const ids = new Set(questions.map((q) => q.questionId));
  if (ids.size !== questions.length) {
    throw Object.assign(new Error("Questions must be distinct"), { status: 400 });
  }
}

securityQuestionsRouter.post("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.securityQuestion.count({ where: { userId: req.userId! } });
    if (existing > 0) {
      return res.status(409).json({ error: "Security questions are already set - use the change flow instead" });
    }

    const { questions } = setupSchema.parse(req.body);
    assertDistinctQuestions(questions);

    const rows = await Promise.all(
      questions.map(async (q) => ({
        userId: req.userId!,
        questionId: q.questionId,
        answerHash: await argon2.hash(normalizeAnswer(q.answer), { type: argon2.argon2id }),
      }))
    );
    await prisma.securityQuestion.createMany({ data: rows });

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const changeSchema = z.object({
  password: z.string().min(1).optional(),
  questions: z.array(questionAnswerSchema).length(3),
});

securityQuestionsRouter.put("/", requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { password, questions } = changeSchema.parse(req.body);
    assertDistinctQuestions(questions);

    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ error: "Not found" });
    // OAuth-only accounts have no password to confirm - the authenticated session
    // is the only factor they have, same reasoning as the TOTP-disable guard below.
    if (user.passwordHash && !(password && (await argon2.verify(user.passwordHash, password)))) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    await prisma.$transaction([
      prisma.securityQuestion.deleteMany({ where: { userId: req.userId! } }),
      prisma.securityQuestion.createMany({
        data: await Promise.all(
          questions.map(async (q) => ({
            userId: req.userId!,
            questionId: q.questionId,
            answerHash: await argon2.hash(normalizeAnswer(q.answer), { type: argon2.argon2id }),
          }))
        ),
      }),
    ]);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
