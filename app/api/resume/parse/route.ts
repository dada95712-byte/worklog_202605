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
        .flatMap(page => page.Texts)
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

    const prompt = `Parse the following resume content. Auto-detect the language (Traditional Chinese or English) and reply in the SAME language as the resume.

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

    const aiResponse = await callAI(prompt)
    let parsed: Record<string, unknown> = {}
    try { parsed = extractJSON<Record<string, unknown>>(aiResponse) } catch { parsed = {} }

    return NextResponse.json({
      name: parsed.name ?? '',
      email: parsed.email ?? '',
      phone: parsed.phone ?? '',
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      rawText,
    })
  } catch (err) {
    console.error('Resume parse error:', err)
    return NextResponse.json({ error: '解析失敗，請再試一次' }, { status: 500 })
  }
}
