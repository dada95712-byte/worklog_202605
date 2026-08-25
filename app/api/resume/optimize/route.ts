import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { title, company, description, lang } = await req.json()
    const isEn = lang === 'en'

    const prompt = isEn
      ? `Optimize the following job description to make it more impactful and ATS-friendly. Requirements:
1. Start each bullet with a strong action verb (Led, Designed, Built, Drove, etc.)
2. Quantify achievements where possible (e.g., increased XX% , managed team of XX)
3. Highlight core contributions and tech stack
4. Format as 3-4 bullet points, each starting with •
5. Write entirely in English

Job Title: ${title || '(not provided)'}
Company: ${company || '(not provided)'}
Original Description: ${description || '(not provided)'}

Return only the optimized bullet points, no other explanation.`
      : `請優化以下工作描述，使其更有影響力且 ATS 友善。要求：
1. 使用強力動詞開頭（負責、主導、設計、推動等）
2. 盡量量化成果（如：提升 XX%、管理 XX 人）
3. 突出核心貢獻和技術棧
4. 分 3-4 個要點，每點以 • 開頭
5. 保持繁體中文

職稱：${title || '（未填）'}
公司：${company || '（未填）'}
原描述：${description || '（未填）'}

只回傳優化後的條列文字，不要其他說明。`

    const systemPrompt = isEn
      ? 'You are a professional resume writing consultant. Reply in English only.'
      : '你是一位專業的履歷撰寫顧問，請用繁體中文回答。'

    const optimized = await callAI(prompt, systemPrompt)
    return NextResponse.json({ description: optimized.trim() })
  } catch {
    return NextResponse.json({ error: '優化失敗' }, { status: 500 })
  }
}
