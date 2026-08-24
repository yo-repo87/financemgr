import { prisma } from "./prisma";
import { normalizeMerchantKey } from "./subscriptionDetection";

const LOOKBACK_MONTHS = 6;
const MIN_QUALIFYING_GAPS = 2;
const AMOUNT_TOLERANCE = 0.1; // 10%
const GAP_TOLERANCE = 0.2; // 20% - paycheck timing shifts around weekends/holidays more than bills do

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface Candidate {
  merchantKey: string;
  displayName: string;
  amount: number;
  cadenceDays: number;
  lastReceivedDate: Date;
  occurrenceCount: number;
}

// Same gap+amount-tolerance grouping approach as subscriptionDetection.ts, but
// the cadence itself is discovered (median gap) rather than fixed to ~monthly,
// since paychecks are commonly weekly/biweekly/semi-monthly rather than monthly.
function findIncomeCandidates(
  transactions: { name: string; merchantName: string | null; amount: unknown; date: Date }[]
): Candidate[] {
  const groups = new Map<string, { displayName: string; date: Date; amount: number }[]>();

  for (const txn of transactions) {
    const rawName = txn.merchantName || txn.name;
    const key = normalizeMerchantKey(rawName);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ displayName: rawName, date: txn.date, amount: Math.abs(Number(txn.amount)) });
  }

  const candidates: Candidate[] = [];

  for (const [merchantKey, entries] of groups) {
    if (entries.length < MIN_QUALIFYING_GAPS + 1) continue;
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const amountMed = median(entries.map((e) => e.amount));
    const gaps: number[] = [];
    for (let i = 1; i < entries.length; i++) {
      gaps.push((entries[i].date.getTime() - entries[i - 1].date.getTime()) / 86400000);
    }
    const gapMed = median(gaps);
    if (gapMed < 5) continue; // faster than weekly isn't a paycheck-shaped cadence

    let qualifyingGaps = 0;
    for (let i = 0; i < gaps.length; i++) {
      const gapOk = Math.abs(gaps[i] - gapMed) <= gapMed * GAP_TOLERANCE;
      const amountOk =
        Math.abs(entries[i + 1].amount - amountMed) <= amountMed * AMOUNT_TOLERANCE &&
        Math.abs(entries[i].amount - amountMed) <= amountMed * AMOUNT_TOLERANCE;
      if (gapOk && amountOk) qualifyingGaps++;
    }

    if (qualifyingGaps >= MIN_QUALIFYING_GAPS) {
      const latest = entries[entries.length - 1];
      candidates.push({
        merchantKey,
        displayName: latest.displayName,
        amount: latest.amount,
        cadenceDays: Math.round(gapMed),
        lastReceivedDate: latest.date,
        occurrenceCount: entries.length,
      });
    }
  }

  return candidates;
}

// Scans a user's recent deposits for recurring income (paychecks, etc). Mirrors
// detectSubscriptions' respect for prior user decisions - never overwrites a
// row already DISMISSED or CONFIRMED, only refreshes NEW ones.
export async function detectIncome(userId: string): Promise<void> {
  const since = new Date();
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS);

  const transactions = await prisma.transaction.findMany({
    where: { account: { plaidItem: { userId } }, date: { gte: since }, amount: { lt: 0 } },
    select: { name: true, merchantName: true, amount: true, date: true },
  });

  const candidates = findIncomeCandidates(transactions);
  if (candidates.length === 0) return;

  const existing = await prisma.detectedIncome.findMany({ where: { userId } });
  const existingByKey = new Map(existing.map((e) => [e.merchantKey, e]));

  for (const candidate of candidates) {
    const current = existingByKey.get(candidate.merchantKey);
    if (current && current.status !== "NEW") continue;

    await prisma.detectedIncome.upsert({
      where: { userId_merchantKey: { userId, merchantKey: candidate.merchantKey } },
      create: { userId, ...candidate },
      update: {
        displayName: candidate.displayName,
        amount: candidate.amount,
        cadenceDays: candidate.cadenceDays,
        lastReceivedDate: candidate.lastReceivedDate,
        occurrenceCount: candidate.occurrenceCount,
      },
    });
  }
}
