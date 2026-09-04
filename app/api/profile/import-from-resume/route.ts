import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { parsePDF, parseDOCX, detectGarbledText, callAIWithQualityRetry } from '@/lib/resume-parse'

interface ParsedResume {
  education?: unknown[]
  experience?: unknown[]
  [key: string]: unknown
}

// 品質重試最差情況下要打好幾次 AI，拉長到接近平台預設逾時時間，明確拉高上限避免被平台中斷
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '請上傳檔案' }, { status: 400 })

    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) return NextResponse.json({ error: '檔案大小不能超過 10MB' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const name = file.name.toLowerCase()

    let rawText = ''
    if (name.endsWith('.pdf')) {
      rawText = await parsePDF(buffer)
    } else if (name.endsWith('.docx') || name.endsWith('.doc')) {
      rawText = await parseDOCX(buffer)
    } else {
      return NextResponse.json({ error: '不支援此格式，請上傳 PDF、DOC 或 DOCX' }, { status: 400 })
    }

    if (!rawText.trim()) return NextResponse.json({ error: '無法讀取檔案內容，請確認檔案未加密' }, { status: 400 })

    // 部分 PDF（常見於某些線上履歷產生器）的英文/數字用自繪字形嵌入，沒有正確字元對應表，
    // 擷取工具只能猜測，猜錯會產生方塊/箭頭等符號。中文字通常不受影響。
    // 偵測到就額外提醒 AI 不要照抄亂碼，並回傳警告讓使用者知道要仔細檢查對應欄位。
    const garbled = detectGarbledText(rawText)

    const prompt = `你是履歷解析專家，能夠處理各種格式與範本的履歷。
請從以下履歷原文中，擷取所有資訊並對應到指定欄位。${garbled ? '\n\n⚠️ 注意：這份文件的原文擷取品質不佳，部分英文字母或數字可能顯示為方塊、箭頭等亂碼符號（例如 ■▼▲►◄↑↓ 等）。任何欄位如果對應到的內容包含這類亂碼符號、或明顯不成字詞，請填 null，絕對不要把亂碼符號照抄進欄位裡。' : ''}

履歷原文：
<resume>${rawText.slice(0, 4000)}</resume>

請回傳純 JSON，對應以下結構（找不到的欄位填 null，不得捏造）：
{
  "basic": {
    "name_zh": null, "name_en": null, "email": null, "phone": null, "address": null,
    "linkedin_url": null, "portfolio_url": null, "website_url": null
  },
  "education": [{
    "school_name_zh": null, "school_name_en": null,
    "degree": null, "major_zh": null,
    "start_date": null, "end_date": null, "gpa": null, "description": null
  }],
  "experience": [{
    "company_zh": null, "company_en": null,
    "title_zh": null, "title_en": null,
    "location": null, "start_date": null, "end_date": null,
    "is_current": false, "description": null
  }],
  "internship": [{
    "company_zh": null, "company_en": null,
    "title_zh": null, "title_en": null,
    "location": null, "start_date": null, "end_date": null, "description": null
  }],
  "project": [{
    "project_name_zh": null, "project_name_en": null,
    "role_zh": null, "role_en": null,
    "start_date": null, "end_date": null, "url": null, "description": null
  }],
  "skills": [{ "skill_name": null, "category": null }],
  "languages": [{ "language": null, "proficiency": null }],
  "certificates": [{ "name": null, "issuer": null, "issue_date": null, "credential_url": null }],
  "activities": [{
    "organization_zh": null, "role": null,
    "start_date": null, "end_date": null, "description": null
  }],
  "summary_zh": null, "summary_en": null
}

重要規則：
- 所有欄位只填入履歷原文中明確出現的資訊
- 中英文名稱若原文只有一種，另一種填 null，不得自行翻譯
- 日期統一轉換為 YYYY-MM 格式
- 不得補充、推論或創造任何原文沒有的內容
- 只回傳 JSON，不要其他文字`

    // openrouter/free 會自動路由到品質差異很大的免費模型，偶爾會回傳明顯太空的結果
    // （甚至路由到完全不適合這個任務的模型）；太空就自動換下一次呼叫重試。
    const result = await callAIWithQualityRetry<ParsedResume>(
      prompt,
      (p) => (p.education?.length ?? 0) > 0 || (p.experience?.length ?? 0) > 0,
    )
    return NextResponse.json({
      parsed: result,
      warning: garbled
        ? '這份 PDF 的部分內容（通常是英文字母或數字，例如電話、Email、英文技能/工具名稱）因原始檔案的字型嵌入問題無法正確辨識，AI 已略過看起來像亂碼的內容。請在下方確認清單中仔細檢查這類欄位，缺漏的部分需要手動補上。'
        : null,
    })
  } catch (err) {
    console.error('Import resume error:', err)
    return NextResponse.json({ error: '解析失敗，請再試一次' }, { status: 500 })
  }
}
