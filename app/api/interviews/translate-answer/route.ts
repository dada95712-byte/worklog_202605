import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { answer_zh, question_zh, question_en, title } = await req.json()
    if (!answer_zh || !question_zh) {
      return NextResponse.json({ error: '缺少回答或問題' }, { status: 400 })
    }

    const titlePart = title ? `（應徵職位：${title}）` : ''
    const enQLine = question_en ? `面試題目（英文）：${question_en}\n` : ''

    const prompt = `你是一位台灣職場英文顧問${titlePart}。請完成以下兩件事並以 JSON 格式回傳：

1. 將求職者的中文面試回答翻譯成流暢、專業的英文，適合在外商面試使用。保留 STAR 結構、具體細節與數字。不加任何前綴說明，直接輸出翻譯本文。

2. 從回答中選出 2-3 個台灣職場人常用但英文表達可以更道地的片語或詞語，提供職場英文學習提示。

面試題目（中文）：${question_zh}
${enQLine}求職者回答（中文）：${answer_zh}

只回傳如下 JSON：
{
  "translation": "完整英文翻譯，自然流暢，適合外商面試",
  "tips": [
    {
      "phrase": "中文原詞（例如：跨部門溝通）",
      "usage": "道地英文表達（例如：cross-functional collaboration）",
      "example": "例句：I led cross-functional collaboration between engineering and marketing teams."
    }
  ]
}`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Translate answer error:', err)
    return NextResponse.json({ error: '翻譯失敗，請再試一次' }, { status: 500 })
  }
}
