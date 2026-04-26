-- AlterTable
ALTER TABLE "User" ADD COLUMN "is_subscriber" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN "ip_hash" TEXT;
ALTER TABLE "Session" ADD COLUMN "client_fingerprint" TEXT;

-- CreateIndex
CREATE INDEX "Session_ip_hash_idx" ON "Session"("ip_hash");

-- CreateTable
CREATE TABLE "AnonIpUsage" (
    "id" TEXT NOT NULL,
    "ip_hash" TEXT NOT NULL,
    "questions_used" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonIpUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnonIpUsage_ip_hash_key" ON "AnonIpUsage"("ip_hash");
