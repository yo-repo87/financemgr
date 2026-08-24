import crypto from "crypto";
import { prisma } from "./prisma";
import { hashToken } from "./crypto";

function generateCode(): string {
  // 8 hex chars grouped as XXXX-XXXX, easy to read/type.
  const raw = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

// Invalidates any existing unused codes and issues a fresh set of 10. Only the
// plaintext codes are returned - and only ever this once. The DB keeps only hashes.
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  await prisma.backupCode.updateMany({ where: { userId, used: false }, data: { used: true, usedAt: new Date() } });

  const codes = Array.from({ length: 10 }, generateCode);
  await prisma.backupCode.createMany({
    data: codes.map((code) => ({ userId, codeHash: hashToken(code) })),
  });
  return codes;
}

export async function countRemainingBackupCodes(userId: string): Promise<number> {
  return prisma.backupCode.count({ where: { userId, used: false } });
}

export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const normalized = code.trim().toUpperCase();
  const codeHash = hashToken(normalized);
  const record = await prisma.backupCode.findFirst({ where: { userId, codeHash, used: false } });
  if (!record) return false;
  await prisma.backupCode.update({ where: { id: record.id }, data: { used: true, usedAt: new Date() } });
  return true;
}
