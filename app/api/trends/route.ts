import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function GET() {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const prompt = `你是台灣職場趨勢分析師，請分析目前（2026年）台灣各主要產業的招募趨勢，以 JSON 格式回傳：
{
  "trends": [
    {
      "industry": "產業名稱",
      "trend": "up" | "stable" | "down",
      "hotJobs": ["熱門職缺1", "熱門職缺2", "熱門職缺3"],
      "notes": "趨勢說明（50字以內）"
    }
  ]
}

請分析以下 6 個產業：科技/半導體、金融科技、電商/零售、醫療生技、製造業、媒體行銷

只回傳 JSON。`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Trends error:', err)
    return NextResponse.json({ error: '趨勢分析失敗，請再試一次' }, { status: 500 })
  }
}
