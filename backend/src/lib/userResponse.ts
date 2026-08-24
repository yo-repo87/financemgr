import { prisma } from "./prisma";

// Shared shape returned by every endpoint that hands back a logged-in user
// (register, login, passkey login, 2FA verification) so the frontend always
// knows whether the mandatory security-questions step still needs completing.
export async function buildUserResponse(userId: string) {
  const [user, securityQuestionCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.securityQuestion.count({ where: { userId } }),
  ]);
  return { id: user.id, email: user.email, hasSecurityQuestions: securityQuestionCount >= 3 };
}
