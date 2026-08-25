import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { question, answer } = await req.json()
    if (!question || !answer) {
      return NextResponse.json({ error: '缺少題目或答案' }, { status: 400 })
    }

    const prompt = `你是台灣人資面試官，請評估以下面試題目與回答，並以 JSON 格式回傳：
{
  "score": <整體評分 1-10>,
  "feedback": "一句整體評語（繁體中文）",
  "strengths": ["優點1", "優點2"],
  "suggestions": ["改善建議1", "改善建議2"],
  "optimizedAnswer": "根據 STAR 結構改寫的完整優化版回答範例（繁體中文，150-250字）",
  "contentScore": <內容豐富度 1-10，評估細節、數據、具體性>,
  "structureScore": <STAR結構完整性 1-10，評估情境任務行動結果>,
  "persuasionScore": <說服力與表達力 1-10，評估流暢度與說服力>,
  "starHints": "一句具體 STAR 結構改善提示（繁體中文，25字內）"
}

面試題目：${question}

求職者回答：${answer}

評分標準：
- 10分：完整的 STAR 結構、具體量化成果、印象深刻
- 7-9分：結構清晰、有具體例子、略缺量化
- 4-6分：有基本內容但缺乏組織或細節
- 1-3分：過於模糊、無具體例子或明顯偏題

strengths 和 suggestions 各提供 2-3 條，每條限 30 字內。只回傳 JSON。`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Interview evaluate error:', err)
    return NextResponse.json({ error: '評分失敗，請再試一次' }, { status: 500 })
  }
}
