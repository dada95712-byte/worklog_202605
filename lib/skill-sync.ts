import { prisma } from '@/lib/prisma'

interface ManualSkillIn { name: string; category: string }

// 手動技能提交的共用調和邏輯：/api/skills 與 /api/profile 的 skillMap 都走這支。
// 提交清單裡的技能標記為 manual + confirmed；原本 manual 但這次沒出現的，
// 有日誌證據就保留、只解除 manual 標記，沒有證據才整筆刪除。
export async function syncManualSkills(userId: string, skills: ManualSkillIn[]) {
  const submittedNames = new Set(skills.map((s) => s.name).filter(Boolean))

  await prisma.$transaction(async (tx) => {
    for (const s of skills) {
      if (!s.name?.trim()) continue
      await tx.userSkill.upsert({
        where: { userId_skillName: { userId, skillName: s.name } },
        update: { isManual: true, isConfirmed: true, category: s.category || '專業技能' },
        create: { userId, skillName: s.name, category: s.category || '專業技能', source: 'manual', isManual: true, isConfirmed: true },
      })
    }

    const previouslyManual = await tx.userSkill.findMany({
      where: { userId, isManual: true },
      include: { _count: { select: { evidence: true } } },
    })
    for (const s of previouslyManual) {
      if (submittedNames.has(s.skillName)) continue
      if (s._count.evidence === 0) {
        await tx.userSkill.delete({ where: { id: s.id } })
      } else {
        await tx.userSkill.update({ where: { id: s.id }, data: { isManual: false } })
      }
    }
  })
}

// 個人檔案庫用：只回傳「你的技能庫」裡真正確立的技能（手動加入或已確認），依分類分組
export async function getSkillMap(userId: string): Promise<Record<string, string[]>> {
  const skills = await prisma.userSkill.findMany({
    where: { userId, OR: [{ isManual: true }, { isConfirmed: true }] },
    orderBy: { createdAt: 'asc' },
  })
  const skillMap: Record<string, string[]> = {}
  for (const s of skills) {
    (skillMap[s.category] ??= []).push(s.skillName)
  }
  return skillMap
}
