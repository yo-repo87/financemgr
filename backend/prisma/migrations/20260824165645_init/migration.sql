-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "balance_snapshots" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "net_worth" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "balance_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plaid_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "access_token_encrypted" TEXT NOT NULL,
    "institution_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "cursor" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plaid_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "plaid_item_id" TEXT NOT NULL,
    "plaid_account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mask" TEXT,
    "type" TEXT NOT NULL,
    "subtype" TEXT,
    "current_balance" DECIMAL(14,2),
    "available_balance" DECIMAL(14,2),
    "credit_limit" DECIMAL(14,2),
    "iso_currency_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_details" (
    "account_id" TEXT NOT NULL,
    "last_statement_issue_date" DATE,
    "estimated_next_closing_date" DATE,
    "last_statement_balance" DECIMAL(14,2),
    "minimum_payment_amount" DECIMAL(14,2),
    "next_payment_due_date" DATE,
    "last_payment_amount" DECIMAL(14,2),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_details_pkey" PRIMARY KEY ("account_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "plaid_transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "iso_currency_code" TEXT,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "merchant_name" TEXT,
    "category" TEXT,
    "pending" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "monthly_limit" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "user_id" TEXT NOT NULL,
    "openai_api_key_encrypted" TEXT,
    "openai_key_last_four" TEXT,
    "model_preference" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content_encrypted" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "balance_snapshots_user_id_date_key" ON "balance_snapshots"("user_id", "date");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "plaid_items_plaid_item_id_key" ON "plaid_items"("plaid_item_id");

-- CreateIndex
CREATE INDEX "plaid_items_user_id_idx" ON "plaid_items"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_plaid_account_id_key" ON "accounts"("plaid_account_id");

-- CreateIndex
CREATE INDEX "accounts_plaid_item_id_idx" ON "accounts"("plaid_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_plaid_transaction_id_key" ON "transactions"("plaid_transaction_id");

-- CreateIndex
CREATE INDEX "transactions_account_id_date_idx" ON "transactions"("account_id", "date");

-- CreateIndex
CREATE INDEX "transactions_category_idx" ON "transactions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_user_id_category_key" ON "budgets"("user_id", "category");

-- CreateIndex
CREATE INDEX "ai_messages_user_id_created_at_idx" ON "ai_messages"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "balance_snapshots" ADD CONSTRAINT "balance_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plaid_items" ADD CONSTRAINT "plaid_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_plaid_item_id_fkey" FOREIGN KEY ("plaid_item_id") REFERENCES "plaid_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_details" ADD CONSTRAINT "credit_card_details_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
