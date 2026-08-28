-- Unify Skill + profile_skill into UserSkill, add SkillEvidence
-- Order matters: create new tables, migrate data, THEN drop old tables.

-- CreateTable
CREATE TABLE "UserSkill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillName" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '專業技能',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillEvidence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "evidenceExcerpt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserSkill_userId_idx" ON "UserSkill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSkill_userId_skillName_key" ON "UserSkill"("userId", "skillName");

-- CreateIndex
CREATE INDEX "SkillEvidence_userId_idx" ON "SkillEvidence"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillEvidence_skillId_journalId_key" ON "SkillEvidence"("skillId", "journalId");

-- AddForeignKey
ALTER TABLE "UserSkill" ADD CONSTRAINT "UserSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "UserSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillEvidence" ADD CONSTRAINT "SkillEvidence_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "WorkJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: profile_skill -> UserSkill (manual entries, always confirmed)
INSERT INTO "UserSkill" ("id", "userId", "skillName", "category", "source", "isManual", "isConfirmed", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", "skillName", COALESCE(NULLIF("category", ''), '專業技能'), 'manual', true, true, "createdAt", "updatedAt"
FROM "profile_skill"
ON CONFLICT ("userId", "skillName") DO UPDATE SET
  "isManual" = true,
  "isConfirmed" = true,
  "updatedAt" = EXCLUDED."updatedAt";

-- DataMigration: Skill -> UserSkill (existing confirmed library, always treated as manual+confirmed)
INSERT INTO "UserSkill" ("id", "userId", "skillName", "category", "source", "isManual", "isConfirmed", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "userId", "name", COALESCE(NULLIF("category", ''), '專業技能'), 'manual', true, true, "createdAt", "createdAt"
FROM "Skill"
ON CONFLICT ("userId", "skillName") DO UPDATE SET
  "isManual" = true,
  "isConfirmed" = true;

-- DropForeignKey
ALTER TABLE "Skill" DROP CONSTRAINT "Skill_userId_fkey";

-- DropForeignKey
ALTER TABLE "profile_skill" DROP CONSTRAINT "profile_skill_userId_fkey";

-- DropTable
DROP TABLE "Skill";

-- DropTable
DROP TABLE "profile_skill";
