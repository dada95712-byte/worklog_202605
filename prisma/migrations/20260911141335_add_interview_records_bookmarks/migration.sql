-- CreateTable
CREATE TABLE "InterviewRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "score" INTEGER,
    "feedback" TEXT,
    "company" TEXT,
    "jobTitle" TEXT,
    "interviewDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionEn" TEXT,
    "type" TEXT NOT NULL DEFAULT 'general',
    "questionType" TEXT,
    "framework" TEXT,
    "userAnswer" TEXT NOT NULL,
    "aiScore" INTEGER,
    "aiFeedback" TEXT,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "optimizedAnswer" TEXT,
    "fromRole" TEXT,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewBookmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewRecord_userId_idx" ON "InterviewRecord"("userId");

-- CreateIndex
CREATE INDEX "InterviewBookmark_userId_idx" ON "InterviewBookmark"("userId");

-- CreateIndex
CREATE INDEX "InterviewSession_userId_idx" ON "InterviewSession"("userId");

-- AddForeignKey
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBookmark" ADD CONSTRAINT "InterviewBookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

