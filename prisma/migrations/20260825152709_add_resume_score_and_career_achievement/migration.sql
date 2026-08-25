-- CreateTable
CREATE TABLE "ResumeScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "scoreOverall" INTEGER NOT NULL,
    "scoreContent" INTEGER NOT NULL,
    "scoreAts" INTEGER NOT NULL,
    "scoreKeyword" INTEGER NOT NULL,
    "scoreFormat" INTEGER NOT NULL,
    "scoreImpact" INTEGER NOT NULL,
    "suggestions" JSONB,
    "keywords" JSONB,
    "language" TEXT NOT NULL DEFAULT 'zh-TW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumeScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CareerAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "journalId" TEXT,
    "company" TEXT,
    "text" TEXT NOT NULL,
    "metric" TEXT,
    "journalExcerpt" TEXT,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResumeScore_resumeId_createdAt_idx" ON "ResumeScore"("resumeId", "createdAt");

-- CreateIndex
CREATE INDEX "CareerAchievement_userId_isConfirmed_idx" ON "CareerAchievement"("userId", "isConfirmed");

-- AddForeignKey
ALTER TABLE "ResumeScore" ADD CONSTRAINT "ResumeScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeScore" ADD CONSTRAINT "ResumeScore_resumeId_fkey" FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerAchievement" ADD CONSTRAINT "CareerAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerAchievement" ADD CONSTRAINT "CareerAchievement_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "WorkJournal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
