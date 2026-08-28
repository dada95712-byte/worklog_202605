import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { syncManualSkills } from '@/lib/skill-sync'

interface SkillIn { name: string; category: string }

// 回傳使用者所有技能（含已確認與AI建議待確認），每筆附證據清單與篇數
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const skills = await prisma.userSkill.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      evidence: {
        include: { journal: { select: { id: true, title: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return NextResponse.json({
    skills: skills.map((s) => ({
      id: s.id,
      name: s.skillName,
      category: s.category,
      source: s.source,
      isManual: s.isManual,
      isConfirmed: s.isConfirmed,
      evidenceCount: s.evidence.length,
      evidence: s.evidence.map((e) => ({
        journalId: e.journalId,
        journalTitle: e.journal?.title ?? '',
        excerpt: e.evidenceExcerpt,
      })),
    })),
  })
}

// 手動技能庫維護（新增/刪除/改分類/去重全部走這支，整份提交做調和）
export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const { skills } = await req.json() as { skills: SkillIn[] }

  try {
    await syncManualSkills(userId, skills)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/skills PUT]', err)
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 })
  }
}

// 確認 AI 建議的技能（多為 inference 來源），確認後才會被履歷生成採用
export async function PATCH(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const { id, isConfirmed } = await req.json() as { id: string; isConfirmed: boolean }
  if (!id || typeof isConfirmed !== 'boolean') {
    return NextResponse.json({ error: '缺少 id 或 isConfirmed' }, { status: 400 })
  }

  const owns = await prisma.userSkill.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owns) return NextResponse.json({ error: '找不到這項技能' }, { status: 404 })

  const updated = await prisma.userSkill.update({ where: { id }, data: { isConfirmed } })
  return NextResponse.json({ id: updated.id, isConfirmed: updated.isConfirmed })
}
