import { Router } from "express";
import argon2 from "argon2";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { pickRandomQuestionIds, normalizeAnswer, getQuestionText } from "../lib/securityQuestions";
import {
  setResetSessionCookie,
  clearResetSessionCookie,
  verifyResetSessionToken,
  setPasswordResetTokenCookie,
  clearPasswordResetTokenCookie,
  verifyPasswordResetToken,
  revokeAllRefreshTokens,
} from "../lib/tokens";
import { authRateLimiter } from "../middleware/rateLimiter";

export const passwordResetRouter = Router();

const startSchema = z.object({ email: z.string().trim().toLowerCase().email().max(255) });

passwordResetRouter.post("/start", authRateLimiter, async (req, res, next) => {
  try {
    const { email } = startSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    const realQuestions = user
      ? await prisma.securityQuestion.findMany({ where: { userId: user.id }, select: { questionId: true } })
      : [];

    // Unknown email, or a legacy account with no questions configured: serve
    // decoy questions from the same shared pool so the response is indistinguishable
    // from a real account's, and verify-answers below always fails for these.
    const questionIds =
      user && realQuestions.length >= 3 ? realQuestions.map((q) => q.questionId) : pickRandomQuestionIds(3);

    setResetSessionCookie(res, {
      uid: user && realQuestions.length >= 3 ? user.id : null,
      questionIds,
    });

    res.json({
      questions: questionIds.map((id) => ({ questionId: id, text: getQuestionText(id) })),
    });
  } catch (err) {
    next(err);
  }
});

const verifyAnswersSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), answer: z.string().trim().min(1).max(200) })).length(3),
});

passwordResetRouter.post("/verify-answers", authRateLimiter, async (req, res, next) => {
  try {
    const { answers } = verifyAnswersSchema.parse(req.body);
    const session = req.cookies?.reset_session ? verifyResetSessionToken(req.cookies.reset_session) : null;
    if (!session) {
      return res.status(401).json({ error: "Reset session expired, please start over" });
    }

    const submittedIds = new Set(answers.map((a) => a.questionId));
    const sameQuestions =
      submittedIds.size === session.questionIds.length && session.questionIds.every((id) => submittedIds.has(id));

    if (!session.uid || !sameQuestions) {
      return res.status(401).json({ error: "Incorrect answers" });
    }

    const stored = await prisma.securityQuestion.findMany({
      where: { userId: session.uid, questionId: { in: session.questionIds } },
    });
    const storedByQuestion = new Map(stored.map((s) => [s.questionId, s.answerHash]));

    let allMatch = stored.length === session.questionIds.length;
    for (const a of answers) {
      const hash = storedByQuestion.get(a.questionId);
      if (!hash || !(await argon2.verify(hash, normalizeAnswer(a.answer)))) {
        allMatch = false;
      }
    }

    if (!allMatch) {
      return res.status(401).json({ error: "Incorrect answers" });
    }

    clearResetSessionCookie(res);
    setPasswordResetTokenCookie(res, session.uid);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

const completeSchema = z.object({
  newPassword: z.string().min(10, "Password must be at least 10 characters").max(256),
});

passwordResetRouter.post("/complete", authRateLimiter, async (req, res, next) => {
  try {
    const { newPassword } = completeSchema.parse(req.body);
    const token = req.cookies?.password_reset_token;
    const userId = token ? verifyPasswordResetToken(token) : null;
    if (!userId) {
      return res.status(401).json({ error: "Reset session expired, please start over" });
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Whoever answered the questions might not be the account owner - force
    // every existing session to re-authenticate under the new password.
    await revokeAllRefreshTokens(userId);

    clearPasswordResetTokenCookie(res);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
