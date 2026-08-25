import { callAI } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { journalText } = await req.json()
    if (!journalText?.trim()) return NextResponse.json({ skills: [] })

    const result = await callAI(
      `根據以下工作日誌內容，推薦這個人應該標記或加強的職業技能。

日誌內容：
${journalText.slice(0, 2000)}

請回覆一個 JSON 陣列，包含 5–10 個技能名稱，例如：
["專案管理", "跨部門溝通", "數據分析", "React", "Python"]

只回覆 JSON 陣列，不要其他說明。`,
      '你是一個專業的台灣職涯顧問，請用繁體中文回答。'
    )

    const skills: string[] = extractJSON<string[]>(result)
    return NextResponse.json({ skills: Array.isArray(skills) ? skills.slice(0, 10) : [] })
  } catch (err) {
    console.error('[skills/recommend-from-journal]', err)
    return NextResponse.json({ skills: [] }, { status: 500 })
  }
}
