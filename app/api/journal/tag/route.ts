import { callAI } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

const CATEGORIES = ['問題解決', '領導力', '跨部門協作', '技術實作', '客戶關係', '數據分析']

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ tags: [], title: '' })

    const result = await callAI(
      `根據以下工作日誌內容，完成兩件事：
1. 從這些類別中選出最相關的 1–3 個標籤：${CATEGORIES.join('、')}
2. 生成一個簡短的日誌標題（15字以內，精準描述這次工作成就）

日誌內容：
${text.slice(0, 1000)}

請只回覆以下格式的 JSON：
{"tags": ["標籤1", "標籤2"], "title": "日誌標題"}

不要任何其他說明文字。`,
      '你是一個分析工作日誌的助手，請用繁體中文回答。'
    )

    let tags: string[] = []
    let title = ''
    try {
      const parsed = extractJSON<{ tags?: string[]; title?: string }>(result)
      tags = (parsed.tags ?? []).filter((t: string) => CATEGORIES.includes(t))
      title = parsed.title ?? ''
    } catch { /* ignore */ }
    return NextResponse.json({ tags, title })
  } catch (err) {
    console.error('[journal/tag]', err)
    return NextResponse.json({ tags: [], title: '' })
  }
}
