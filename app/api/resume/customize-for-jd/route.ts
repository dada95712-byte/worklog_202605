import { callAI } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { validateResumeContent } from '@/lib/resume-validator'
import { validateAIJsonResponse } from '@/lib/ai-response-validator'
import { requireAuth } from '@/lib/auth-guard'

const RESUME_JSON_SCHEMA = `{"jobTitle":"","name":"","email":"","phone":"","location":"","linkedin":"","website":"","summary":"","skills":[],"experiences":[{"company":"","title":"","description":"","startDate":"","endDate":"","current":false}],"education":[{"school":"","degree":"","major":"","year":"","startDate":"","endDate":""}],"languages":[{"name":"","level":""}],"certifications":[{"name":"","issuer":"","issueDate":"","expiryDate":"","neverExpires":false,"credentialId":"","credentialUrl":""}],"conferences":[{"name":"","organizer":"","date":"","role":"","description":""}],"activities":[{"name":"","organization":"","date":"","role":"","description":""}],"rawText":""}`

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { profile, jd, language } = await req.json() as {
      profile: Record<string, unknown>
      jd: string
      language: 'zh' | 'en'
    }
    if (!jd?.trim()) return NextResponse.json({ error: '請提供 JD 內容' }, { status: 400 })

    const langLabel = language === 'en' ? 'English' : '繁體中文'
    const systemPrompt = `你是專業履歷客製化助手。嚴格反幻覺規則：
- 只能使用「個人檔案庫資料」中明確存在的資訊，嚴禁推論、補充或創造任何未提供的資訊
- 公司名稱、學校名稱、職稱、日期必須與原始資料完全一致，不得更改
- 根據 JD 選擇最相關的技能、經歷，調整措辭以符合 JD 語言風格（措辭可調整，事實不得更改）
- skills 陣列優先放 JD 要求且檔案庫中存在的技能
- summary 針對 JD 撰寫，不超過 150 字，語言使用${langLabel}
- 所有文字內容使用${langLabel}
- 從 JD 擷取 jobTitle（職位名稱），放入 JSON 的 jobTitle 欄位
- 回傳純 JSON，不要包含任何說明文字`

    const prompt = `根據以下職位描述（JD）和個人檔案庫資料，生成一份客製化履歷。

職位描述（JD）：
${jd.slice(0, 3000)}

個人檔案庫資料：
${JSON.stringify(profile, null, 2).slice(0, 6000)}

重要：experiences 的 company/title、education 的 school/degree/major 必須與資料來源完全一致。

另外，在 JSON 最外層加入 jd_match_highlights 陣列，列出從 JD 擷取的 5-10 個關鍵詞（技能、工具、職能要求），用於在履歷中高亮顯示。

請回傳以下格式的純 JSON：
{"resume": ${RESUME_JSON_SCHEMA}, "jd_match_highlights": ["關鍵詞1", "關鍵詞2"]}`

    const raw = await callAI(prompt, systemPrompt)
    const result = extractJSON<{ resume?: Record<string, unknown>; jd_match_highlights?: string[] }>(raw)
    const resume = result.resume ?? (result as Record<string, unknown>)
    const jd_match_highlights: string[] = result.jd_match_highlights ?? []
    const jobTitle = (resume.jobTitle as string) || ''

    // Garble / structure validation
    const jsonValidation = validateAIJsonResponse(resume, ['name'])
    // Content validation against source profile
    const contentValidation = validateResumeContent(
      resume as Parameters<typeof validateResumeContent>[0],
      profile as Parameters<typeof validateResumeContent>[1],
    )

    const _validation = {
      issues: [...jsonValidation.issues, ...contentValidation.invalidatedFields],
      invalidatedFields: contentValidation.invalidatedFields,
    }

    return NextResponse.json({ resume: { ...resume, lang: language }, jobTitle, jd_match_highlights, _validation })
  } catch (err) {
    console.error('[resume/customize-for-jd]', err)
    return NextResponse.json({ error: '生成失敗，請稍後再試' }, { status: 500 })
  }
}
