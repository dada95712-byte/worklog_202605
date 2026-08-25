import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 列出使用者所有 AI 萃取的成就（含待確認與已確認），前端自行分區顯示
export async function GET() {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const achievements = await prisma.careerAchievement.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    achievements: achievements.map((a) => ({
      id: a.id,
      journalId: a.journalId,
      company: a.company,
      text: a.text,
      metric: a.metric,
      journalExcerpt: a.journalExcerpt,
      isConfirmed: a.isConfirmed,
      createdAt: a.createdAt.toISOString(),
    })),
  })
}

// 切換單筆成就的確認狀態——只有 isConfirmed=true 的才會出現在「職涯成就總覽」
export async function PATCH(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const { id, isConfirmed } = await req.json() as { id: string; isConfirmed: boolean }
  if (!id || typeof isConfirmed !== 'boolean') {
    return NextResponse.json({ error: '缺少 id 或 isConfirmed' }, { status: 400 })
  }

  const owns = await prisma.careerAchievement.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owns) return NextResponse.json({ error: '找不到這筆成就' }, { status: 404 })

  const updated = await prisma.careerAchievement.update({
    where: { id },
    data: { isConfirmed },
  })

  return NextResponse.json({ id: updated.id, isConfirmed: updated.isConfirmed })
}
