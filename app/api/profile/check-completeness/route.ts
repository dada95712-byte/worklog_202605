import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { profile } = await req.json() as { profile: Record<string, unknown> }

    const issues: string[] = []

    const basic = profile['profile-basic'] as Record<string, string> | undefined
    const hasName = !!(basic?.nameZh || basic?.nameEn)
    if (!hasName) issues.push('尚未填寫姓名（基本資料）')

    const exp = profile['profile-experience'] as unknown[] | undefined
    const intern = profile['profile-internship'] as unknown[] | undefined
    const edu = profile['profile-education'] as unknown[] | undefined
    const hasExperience = !!(
      (exp && exp.length > 0) ||
      (intern && intern.length > 0) ||
      (edu && edu.length > 0)
    )
    if (!hasExperience) issues.push('尚未填寫工作經驗、實習或學歷')

    const skillmap = profile['profile-skillmap'] as Record<string, string[]> | undefined
    const totalSkills = skillmap ? Object.values(skillmap).flat().length : 0
    const hasSkills = totalSkills >= 3
    if (!hasSkills) issues.push(`技能項目不足（目前 ${totalSkills} 項，建議至少 3 項）`)

    const summaryZh = profile['profile-summary-zh'] as string | undefined
    const summaryEn = profile['profile-summary-en'] as string | undefined
    if (!summaryZh && !summaryEn) issues.push('尚未填寫個人摘要（AI 將自動生成）')

    return NextResponse.json({ issues, hasName, hasExperience, hasSkills, totalSkills })
  } catch (err) {
    console.error('[profile/check-completeness]', err)
    return NextResponse.json({ error: '檢查失敗' }, { status: 500 })
  }
}
