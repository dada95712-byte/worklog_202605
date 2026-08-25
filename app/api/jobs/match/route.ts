import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { jdText, userSkills } = await req.json()
    if (!jdText) return NextResponse.json({ error: '缺少職缺描述' }, { status: 400 })

    const prompt = `你是台灣職涯顧問，請分析以下職缺需求，並以 JSON 格式回傳匹配分析：
{
  "matchScore": <匹配分數 0-100>,
  "matchedSkills": ["符合的技能1", "符合的技能2"],
  "missingSkills": ["缺乏的技能1", "缺乏的技能2"],
  "topKeywords": ["重要關鍵字1", "重要關鍵字2", ...最多10個]
}

${userSkills ? `求職者技能：${userSkills}` : '（未提供求職者技能，請根據一般應屆或初階求職者評估）'}

職缺描述：
${jdText.slice(0, 2000)}

請只回傳 JSON。`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Job match error:', err)
    return NextResponse.json({ matchScore: 50, matchedSkills: [], missingSkills: [], topKeywords: [] })
  }
}
