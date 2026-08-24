import { prisma } from "./prisma";
import { sendPushToUser } from "./push";

const PRICE_INCREASE_THRESHOLD = 0.05; // 5%

function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

const LOOKBACK_MONTHS = 6;
const MIN_GAP_DAYS = 25;
const MAX_GAP_DAYS = 35;
const MIN_QUALIFYING_GAPS = 2; // 2 gaps = 3 charges at a steady ~monthly cadence
const AMOUNT_TOLERANCE = 0.1; // 10%

// Lowercase/trim/collapse whitespace, and drop a trailing run of digits/
// dashes/asterisks - the transaction-ID suffixes some merchants append (e.g.
// "NETFLIX.COM*A1B2C3") that would otherwise split one subscription into
// several distinct groups.
export function normalizeMerchantKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[\s*#-]*[\d*#-]{4,}$/, "")
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

interface Candidate {
  merchantKey: string;
  displayName: string;
  amount: number;
  lastChargedDate: Date;
  occurrenceCount: number;
}

function findSubscriptionCandidates(
  transactions: { name: string; merchantName: string | null; amount: unknown; date: Date }[]
): Candidate[] {
  const groups = new Map<string, { displayName: string; date: Date; amount: number }[]>();

  for (const txn of transactions) {
    const rawName = txn.merchantName || txn.name;
    const key = normalizeMerchantKey(rawName);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push({ displayName: rawName, date: txn.date, amount: Number(txn.amount) });
  }

  const candidates: Candidate[] = [];

  for (const [merchantKey, entries] of groups) {
    if (entries.length < MIN_QUALIFYING_GAPS + 1) continue;
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    const med = median(entries.map((e) => e.amount));
    let qualifyingGaps = 0;
    for (let i = 1; i < entries.length; i++) {
      const gapDays = (entries[i].date.getTime() - entries[i - 1].date.getTime()) / 86400000;
      const amountRatioOk =
        Math.abs(entries[i].amount - med) <= med * AMOUNT_TOLERANCE &&
        Math.abs(entries[i - 1].amount - med) <= med * AMOUNT_TOLERANCE;
      if (gapDays >= MIN_GAP_DAYS && gapDays <= MAX_GAP_DAYS && amountRatioOk) {
        qualifyingGaps++;
      }
    }

    if (qualifyingGaps >= MIN_QUALIFYING_GAPS) {
      const latest = entries[entries.length - 1];
      candidates.push({
        merchantKey,
        displayName: latest.displayName,
        amount: latest.amount,
        lastChargedDate: latest.date,
        occurrenceCount: entries.length,
      });
    }
  }

  return candidates;
}

// Scans a user's recent transaction history for recurring ~monthly charges
// (excluding anything already tracked as a Bill) and upserts DetectedSubscription
// rows. Never overwrites a row the user has already DISMISSED or TRACKED - only
// NEW rows get refreshed with the latest amount/date/count on re-detection.
export async function detectSubscriptions(userId: string): Promise<void> {
  const since = new Date();
  since.setMonth(since.getMonth() - LOOKBACK_MONTHS);

  const transactions = await prisma.transaction.findMany({
    where: {
      account: { plaidItem: { userId } },
      date: { gte: since },
      amount: { gt: 0 },
      billPayments: { none: {} },
    },
    select: { name: true, merchantName: true, amount: true, date: true },
  });

  const candidates = findSubscriptionCandidates(transactions);
  if (candidates.length === 0) return;

  const existing = await prisma.detectedSubscription.findMany({ where: { userId } });
  const existingByKey = new Map(existing.map((e) => [e.merchantKey, e]));

  for (const candidate of candidates) {
    const current = existingByKey.get(candidate.merchantKey);
    // DISMISSED means the user already said "not a subscription" - leave it alone.
    // NEW and TRACKED both still refresh on re-detection, since a TRACKED
    // subscription's price can still go up and the user should hear about that.
    if (current && current.status === "DISMISSED") continue;

    if (current && candidate.amount > Number(current.amount) * (1 + PRICE_INCREASE_THRESHOLD)) {
      await sendPushToUser(userId, {
        title: "Subscription price increase",
        body: `${candidate.displayName} increased: ${formatCurrency(Number(current.amount))} → ${formatCurrency(candidate.amount)}`,
        url: "/bills",
      });
    }

    await prisma.detectedSubscription.upsert({
      where: { userId_merchantKey: { userId, merchantKey: candidate.merchantKey } },
      create: {
        userId,
        merchantKey: candidate.merchantKey,
        displayName: candidate.displayName,
        amount: candidate.amount,
        lastChargedDate: candidate.lastChargedDate,
        occurrenceCount: candidate.occurrenceCount,
      },
      update: {
        displayName: candidate.displayName,
        amount: candidate.amount,
        lastChargedDate: candidate.lastChargedDate,
        occurrenceCount: candidate.occurrenceCount,
      },
    });
  }
}
