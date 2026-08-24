-- CreateEnum
CREATE TYPE "IncomeStatus" AS ENUM ('NEW', 'DISMISSED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "credit_card_details" ADD COLUMN     "apr_percentage" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "category_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detected_incomes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "cadence_days" INTEGER NOT NULL,
    "last_received_date" DATE NOT NULL,
    "occurrence_count" INTEGER NOT NULL,
    "status" "IncomeStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detected_incomes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_flow_settings" (
    "user_id" TEXT NOT NULL,
    "low_balance_threshold" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_flow_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "cash_flow_alerts_sent" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "alert_date" DATE NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_flow_alerts_sent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(14,2) NOT NULL,
    "target_date" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "savings_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "savings_contributions" (
    "id" TEXT NOT NULL,
    "goal_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "savings_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "security_id" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DECIMAL(20,8) NOT NULL,
    "cost_basis" DECIMAL(14,2),
    "current_price" DECIMAL(14,4),
    "current_value" DECIMAL(14,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "category_overrides_user_id_merchant_key_key" ON "category_overrides"("user_id", "merchant_key");

-- CreateIndex
CREATE INDEX "detected_incomes_user_id_idx" ON "detected_incomes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "detected_incomes_user_id_merchant_key_key" ON "detected_incomes"("user_id", "merchant_key");

-- CreateIndex
CREATE UNIQUE INDEX "cash_flow_alerts_sent_user_id_alert_date_key" ON "cash_flow_alerts_sent"("user_id", "alert_date");

-- CreateIndex
CREATE INDEX "savings_goals_user_id_idx" ON "savings_goals"("user_id");

-- CreateIndex
CREATE INDEX "savings_contributions_goal_id_idx" ON "savings_contributions"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_account_id_security_id_key" ON "holdings"("account_id", "security_id");

-- AddForeignKey
ALTER TABLE "category_overrides" ADD CONSTRAINT "category_overrides_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_incomes" ADD CONSTRAINT "detected_incomes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_flow_settings" ADD CONSTRAINT "cash_flow_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_goals" ADD CONSTRAINT "savings_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "savings_contributions" ADD CONSTRAINT "savings_contributions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "savings_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
