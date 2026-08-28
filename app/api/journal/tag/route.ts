import { callAI } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

// 軟實力／職能類分類：不要求逐字比對，AI 可依內容綜合判斷
const CATEGORIES = ['問題解決', '領導力', '跨部門協作', '技術實作', '客戶關係', '數據分析']

function validateTags(tags: string[], sourceText: string): string[] {
  const sourceLower = sourceText.toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tags) {
    const t = (raw ?? '').trim()
    if (!t || t.length > 12 || seen.has(t)) continue
    // 軟實力分類一律放行；具體工具/技術名稱必須逐字出現在原文中才放行，避免 AI 憑空生成
    const isCategory = CATEGORIES.includes(t)
    const isLiteralMatch = sourceLower.includes(t.toLowerCase())
    if (isCategory || isLiteralMatch) {
      seen.add(t)
      out.push(t)
    }
  }
  return out.slice(0, 6)
}

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { text } = await req.json()
    if (!text?.trim()) return NextResponse.json({ tags: [], title: '' })

    const result = await callAI(
      `根據以下工作日誌內容，完成兩件事：
1. 挑出 2-5 個標籤，來源分兩種，優先挑選日誌裡實際提到的具體內容：
   a. 日誌原文中明確提到的具體工具、技術、方法論名稱（例如 Power BI、SQL、Excel、Figma、Scrum），逐字照抄原文出現的寫法，不要翻譯或改寫
   b. 從這份固定清單中選出真正符合這篇內容的軟實力分類（不確定就不要選，不要每篇都選一樣的）：${CATEGORIES.join('、')}
   不同日誌內容不同，標籤應該反映這篇日誌獨特的地方，不要每篇都給一樣的組合
2. 生成一個簡短的日誌標題（15字以內，精準描述這次工作成就）

日誌內容：
${text.slice(0, 1000)}

請只回覆以下格式的 JSON：
{"tags": ["標籤1", "標籤2"], "title": "日誌標題"}

不要任何其他說明文字。`,
      '你是一個分析工作日誌的助手，請用繁體中文回答，優先具體不要籠統。'
    )

    let tags: string[] = []
    let title = ''
    try {
      const parsed = extractJSON<{ tags?: string[]; title?: string }>(result)
      tags = validateTags(parsed.tags ?? [], text)
      title = parsed.title ?? ''
    } catch { /* ignore */ }
    return NextResponse.json({ tags, title })
  } catch (err) {
    console.error('[journal/tag]', err)
    return NextResponse.json({ tags: [], title: '' })
  }
}
