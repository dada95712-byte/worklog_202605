import { callAI, isRateLimitError } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

interface Journal {
  id: string
  title: string
  content?: string
  situation?: string
  task?: string
  action?: string
  result?: string
}

interface RawAchievement {
  journalId: string
  text: string
  metric?: string
}

const SYSTEM_PROMPT = `你是成就擷取工具。從日誌原文中找出職場成就，格式化為履歷條目。
成就分兩種，都要找：
1. 量化成就：有具體數字或指標佐證（例如「降低成本15%」「處理200筆訂單」）
2. 質化成就：有明確具體事蹟，但原文沒有數字（例如「主導跨部門需求訪談，擴大訪談對象至最終使用者」）
規則：
- 只能使用日誌原文中明確出現的事實與數字，禁止推論或捏造任何數據
- 每條成就必須有具體動詞開頭（例如：主導、優化、降低、提升）
- metric 欄位：原文有明確數字或指標才填，沒有就整個欄位省略（不要填 null 字串、不要為了湊數字自己編）
- 原文找不到任何具體事蹟（只有流水帳、沒有做了什麼有意義的事）就不要輸出
- 回傳純 JSON：
{"achievements": [{"journalId": "id", "text": "成就描述", "metric": "量化指標或省略"}]}`

function validateAchievements(
  achievements: RawAchievement[],
  journalMap: Map<string, string>,
): RawAchievement[] {
  return achievements.filter((a) => {
    const source = journalMap.get(a.journalId)
    if (!source) return false

    const sourceLower = source.toLowerCase()
    const textLower = a.text.toLowerCase()

    // Check at least 80% of achievement text characters appear in source
    const textChars = textLower.replace(/\s/g, '').split('')
    const matchCount = textChars.filter((c) => sourceLower.includes(c)).length
    const matchRate = matchCount / Math.max(textChars.length, 1)
    if (matchRate < 0.8) return false

    // If metric is specified, it must appear literally in the source
    if (a.metric) {
      const metricDigits = a.metric.replace(/[^\d]/g, '')
      if (metricDigits && !source.includes(metricDigits)) return false
    }

    return true
  })
}

export async function POST(req: Request) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const { journals } = await req.json() as { journals: Journal[] }
    if (!Array.isArray(journals) || journals.length === 0)
      return NextResponse.json({ error: '請提供日誌資料' }, { status: 400 })

    // Build journal map for validation
    const journalMap = new Map<string, string>()
    for (const j of journals) {
      const fullText = [j.title, j.content, j.situation, j.task, j.action, j.result]
        .filter(Boolean).join('\n')
      journalMap.set(j.id, fullText)
    }

    const journalText = journals.map((j) =>
      `[ID: ${j.id}] 標題：${j.title}\n${[j.content, j.situation, j.task, j.action, j.result].filter(Boolean).join('\n')}`
    ).join('\n\n---\n\n')

    const raw = await callAI(journalText.slice(0, 8000), SYSTEM_PROMPT)
    const parsed = extractJSON<{ achievements: RawAchievement[] }>(raw)
    const rawAchievements = parsed?.achievements ?? []

    const validated = validateAchievements(rawAchievements, journalMap)
    const removed = rawAchievements.length - validated.length

    // 落地存成「待確認」成就 —— 只信任真的屬於這位使用者的日誌，並比對逐字摘錄避免重複寫入
    const journalIds = [...new Set(validated.map((a) => a.journalId))]
    const ownedJournals = await prisma.workJournal.findMany({
      where: { id: { in: journalIds }, userId },
      select: { id: true, company: true },
    })
    const ownedMap = new Map(ownedJournals.map((j) => [j.id, j.company]))

    const persistable = validated.filter((a) => ownedMap.has(a.journalId))
    if (persistable.length > 0) {
      const existing = await prisma.careerAchievement.findMany({
        where: { userId, journalId: { in: journalIds } },
        select: { journalId: true, text: true },
      })
      const existingKeys = new Set(existing.map((e) => `${e.journalId}::${e.text}`))

      const toCreate = persistable.filter((a) => !existingKeys.has(`${a.journalId}::${a.text}`))
      if (toCreate.length > 0) {
        await prisma.careerAchievement.createMany({
          data: toCreate.map((a) => ({
            userId,
            journalId: a.journalId,
            company: ownedMap.get(a.journalId) ?? null,
            text: a.text,
            metric: a.metric ?? null,
            journalExcerpt: journalMap.get(a.journalId)?.slice(0, 2000) ?? null,
          })),
        })
      }
    }

    return NextResponse.json({ achievements: validated, removed })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[journals/extract-achievements]', err)
    return NextResponse.json({ error: '擷取失敗，請稍後再試' }, { status: 500 })
  }
}
