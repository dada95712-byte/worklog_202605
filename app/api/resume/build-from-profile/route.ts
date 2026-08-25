import { callAI } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { validateResumeContent } from '@/lib/resume-validator'
import { validateAIJsonResponse } from '@/lib/ai-response-validator'
import { requireAuth } from '@/lib/auth-guard'

const RESUME_JSON_SCHEMA = `{"name":"","email":"","phone":"","jobTitle":"","location":"","linkedin":"","website":"","summary":"","skills":[],"experiences":[{"company":"","title":"","description":"","startDate":"","endDate":"","current":false}],"education":[{"school":"","degree":"","major":"","year":"","startDate":"","endDate":""}],"languages":[{"name":"","level":""}],"certifications":[{"name":"","issuer":"","issueDate":"","expiryDate":"","neverExpires":false,"credentialId":"","credentialUrl":""}],"conferences":[{"name":"","organizer":"","date":"","role":"","description":""}],"activities":[{"name":"","organization":"","date":"","role":"","description":""}],"rawText":""}`

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { profile, language } = await req.json() as {
      profile: Record<string, unknown>
      language: 'zh' | 'en'
    }

    const langLabel = language === 'en' ? 'English' : '繁體中文'
    const systemPrompt = `你是專業履歷撰寫助手。嚴格反幻覺規則：
- 只能使用「個人檔案庫資料」中明確存在的資訊，嚴禁推論、補充或創造任何未提供的資訊
- 公司名稱、學校名稱、職稱、日期必須與原始資料完全一致，不得更改
- 若某欄位在資料中為空，填空字串或空陣列，不要省略欄位
- skills 陣列只能包含檔案庫中出現過的技能，不得新增
- summary 根據提供的資料撰寫，不超過 150 字，語言使用${langLabel}
- 所有文字內容使用${langLabel}
- 回傳純 JSON，不要包含任何說明文字`

    const prompt = `根據以下個人檔案庫資料，生成一份完整履歷。

個人檔案庫資料：
${JSON.stringify(profile, null, 2).slice(0, 8000)}

重要：experiences 的 company/title、education 的 school/degree/major 必須與資料來源完全一致。

另外，在 JSON 最外層加入 needs_review 陣列，列出你認為需要人工確認的欄位（例如日期模糊、描述不夠具體等），格式如：
"needs_review": ["experiences[0].description：描述較籠統，建議補充具體成果"]

請回傳以下格式的純 JSON（在根物件加入 needs_review 陣列）：
{"resume": ${RESUME_JSON_SCHEMA}, "needs_review": []}`

    const raw = await callAI(prompt, systemPrompt)
    const result = extractJSON<{ resume?: Record<string, unknown>; needs_review?: string[] }>(raw)
    const resume = result.resume ?? (result as Record<string, unknown>)
    const needs_review: string[] = result.needs_review ?? []

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

    return NextResponse.json({ resume: { ...resume, lang: language }, needs_review, _validation })
  } catch (err) {
    console.error('[resume/build-from-profile]', err)
    return NextResponse.json({ error: '生成失敗，請稍後再試' }, { status: 500 })
  }
}
