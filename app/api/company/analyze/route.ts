import { NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { company } = await req.json()
    if (!company?.trim()) return NextResponse.json({ error: '請輸入公司名稱' }, { status: 400 })

    // Gather context with Serper if available
    let webContext = ''
    const serperKey = process.env.SERPER_API_KEY
    if (serperKey) {
      try {
        const searches = await Promise.all([
          fetch('https://google.serper.dev/search', {
            method: 'POST',
            headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${company} 公司介紹 Taiwan`, num: 5 }),
          }),
          fetch('https://google.serper.dev/news', {
            method: 'POST',
            headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: `${company} 新聞 2024 2025`, num: 5 }),
          }),
        ])
        const [info, news] = await Promise.all(searches.map((r) => r.json()))

        const infoSnippets = (info.organic ?? []).map((r: Record<string, string>) => r.snippet).join('\n')
        const newsSnippets = (news.news ?? []).map((r: Record<string, string>) => `${r.title}: ${r.snippet}`).join('\n')
        webContext = `公開資訊：\n${infoSnippets}\n\n近期新聞：\n${newsSnippets}`
      } catch (e) {
        console.warn('[company analyze] Serper failed:', e)
      }
    }

    const prompt = `你是一位專業的企業分析師。請根據以下資訊（若無資訊則根據你的知識庫）分析「${company}」，產出完整的企業分析報告。

${webContext ? `網路搜尋資料：\n${webContext}\n\n` : ''}

請以 JSON 格式回傳，包含以下六個區塊：

{
  "background": {
    "founded": "成立年份",
    "size": "員工規模",
    "location": "總部地點",
    "business": "主要業務描述（100字）"
  },
  "businessModel": {
    "revenue": "收入來源",
    "targetCustomers": "目標客群",
    "valueProposition": "核心價值主張（80字）"
  },
  "swot": {
    "strengths": ["優勢1", "優勢2", "優勢3"],
    "weaknesses": ["劣勢1", "劣勢2"],
    "opportunities": ["機會1", "機會2"],
    "threats": ["威脅1", "威脅2"]
  },
  "marketAnalysis": "市場、產品與服務分析（150字）",
  "industryTrends": "所屬產業近期新聞與趨勢（150字）",
  "companyUpdates": "公司近期動態（招募、融資、產品發布等，100字）",
  "dataSources": ["資料來源1", "資料來源2"],
  "analyzedAt": "${new Date().toISOString()}"
}

只回傳 JSON，不要其他說明。`

    const response = await callAI(prompt, '你是一位台灣企業分析師，請用繁體中文回答，資料盡量準確具體。')
    const report = extractJSON(response)
    return NextResponse.json({ company, report, hasWebData: !!webContext })
  } catch (err) {
    console.error('[company/analyze]', err)
    return NextResponse.json({ error: '分析失敗，請稍後再試' }, { status: 500 })
  }
}
