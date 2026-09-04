import { prisma } from '@/lib/prisma'

interface ManualSkillIn { name: string; category: string }

// 手動技能提交的共用調和邏輯：/api/skills 與 /api/profile 的 skillMap 都走這支。
// 提交清單裡的技能標記為 manual + confirmed；原本 manual 但這次沒出現的，
// 有日誌證據就保留、只解除 manual 標記，沒有證據才整筆刪除。
//
// 效能備註：原本逐筆 upsert（一個技能一次資料庫往返），$transaction 預設
// timeout 只有 5 秒，技能一多（例如履歷匯入一次帶入 20 幾個）在正式環境
// 網路延遲下很容易超時，整包儲存跟著失敗。改成先一次查出既有技能，
// 分成「真的要新增」「真的要更新」兩批，只新增/更新有變化的部分。
export async function syncManualSkills(userId: string, skills: ManualSkillIn[]) {
  const deduped = new Map<string, string>()
  for (const s of skills) {
    if (s.name?.trim()) deduped.set(s.name, s.category || '專業技能')
  }
  const submittedNames = new Set(deduped.keys())

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userSkill.findMany({
      where: { userId, skillName: { in: [...submittedNames] } },
      include: { _count: { select: { evidence: true } } },
    })
    const existingByName = new Map(existing.map((s) => [s.skillName, s]))

    const toCreate = [...deduped.entries()].filter(([name]) => !existingByName.has(name))
    if (toCreate.length > 0) {
      await tx.userSkill.createMany({
        data: toCreate.map(([skillName, category]) => ({ userId, skillName, category, source: 'manual', isManual: true, isConfirmed: true })),
      })
    }

    for (const [name, category] of deduped) {
      const cur = existingByName.get(name)
      if (!cur) continue // 剛剛已經用 createMany 建立
      if (cur.isManual && cur.isConfirmed && cur.category === category) continue // 沒有變化，不用寫
      await tx.userSkill.update({ where: { id: cur.id }, data: { isManual: true, isConfirmed: true, category } })
    }

    const previouslyManual = await tx.userSkill.findMany({
      where: { userId, isManual: true, skillName: { notIn: [...submittedNames] } },
      include: { _count: { select: { evidence: true } } },
    })
    for (const s of previouslyManual) {
      if (s._count.evidence === 0) {
        await tx.userSkill.delete({ where: { id: s.id } })
      } else {
        await tx.userSkill.update({ where: { id: s.id }, data: { isManual: false } })
      }
    }
  }, { timeout: 20000 })
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
