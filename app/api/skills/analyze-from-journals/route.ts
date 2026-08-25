import { callAI, isRateLimitError } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

const SYSTEM_PROMPT = `你是技能擷取工具。你的任務是從日誌原文中找出明確提及的技能詞彙。
規則：
- 只能擷取原文中實際出現的技能，禁止推論、補充或創造任何未明確出現的技能
- 每個技能必須標註來源日誌 ID
- 將技能分類為：專業技能/工具與軟體/核心職能/軟實力/語言能力/證照與認證/學習中
- 回傳純 JSON，格式如下：
{"skills": [{"name": "技能名稱", "category": "分類", "journal_ids": ["id1","id2"]}]}`

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { journals } = await req.json() as {
      journals: Array<{ id: string; title: string; content?: string; situation?: string; task?: string; action?: string; result?: string }>
    }
    if (!Array.isArray(journals) || journals.length === 0)
      return NextResponse.json({ error: '請提供日誌資料' }, { status: 400 })

    const journalText = journals.map((j) =>
      `[ID: ${j.id}] 標題：${j.title}\n${[j.content, j.situation, j.task, j.action, j.result].filter(Boolean).join('\n')}`
    ).join('\n\n---\n\n')

    const raw = await callAI(journalText.slice(0, 8000), SYSTEM_PROMPT)
    const parsed = extractJSON<{ skills: Array<{ name: string; category: string; journal_ids: string[] }> }>(raw)

    // Build a single searchable corpus from all journal text for validation
    const allJournalContent = journalText.toLowerCase()

    const skills = (parsed?.skills ?? [])
      .filter((s) => {
        // Only keep skills whose name actually appears in the journal text
        return allJournalContent.includes(s.name.toLowerCase())
      })
      .map((s) => ({
        name: s.name,
        category: s.category,
        journal_ids: s.journal_ids ?? [],
        journalFrequency: (s.journal_ids ?? []).length,
      }))

    return NextResponse.json({ skills })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[skills/analyze-from-journals]', err)
    return NextResponse.json({ error: '分析失敗，請稍後再試' }, { status: 500 })
  }
}
