import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { parsePDF, parseDOCX, detectGarbledText, callAIWithQualityRetry } from '@/lib/resume-parse'

interface ParsedResume {
  name?: string; email?: string; phone?: string
  skills?: unknown[]; experiences?: unknown[]; education?: unknown[]
}

// 品質重試最差情況下要打好幾次 AI，拉長到接近平台預設逾時時間，明確拉高上限避免被平台中斷
export const maxDuration = 60

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未收到檔案' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    let rawText = ''

    if (ext === 'pdf') {
      rawText = await parsePDF(buffer)
    } else if (ext === 'docx' || ext === 'doc') {
      rawText = await parseDOCX(buffer)
    } else {
      return NextResponse.json({ error: '僅支援 PDF 或 DOCX 格式' }, { status: 400 })
    }

    const garbled = detectGarbledText(rawText)

    const prompt = `Parse the following resume content. Auto-detect the language (Traditional Chinese or English) and reply in the SAME language as the resume.
${garbled ? '\nWARNING: text extraction quality is poor for this file — some Latin letters or digits may show up as garbled symbols (e.g. ■▼▲►◄↑↓). If a field would only contain such garbled symbols or clearly broken text, leave it out entirely rather than copying the garbage.\n' : ''}
Return ONLY a JSON object with these fields:
- name: full name (string)
- email: email address (string)
- phone: phone number (string)
- skills: array of skill strings (keep in original language)
- experiences: array of objects, each with { company, title, description } (strings)
- education: array of objects, each with { school, degree, major, year } (strings)

Resume content:
${rawText.slice(0, 4000)}

Return ONLY valid JSON, no other text.`

    // openrouter/free 會自動路由到品質差異很大的免費模型，偶爾會回傳明顯太空的結果
    // （甚至路由到完全不適合這個任務的模型）；太空就自動換下一次呼叫重試。
    let parsed: ParsedResume = {}
    try {
      parsed = await callAIWithQualityRetry<ParsedResume>(
        prompt,
        (p) => (p.experiences?.length ?? 0) > 0 || (p.education?.length ?? 0) > 0,
      )
    } catch { parsed = {} }

    return NextResponse.json({
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      phone: parsed.phone ?? '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      rawText,
      warning: garbled
        ? '這份檔案的部分內容（通常是英文字母或數字，例如電話、Email、英文技能/工具名稱）因原始檔案的字型嵌入問題無法正確辨識，已略過看起來像亂碼的內容，請仔細檢查並手動補上缺漏的部分。'
        : null,
    })
  } catch (err) {
    console.error('Resume parse error:', err)
    return NextResponse.json({ error: '解析失敗，請再試一次' }, { status: 500 })
  }
}
