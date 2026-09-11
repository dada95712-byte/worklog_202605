import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 使用者的公司名稱單一清單。
//
// 公司名稱過去在三個地方各自是自由文字（工作經歷、實習、工作日誌），而且
// 日誌的自動完成只看過去的日誌、個人檔案庫的公司欄位根本沒有自動完成——
// 先在檔案庫填「拓宇資訊股份有限公司」、再寫第一篇日誌時下拉是空的，
// 打成「拓宇資訊」兩邊就分岔，之後再也不會收斂。分岔之後，「成就要插進
// 哪一段工作經歷」這類跨模組比對就只能用模糊比對猜。
//
// 這支 API 把三處的公司名稱聚成同一份清單，讓兩邊的輸入框都從這裡挑，
// 從輸入端就不會產生不一致，跨模組比對才能用精確比對。
export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const [experiences, internships, journals] = await Promise.all([
    prisma.profileExperience.findMany({ where: { userId }, select: { company: true } }),
    prisma.profileInternship.findMany({ where: { userId }, select: { company: true } }),
    prisma.workJournal.findMany({ where: { userId }, select: { company: true } }),
  ])

  // 個人檔案庫的工作經歷是「正式紀錄」，排在前面優先被選中
  const ordered = [
    ...experiences.map((e) => e.company),
    ...internships.map((e) => e.company),
    ...journals.map((j) => j.company),
  ]

  const seen = new Set<string>()
  const companies: string[] = []
  for (const raw of ordered) {
    const name = raw?.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    companies.push(name)
  }

  return NextResponse.json({ companies })
}
