import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 面試練習的三種資料（模擬練習 sessions／實際記錄 records／個人題庫 bookmarks）
// 原本都只存在瀏覽器 localStorage，換裝置或清快取就不見；這裡改為資料庫持久化。
// 沿用 /api/tracker、/api/work-journal 的「整份提交取代」模式，前端維持原本
// 「改完整個陣列就存」的寫法，不用改動頁面的狀態管理方式。

export const maxDuration = 60

interface SessionIn {
  id: string; jobTitle: string; company?: string; language?: string
  questions: unknown[]; createdAt?: string; updatedAt?: string
}
interface RecordIn {
  id: string; question: string; answer: string
  score?: number; feedback?: string
  company?: string; title?: string
  date?: string; interview_date?: string
}
interface BookmarkIn {
  id: string; question: string; questionEn?: string
  type?: string; question_type?: string; framework?: string
  userAnswer: string; aiScore?: number; aiFeedback?: string
  strengths?: string[]; suggestions?: string[]; optimizedAnswer?: string
  savedAt?: string; fromRole?: string
}

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const [sessions, records, bookmarks] = await Promise.all([
    prisma.interviewSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.interviewRecord.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.interviewBookmark.findMany({ where: { userId }, orderBy: { savedAt: 'desc' } }),
  ])

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id, jobTitle: s.jobTitle, company: s.company ?? undefined,
      language: s.language, questions: s.questions,
      createdAt: s.createdAt.toISOString(), updatedAt: s.updatedAt.toISOString(),
    })),
    records: records.map((r) => ({
      id: r.id, question: r.question, answer: r.answer,
      score: r.score ?? undefined, feedback: r.feedback ?? undefined,
      company: r.company ?? undefined, title: r.jobTitle ?? undefined,
      interview_date: r.interviewDate ?? undefined,
      date: r.createdAt.toISOString(),
    })),
    bookmarks: bookmarks.map((b) => ({
      id: b.id, question: b.question, questionEn: b.questionEn ?? undefined,
      type: b.type, question_type: b.questionType ?? undefined, framework: b.framework ?? undefined,
      userAnswer: b.userAnswer, aiScore: b.aiScore ?? undefined, aiFeedback: b.aiFeedback ?? undefined,
      strengths: (b.strengths as string[] | null) ?? [],
      suggestions: (b.suggestions as string[] | null) ?? [],
      optimizedAnswer: b.optimizedAnswer ?? undefined,
      fromRole: b.fromRole ?? undefined,
      savedAt: b.savedAt.toISOString(),
    })),
  })
}

// 只替換 body 裡有帶到的那一種，沒帶的不動——頁面是分開存的（存練習不該動到題庫）
export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const body = await req.json() as {
    sessions?: SessionIn[]; records?: RecordIn[]; bookmarks?: BookmarkIn[]
  }

  try {
    const ops = []

    if (body.sessions) {
      ops.push(prisma.interviewSession.deleteMany({ where: { userId } }))
      if (body.sessions.length > 0) {
        ops.push(prisma.interviewSession.createMany({
          data: body.sessions.map((s) => ({
            id: s.id, userId,
            jobTitle: s.jobTitle, company: s.company ?? null,
            language: s.language ?? 'zh-TW',
            questions: (s.questions ?? []) as object,
            ...(s.createdAt ? { createdAt: new Date(s.createdAt) } : {}),
          })),
        }))
      }
    }

    if (body.records) {
      ops.push(prisma.interviewRecord.deleteMany({ where: { userId } }))
      if (body.records.length > 0) {
        ops.push(prisma.interviewRecord.createMany({
          data: body.records.map((r) => ({
            id: r.id, userId,
            question: r.question, answer: r.answer,
            score: typeof r.score === 'number' ? Math.round(r.score) : null,
            feedback: r.feedback ?? null,
            company: r.company ?? null, jobTitle: r.title ?? null,
            interviewDate: r.interview_date ?? null,
            ...(r.date ? { createdAt: new Date(r.date) } : {}),
          })),
        }))
      }
    }

    if (body.bookmarks) {
      ops.push(prisma.interviewBookmark.deleteMany({ where: { userId } }))
      if (body.bookmarks.length > 0) {
        ops.push(prisma.interviewBookmark.createMany({
          data: body.bookmarks.map((b) => ({
            id: b.id, userId,
            question: b.question, questionEn: b.questionEn ?? null,
            type: b.type ?? 'general',
            questionType: b.question_type ?? null, framework: b.framework ?? null,
            userAnswer: b.userAnswer,
            aiScore: typeof b.aiScore === 'number' ? Math.round(b.aiScore) : null,
            aiFeedback: b.aiFeedback ?? null,
            strengths: (b.strengths ?? []) as object,
            suggestions: (b.suggestions ?? []) as object,
            optimizedAnswer: b.optimizedAnswer ?? null,
            fromRole: b.fromRole ?? null,
            ...(b.savedAt ? { savedAt: new Date(b.savedAt) } : {}),
          })),
        }))
      }
    }

    if (ops.length > 0) await prisma.$transaction(ops, { timeout: 20000 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/interviews PUT]', err)
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 })
  }
}
