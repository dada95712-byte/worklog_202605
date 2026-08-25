import { NextRequest, NextResponse } from 'next/server'
import { callAI, isRateLimitError } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    await params // consume route params (jobId available for future DB writes)
    const { jdContent, userSkills } = await req.json()

    if (!jdContent?.trim()) {
      return NextResponse.json({ error: '缺少 JD 內容' }, { status: 400 })
    }
    if (!Array.isArray(userSkills) || userSkills.length === 0) {
      return NextResponse.json({ error: '缺少使用者技能清單' }, { status: 400 })
    }

    const userSkillList = (userSkills as string[]).join('\n')
    const jdSlice = String(jdContent).slice(0, 3000)

    const prompt = `你是職缺技能比對工具。

使用者目前具備的技能清單（來源：個人資料庫）：
<user_skills>
${userSkillList}
</user_skills>

職缺要求（JD 全文）：
<jd_content>
${jdSlice}
</jd_content>

任務：
1. 從 JD 中擷取所有明確要求的技能（只擷取 JD 原文中出現的技能）
2. 將每個 JD 要求的技能與 <user_skills> 進行比對：
   - 完全符合 → matched
   - 相關但不完全符合 → partial（說明差距）
   - 使用者不具備 → missing

計算匹配分數：matched 技能數 × 1.0 + partial 技能數 × 0.5 ÷ JD 要求技能總數 × 100（取整數）

重要規則：
- JD 要求的技能只能來自 <jd_content> 原文，禁止推論補充
- 使用者技能只能來自 <user_skills>，禁止推論補充
- 技能名稱必須使用原文中出現的詞彙，不得改寫或翻譯
- JD 若無明確技能要求，所有陣列回傳空陣列，match_score 回傳 0
- 推薦資源優先台灣在地平台：Hahow / ALPHA Camp / Coursera

回傳純 JSON（不含任何其他文字）：
{
  "match_score": 75,
  "jd_required_skills": ["技能A", "技能B", "技能C"],
  "matched_skills": [
    { "skill": "技能A", "user_skill": "使用者技能庫中的原始名稱" }
  ],
  "partial_skills": [
    { "skill": "技能B", "user_skill": "相關技能名稱", "gap": "差距說明一句話" }
  ],
  "missing_skills": ["技能C"],
  "full_report": {
    "summary": "整體匹配度摘要（2–3句）",
    "strengths": ["優勢說明1", "優勢說明2"],
    "improvements": [
      {
        "skill": "技能C",
        "priority": "high",
        "suggestion": "補強建議（1句）",
        "resources": ["Hahow 相關課程", "Coursera 課程"]
      }
    ]
  }
}`

    const response = await callAI(prompt)
    const raw = extractJSON(response) as Record<string, unknown> | null

    if (!raw || typeof raw.match_score !== 'number') {
      return NextResponse.json({ error: '分析失敗，請再試一次' }, { status: 500 })
    }

    // Step C: Anti-hallucination validation
    const jdLower = jdSlice.toLowerCase()
    const userSkillsLower = (userSkills as string[]).map(s => s.toLowerCase())

    const rawMatched = (raw.matched_skills as { skill: string; user_skill: string }[] | undefined) ?? []
    const validatedMatched = rawMatched.filter(m => {
      const skillInJd = jdLower.includes(m.skill.toLowerCase())
      const userSkillExists = userSkillsLower.some(s =>
        s.includes(m.user_skill.toLowerCase()) || m.user_skill.toLowerCase().includes(s)
      )
      return skillInJd && userSkillExists
    })
    const invalidated = rawMatched
      .filter(m => !validatedMatched.includes(m))
      .map(m => m.skill)

    const jdRequired = (raw.jd_required_skills as string[] | undefined) ?? []
    const partialSkills = (raw.partial_skills as unknown[] | undefined) ?? []
    const missingSkills = (raw.missing_skills as string[] | undefined) ?? []
    const fullReport = (raw.full_report as Record<string, unknown> | undefined) ?? {}

    const totalRequired = jdRequired.length
    const validatedScore = totalRequired > 0
      ? Math.round((validatedMatched.length * 1.0 + partialSkills.length * 0.5) / totalRequired * 100)
      : 0

    return NextResponse.json({
      matchScore: Math.min(100, validatedScore),
      jdRequiredSkills: jdRequired,
      matchedSkills: validatedMatched,
      partialSkills,
      missingSkills: [...missingSkills, ...invalidated],
      fullReport: { summary: '', strengths: [], improvements: [], ...fullReport },
      analyzedAt: new Date().toISOString(),
    })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('Analyze match error:', err)
    return NextResponse.json({ error: '分析失敗，請再試一次' }, { status: 500 })
  }
}
