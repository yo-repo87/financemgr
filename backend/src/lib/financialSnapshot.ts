import { prisma } from "./prisma";

// Builds an aggregated, anonymized-of-secrets summary of the user's finances to
// hand to the LLM. Deliberately excludes Plaid access tokens, account/routing
// numbers, and full account numbers - only category-level spend and balances.
export async function buildFinancialSnapshot(userId: string): Promise<string> {
  const accounts = await prisma.account.findMany({
    where: { plaidItem: { userId } },
    include: { creditCardDetail: true },
  });

  const since = new Date();
  since.setDate(since.getDate() - 90);
  const spendByCategory = await prisma.transaction.groupBy({
    by: ["category"],
    where: { account: { plaidItem: { userId } }, date: { gte: since }, amount: { gt: 0 } },
    _sum: { amount: true },
  });

  const budgets = await prisma.budget.findMany({ where: { userId } });

  const lines: string[] = [];
  lines.push("=== Accounts ===");
  for (const a of accounts) {
    lines.push(
      `- ${a.name} (${a.type}${a.subtype ? "/" + a.subtype : ""}, mask ${a.mask ?? "?"}): balance $${a.currentBalance ?? "?"}`
    );
    if (a.creditCardDetail) {
      const cc = a.creditCardDetail;
      lines.push(
        `  Credit card: last statement balance $${cc.lastStatementBalance ?? "?"}, min payment $${cc.minimumPaymentAmount ?? "?"}, next due ${cc.nextPaymentDueDate?.toISOString().slice(0, 10) ?? "unknown"}, estimated next statement close ${cc.estimatedNextClosingDate?.toISOString().slice(0, 10) ?? "unknown"}`
      );
    }
  }

  lines.push("\n=== Spending by category (last 90 days) ===");
  for (const s of spendByCategory) {
    lines.push(`- ${s.category ?? "Uncategorized"}: $${Number(s._sum.amount ?? 0).toFixed(2)}`);
  }

  lines.push("\n=== Budgets (monthly) ===");
  for (const b of budgets) {
    lines.push(`- ${b.category}: limit $${b.monthlyLimit}`);
  }

  return lines.join("\n");
}
