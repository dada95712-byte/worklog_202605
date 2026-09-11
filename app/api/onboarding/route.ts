import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 引導流程的狀態與偏好。原本整包只存在 localStorage：換裝置／清快取就被當成
// 新使用者重問一次，而且系統自己也不知道誰完成過引導。
// 另外，引導問到的姓名過去只寫進 localStorage['profile-basic']（那個 key 在
// 個人檔案庫改接資料庫之後已經沒有任何程式碼會讀），等於問了就丟掉——
// 這裡改為直接寫進 profile_basic，使用者不用再打第二次。

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const [user, basic] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompleted: true, onboardingStatus: true, onboardingGoal: true, onboardingTargetRole: true },
    }),
    prisma.profileBasic.findUnique({ where: { userId }, select: { nameZh: true } }),
  ])

  return NextResponse.json({
    completed: user?.onboardingCompleted ?? false,
    status: user?.onboardingStatus ?? null,
    goal: user?.onboardingGoal ?? null,
    targetRole: user?.onboardingTargetRole ?? null,
    nameZh: basic?.nameZh ?? null,
  })
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const { completed, status, goal, targetRole, nameZh } = await req.json() as {
    completed?: boolean; status?: string | null; goal?: string | null
    targetRole?: string | null; nameZh?: string | null
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof completed === 'boolean' ? { onboardingCompleted: completed } : {}),
        ...(status !== undefined ? { onboardingStatus: status } : {}),
        ...(goal !== undefined ? { onboardingGoal: goal } : {}),
        ...(targetRole !== undefined ? { onboardingTargetRole: targetRole } : {}),
      },
    })

    // 姓名落地到個人檔案庫；已經有值就不覆蓋（使用者在檔案庫填的比引導時隨手打的準）
    const trimmed = nameZh?.trim()
    if (trimmed) {
      const existing = await prisma.profileBasic.findUnique({ where: { userId }, select: { nameZh: true } })
      if (!existing) {
        await prisma.profileBasic.create({ data: { userId, nameZh: trimmed } })
      } else if (!existing.nameZh?.trim()) {
        await prisma.profileBasic.update({ where: { userId }, data: { nameZh: trimmed } })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/onboarding PUT]', err)
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 })
  }
}
