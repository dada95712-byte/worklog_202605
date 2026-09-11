import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 各模組「有沒有資料」的輕量快照，只做 COUNT，給頁面提示（PageTooltip）判斷
// 該講「從這裡開始」還是「你已經有資料了，下一步這樣做」。
// 刻意不回傳任何內容本身，只回數量，維持便宜且與各模組解耦。
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const [basic, journals, skills, confirmedSkills, resumes, scoredResumes, jobs, analyzedJobs, sessions, records] =
    await Promise.all([
      prisma.profileBasic.findUnique({ where: { userId }, select: { nameZh: true } }),
      prisma.workJournal.count({ where: { userId } }),
      prisma.userSkill.count({ where: { userId } }),
      prisma.userSkill.count({ where: { userId, OR: [{ isManual: true }, { isConfirmed: true }] } }),
      prisma.resume.count({ where: { userId } }),
      prisma.resume.count({ where: { userId, aiScore: { not: null } } }),
      prisma.jobApplication.count({ where: { userId } }),
      prisma.jobApplication.count({ where: { userId, jdFullText: { not: null } } }),
      prisma.interviewSession.count({ where: { userId } }),
      prisma.interviewRecord.count({ where: { userId } }),
    ])

  return NextResponse.json({
    hasProfile: Boolean(basic?.nameZh?.trim()),
    journals,
    skills,
    confirmedSkills,
    resumes,
    scoredResumes,
    jobs,
    analyzedJobs,
    interviews: sessions + records,
  })
}
