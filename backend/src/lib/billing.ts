import { BillRecurrence } from "@prisma/client";

function addMonths(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDayOfTargetMonth = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return target;
}

// Adds `steps` recurrence intervals to `anchor` (steps may be negative to look
// backward). Month-end clamped for MONTHLY/YEARLY so an anchor of e.g. Jan 31
// lands on the last day of shorter months rather than rolling into March.
export function addInterval(anchor: Date, recurrence: BillRecurrence, steps: number): Date {
  switch (recurrence) {
    case "ONE_TIME":
      return anchor;
    case "WEEKLY":
      return new Date(anchor.getTime() + steps * 7 * 86400000);
    case "BIWEEKLY":
      return new Date(anchor.getTime() + steps * 14 * 86400000);
    case "MONTHLY":
      return addMonths(anchor, steps);
    case "YEARLY":
      return addMonths(anchor, steps * 12);
  }
}

function toDateOnlyUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Walks forward from anchorDueDate collecting occurrences at-or-after `from`,
// until `count` are found. ONE_TIME bills have exactly one occurrence,
// returned regardless of whether it's already past `from` when `from` predates
// the epoch-safe lookback used by computeCurrentCycle below.
export function computeUpcomingDueDates(
  bill: { anchorDueDate: Date; recurrence: BillRecurrence },
  count: number,
  from: Date = new Date()
): Date[] {
  const fromMidnight = toDateOnlyUTC(from);

  if (bill.recurrence === "ONE_TIME") {
    return bill.anchorDueDate >= fromMidnight ? [bill.anchorDueDate] : [];
  }

  const results: Date[] = [];
  const MAX_STEPS = 20000; // safety cap against a pathological anchor/recurrence combo
  for (let step = 0; step <= MAX_STEPS && results.length < count; step++) {
    const occurrence = addInterval(bill.anchorDueDate, bill.recurrence, step);
    if (occurrence >= fromMidnight) results.push(occurrence);
  }
  return results;
}

export interface CurrentCycle {
  dueDate: Date;
  isPaid: boolean;
}

// The cycle to surface as a bill's "current" status: the earliest unpaid
// occurrence starting one interval before today (so a just-missed due date
// still shows as overdue instead of silently skipping to next cycle), or the
// next occurrence if everything nearby is already paid.
export function computeCurrentCycle(
  bill: { anchorDueDate: Date; recurrence: BillRecurrence },
  paidDueDates: Set<string>
): CurrentCycle | null {
  const lookback = bill.recurrence === "ONE_TIME" ? new Date(0) : addInterval(new Date(), bill.recurrence, -1);
  const candidates = computeUpcomingDueDates(bill, 6, lookback);

  for (const d of candidates) {
    if (!paidDueDates.has(isoDate(d))) {
      return { dueDate: d, isPaid: false };
    }
  }
  if (candidates.length > 0) {
    return { dueDate: candidates[candidates.length - 1], isPaid: true };
  }
  return null;
}
