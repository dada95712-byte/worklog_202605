import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

async function parsePDF(buffer: Buffer): Promise<string> {
  const PDFParser = (await import('pdf2json')).default
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataReady', (pdfData: { Pages: { Texts: { R: { T: string }[] }[] }[] }) => {
      const text = pdfData.Pages
        .flatMap(p => p.Texts)
        .map(t => decodeURIComponent(t.R.map((r) => r.T).join('')))
        .join(' ')
      resolve(text)
    })
    parser.on('pdfParser_dataError', reject)
    parser.parseBuffer(buffer)
  })
}

async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

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

    const prompt = `你是履歷解析專家，能夠處理各種格式與範本的履歷。
請從以下履歷原文中，擷取所有資訊並對應到指定欄位。

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

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json({ parsed: result })
  } catch (err) {
    console.error('Import resume error:', err)
    return NextResponse.json({ error: '解析失敗，請再試一次' }, { status: 500 })
  }
}
