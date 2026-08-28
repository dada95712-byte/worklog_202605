import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 列出使用者所有 AI 萃取的成就（含待確認與已確認，不含已刪除），前端自行分區顯示
export async function GET() {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const achievements = await prisma.careerAchievement.findMany({
    where: { userId, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    include: { journal: { select: { id: true, title: true, date: true } } },
  })

  return NextResponse.json({
    achievements: achievements.map((a) => ({
      id: a.id,
      journalId: a.journalId,
      journalTitle: a.journal?.title ?? '',
      journalDate: a.journal?.date ?? null,
      company: a.company,
      text: a.text,
      metric: a.metric,
      journalExcerpt: a.journalExcerpt,
      isConfirmed: a.isConfirmed,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

// 確認（is_confirmed=true）或刪除（is_dismissed=true，軟刪除）一筆成就
export async function PATCH(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const { id, action } = await req.json() as { id: string; action: 'confirm' | 'dismiss' }
  if (!id || (action !== 'confirm' && action !== 'dismiss')) {
    return NextResponse.json({ error: '缺少 id 或 action' }, { status: 400 })
  }

  const owns = await prisma.careerAchievement.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owns) return NextResponse.json({ error: '找不到這筆成就' }, { status: 404 })

  const updated = await prisma.careerAchievement.update({
    where: { id },
    data: action === 'confirm' ? { isConfirmed: true } : { isDismissed: true },
  })
  return NextResponse.json({ id: updated.id, isConfirmed: updated.isConfirmed, isDismissed: updated.isDismissed })
}
