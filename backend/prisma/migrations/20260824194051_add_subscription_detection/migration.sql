-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('NEW', 'DISMISSED', 'TRACKED');

-- CreateTable
CREATE TABLE "detected_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "merchant_key" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "last_charged_date" DATE NOT NULL,
    "occurrence_count" INTEGER NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'NEW',
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "detected_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "detected_subscriptions_user_id_idx" ON "detected_subscriptions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "detected_subscriptions_user_id_merchant_key_key" ON "detected_subscriptions"("user_id", "merchant_key");

-- AddForeignKey
ALTER TABLE "detected_subscriptions" ADD CONSTRAINT "detected_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
