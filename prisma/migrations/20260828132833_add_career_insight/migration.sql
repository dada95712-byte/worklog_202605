-- CreateTable
CREATE TABLE "CareerInsight" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightText" TEXT NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerInsightEvidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "insightId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "evidenceExcerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CareerInsightEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CareerInsight_userId_idx" ON "CareerInsight"("userId");

-- CreateIndex
CREATE INDEX "CareerInsightEvidence_userId_idx" ON "CareerInsightEvidence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerInsightEvidence_insightId_journalId_key" ON "CareerInsightEvidence"("insightId", "journalId");

-- AddForeignKey
ALTER TABLE "CareerInsight" ADD CONSTRAINT "CareerInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerInsightEvidence" ADD CONSTRAINT "CareerInsightEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerInsightEvidence" ADD CONSTRAINT "CareerInsightEvidence_insightId_fkey" FOREIGN KEY ("insightId") REFERENCES "CareerInsight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerInsightEvidence" ADD CONSTRAINT "CareerInsightEvidence_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "WorkJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
