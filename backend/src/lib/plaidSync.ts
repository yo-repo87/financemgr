import { CountryCode } from "plaid";
import { plaidClient } from "./plaidClient";
import { prisma } from "./prisma";
import { decryptField } from "./crypto";
import { logger } from "./logger";
import { matchTransactionsToBills } from "./billMatching";

// Plaid gives last_statement_issue_date but not a guaranteed forward-looking closing
// date, so we estimate the next one as one statement cycle (~1 calendar month) later.
// This is surfaced to the user as an estimate, never as a guaranteed date.
function estimateNextClosingDate(lastIssueDate: Date | null | undefined): Date | null {
  if (!lastIssueDate) return null;
  const next = new Date(lastIssueDate);
  next.setMonth(next.getMonth() + 1);
  return next;
}

export async function syncPlaidItem(plaidItemDbId: string): Promise<void> {
  const item = await prisma.plaidItem.findUnique({ where: { id: plaidItemDbId } });
  if (!item) throw new Error("Plaid item not found");

  const accessToken = decryptField(item.accessTokenEncrypted);

  // --- Balances / accounts ---
  const accountsResp = await plaidClient.accountsGet({ access_token: accessToken });
  for (const acct of accountsResp.data.accounts) {
    await prisma.account.upsert({
      where: { plaidAccountId: acct.account_id },
      create: {
        plaidItemId: item.id,
        plaidAccountId: acct.account_id,
        name: acct.name,
        mask: acct.mask ?? undefined,
        type: acct.type,
        subtype: acct.subtype ?? undefined,
        currentBalance: acct.balances.current ?? undefined,
        availableBalance: acct.balances.available ?? undefined,
        creditLimit: acct.balances.limit ?? undefined,
        isoCurrencyCode: acct.balances.iso_currency_code ?? undefined,
      },
      update: {
        name: acct.name,
        mask: acct.mask ?? undefined,
        currentBalance: acct.balances.current ?? undefined,
        availableBalance: acct.balances.available ?? undefined,
        creditLimit: acct.balances.limit ?? undefined,
      },
    });
  }

  // --- Credit card liabilities (statement closing dates, min payment, etc.) ---
  try {
    const liabilitiesResp = await plaidClient.liabilitiesGet({ access_token: accessToken });
    for (const card of liabilitiesResp.data.liabilities?.credit ?? []) {
      const account = await prisma.account.findUnique({ where: { plaidAccountId: card.account_id! } });
      if (!account) continue;
      const lastIssueDate = card.last_statement_issue_date ? new Date(card.last_statement_issue_date) : null;
      await prisma.creditCardDetail.upsert({
        where: { accountId: account.id },
        create: {
          accountId: account.id,
          lastStatementIssueDate: lastIssueDate ?? undefined,
          estimatedNextClosingDate: estimateNextClosingDate(lastIssueDate) ?? undefined,
          lastStatementBalance: card.last_statement_balance ?? undefined,
          minimumPaymentAmount: card.minimum_payment_amount ?? undefined,
          nextPaymentDueDate: card.next_payment_due_date ? new Date(card.next_payment_due_date) : undefined,
          lastPaymentAmount: card.last_payment_amount ?? undefined,
        },
        update: {
          lastStatementIssueDate: lastIssueDate ?? undefined,
          estimatedNextClosingDate: estimateNextClosingDate(lastIssueDate) ?? undefined,
          lastStatementBalance: card.last_statement_balance ?? undefined,
          minimumPaymentAmount: card.minimum_payment_amount ?? undefined,
          nextPaymentDueDate: card.next_payment_due_date ? new Date(card.next_payment_due_date) : undefined,
          lastPaymentAmount: card.last_payment_amount ?? undefined,
        },
      });
    }
  } catch (err) {
    // Not every institution/account supports liabilities - don't fail the whole sync.
    logger.warn({ err, itemId: item.id }, "Liabilities fetch failed, continuing sync");
  }

  // --- Transactions (cursor-based sync) ---
  let cursor = item.cursor ?? undefined;
  let hasMore = true;
  while (hasMore) {
    const resp = await plaidClient.transactionsSync({ access_token: accessToken, cursor });
    const { added, modified, removed, next_cursor, has_more } = resp.data;

    for (const txn of [...added, ...modified]) {
      const account = await prisma.account.findUnique({ where: { plaidAccountId: txn.account_id } });
      if (!account) continue;
      await prisma.transaction.upsert({
        where: { plaidTransactionId: txn.transaction_id },
        create: {
          accountId: account.id,
          plaidTransactionId: txn.transaction_id,
          amount: txn.amount,
          isoCurrencyCode: txn.iso_currency_code ?? undefined,
          date: new Date(txn.date),
          name: txn.name,
          merchantName: txn.merchant_name ?? undefined,
          category: txn.personal_finance_category?.primary ?? txn.category?.[0] ?? undefined,
          pending: txn.pending,
        },
        update: {
          amount: txn.amount,
          name: txn.name,
          merchantName: txn.merchant_name ?? undefined,
          category: txn.personal_finance_category?.primary ?? txn.category?.[0] ?? undefined,
          pending: txn.pending,
        },
      });
    }
    for (const rem of removed) {
      if (!rem.transaction_id) continue;
      await prisma.transaction.deleteMany({ where: { plaidTransactionId: rem.transaction_id } });
    }

    cursor = next_cursor;
    hasMore = has_more;
  }

  await prisma.plaidItem.update({
    where: { id: item.id },
    data: { cursor, lastSyncedAt: new Date() },
  });

  await recordNetWorthSnapshot(item.userId);
  await matchTransactionsToBills(item.userId);
}

// Assets (depository/investment) add to net worth; liabilities (credit/loan) subtract.
async function recordNetWorthSnapshot(userId: string): Promise<void> {
  const accounts = await prisma.account.findMany({ where: { plaidItem: { userId } } });
  let netWorth = 0;
  for (const acct of accounts) {
    const balance = Number(acct.currentBalance ?? 0);
    netWorth += acct.type === "credit" || acct.type === "loan" ? -balance : balance;
  }
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  await prisma.balanceSnapshot.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, netWorth },
    update: { netWorth },
  });
}

export const PLAID_COUNTRY_CODES = [CountryCode.Us];
