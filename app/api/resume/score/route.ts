import { NextRequest, NextResponse } from 'next/server'
import { callAI, isRateLimitError } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 常駐顯示用：取該履歷最新一筆評分紀錄（含細項與建議），不需重新呼叫 AI
export async function GET(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const resumeId = req.nextUrl.searchParams.get('resumeId')
  if (!resumeId) return NextResponse.json({ error: '缺少 resumeId' }, { status: 400 })

  const latest = await prisma.resumeScore.findFirst({
    where: { resumeId, userId },
    orderBy: { createdAt: 'desc' },
  })
  if (!latest) return NextResponse.json({ score: null })

  return NextResponse.json({
    score: {
      score: latest.scoreOverall,
      atsScore: latest.scoreAts,
      dimensions: {
        content: latest.scoreContent,
        keywords: latest.scoreKeyword,
        format: latest.scoreFormat,
        impact: latest.scoreImpact,
      },
      suggestions: latest.suggestions ?? [],
      keywords: latest.keywords ?? [],
      scoredAt: latest.createdAt.toISOString(),
    },
  })
}

export async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const { resumeText, lang, resumeId } = await req.json()
    if (!resumeText) return NextResponse.json({ error: '缺少履歷內容' }, { status: 400 })
    const isEn = lang === 'en'

    const prompt = isEn
      ? `You are a senior HR consultant. Evaluate the following resume and return ONLY a JSON object in this exact format:
{
  "score": <overall 0-100>,
  "atsScore": <ATS friendliness 0-100>,
  "dimensions": {
    "content": <content completeness 0-100>,
    "keywords": <ATS keyword density 0-100>,
    "format": <format and readability 0-100>,
    "impact": <quantified achievements 0-100>
  },
  "suggestions": [
    { "priority": "high", "issue": "<specific problem>", "fix": "<specific action>", "section": "<one of: personal|summary|experience|education|skills|languages>" },
    { "priority": "medium", "issue": "...", "fix": "...", "section": "..." },
    { "priority": "low", "issue": "...", "fix": "...", "section": "..." }
  ],
  "keywords": ["<suggested keyword 1>", "<suggested keyword 2>"]
}
Provide at least 5 suggestions across all priority levels. Return ONLY valid JSON.

Resume:
${resumeText.slice(0, 3000)}`
      : `你是一位資深的台灣人資顧問。請評估以下履歷並只回傳以下 JSON 格式，不要其他文字：
{
  "score": <整體評分 0-100>,
  "atsScore": <ATS 友善度 0-100>,
  "dimensions": {
    "content": <內容完整度 0-100>,
    "keywords": <ATS 關鍵字密度 0-100>,
    "format": <格式與可讀性 0-100>,
    "impact": <成就量化程度 0-100>
  },
  "suggestions": [
    { "priority": "high", "issue": "<具體問題>", "fix": "<具體改法>", "section": "<填入: personal|summary|experience|education|skills|languages 之一>" },
    { "priority": "medium", "issue": "...", "fix": "...", "section": "..." },
    { "priority": "low", "issue": "...", "fix": "...", "section": "..." }
  ],
  "keywords": ["建議加入的關鍵字1", "關鍵字2"]
}
至少提供 5 條 suggestions，涵蓋不同 priority。只回傳 JSON。

履歷內容：
${resumeText.slice(0, 3000)}`

    const systemPrompt = isEn
      ? 'You are a professional resume consultant. Reply in English only.'
      : '你是一位專業的履歷撰寫顧問，請用繁體中文回答。'

    const response = await callAI(prompt, systemPrompt)
    const result = extractJSON<Record<string, unknown>>(response)

    // Normalise + guard
    const dims = (result.dimensions ?? {}) as Record<string, unknown>
    const rawSuggestions = Array.isArray(result.suggestions) ? result.suggestions : []

    const scoreOverall = Math.min(100, Math.max(0, Number(result.score)    || 0))
    const scoreAts     = Math.min(100, Math.max(0, Number(result.atsScore) || 0))
    const dimensions = {
      content:  Math.min(100, Math.max(0, Number(dims.content)  || 0)),
      keywords: Math.min(100, Math.max(0, Number(dims.keywords) || 0)),
      format:   Math.min(100, Math.max(0, Number(dims.format)   || 0)),
      impact:   Math.min(100, Math.max(0, Number(dims.impact)   || 0)),
    }
    const suggestions = rawSuggestions.map((s: { priority?: string; issue?: string; fix?: string; section?: string }) => ({
      priority: ['high', 'medium', 'low'].includes(s.priority ?? '') ? s.priority : 'medium',
      issue:   s.issue ?? '',
      fix:     s.fix   ?? '',
      section: s.section ?? null,
    }))
    const keywords = Array.isArray(result.keywords) ? result.keywords : []

    // 若帶有 resumeId 且該履歷確實屬於此使用者，落地存一筆評分紀錄
    if (resumeId) {
      const owns = await prisma.resume.findFirst({ where: { id: resumeId, userId }, select: { id: true } })
      if (owns) {
        await prisma.resumeScore.create({
          data: {
            userId, resumeId,
            scoreOverall, scoreAts,
            scoreContent: dimensions.content,
            scoreKeyword: dimensions.keywords,
            scoreFormat:  dimensions.format,
            scoreImpact:  dimensions.impact,
            suggestions, keywords,
            language: isEn ? 'en' : 'zh-TW',
          },
        })
      }
    }

    return NextResponse.json({
      score: scoreOverall,
      atsScore: scoreAts,
      dimensions,
      suggestions,
      keywords,
    })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('Resume score error:', err)
    return NextResponse.json({ error: '評分失敗' }, { status: 500 })
  }
}
