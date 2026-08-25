import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') ?? ''
  const experience = searchParams.get('experience') ?? '3年'

  if (!role) return NextResponse.json({ error: '請輸入職位' }, { status: 400 })

  try {
    const prompt = `你是台灣薪資顧問，請提供「${role}」（年資：${experience}）在台灣市場的薪資行情，以 JSON 格式回傳：
{
  "role": "${role}",
  "industry": "主要產業",
  "experience": "${experience}",
  "median": <中位數月薪（NTD）>,
  "p25": <P25 低標月薪（NTD）>,
  "p75": <P75 高標月薪（NTD）>,
  "source": "資料來源說明",
  "notes": "薪資說明文字（100字以內，包含影響薪資的因素）"
}

注意：
- 薪資以新台幣月薪呈現
- 參考台灣市場實際數據（104人力銀行、主計處）
- 考慮台灣各地區、產業別、公司規模的差異

只回傳 JSON。`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Salary error:', err)
    return NextResponse.json({ error: '薪資查詢失敗，請再試一次' }, { status: 500 })
  }
}
