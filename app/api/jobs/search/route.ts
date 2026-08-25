import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query') ?? ''
  const location = searchParams.get('location') ?? '台北市'

  if (!query) return NextResponse.json({ error: '請輸入搜尋關鍵字' }, { status: 400 })

  const jsearchKey = process.env.JSEARCH_API_KEY
  const serperKey = process.env.SERPER_API_KEY

  if (jsearchKey) {
    try {
      const params = new URLSearchParams({
        query: `${query} ${location} site:104.com.tw OR site:cake.me`,
        page: '1', num_pages: '1', country: 'tw', date_posted: 'month',
      })
      const res = await fetch(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { 'X-RapidAPI-Key': jsearchKey, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      })
      const data = await res.json()
      if (data.data?.length) {
        const jobs = data.data.map((j: Record<string, unknown>, i: number) => ({
          id: `jsearch-${i}`,
          title: j.job_title ?? '',
          company: j.employer_name ?? '',
          location: (j.job_city as string) ?? location,
          description: (j.job_description as string)?.slice(0, 500) ?? '',
          url: j.job_apply_link ?? '',
          platform: j.job_publisher ?? '104',
          salaryMin: j.job_min_salary ? Number(j.job_min_salary) : undefined,
          salaryMax: j.job_max_salary ? Number(j.job_max_salary) : undefined,
        }))
        return NextResponse.json({ jobs })
      }
    } catch (err) { console.warn('JSearch failed:', err) }
  }

  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: `${query} 工作 ${location} site:104.com.tw`, num: 10 }),
      })
      const data = await res.json()
      if (data.organic?.length) {
        const jobs = data.organic.map((r: Record<string, unknown>, i: number) => ({
          id: `serper-${i}`,
          title: (r.title as string)?.replace(' - 104人力銀行', '') ?? query,
          company: (r.snippet as string)?.split('·')[0]?.trim() ?? '台灣企業',
          location,
          description: r.snippet ?? '',
          url: r.link ?? '',
          platform: '104',
        }))
        return NextResponse.json({ jobs })
      }
    } catch (err) { console.warn('Serper failed:', err) }
  }

  // AI fallback — generate realistic mock Taiwan job listings
  try {
    const aiResult = await callAI(
      `你是台灣求職市場專家。請生成 7 筆「${query}」在「${location}」的模擬職缺，格式為 JSON 陣列：
[{
  "id": "ai-1",
  "title": "職位名稱",
  "company": "公司名稱（使用真實常見的台灣公司名）",
  "location": "${location}",
  "description": "職缺描述（100字以內，含工作內容與要求）",
  "platform": "104",
  "salaryMin": 50000,
  "salaryMax": 80000
}]
只回傳 JSON 陣列，不要其他文字。`,
      '你是台灣人力資源專家，請用繁體中文回答。'
    )
    const jobs = extractJSON<unknown[]>(aiResult)
    return NextResponse.json({
      jobs: Array.isArray(jobs) ? jobs : [],
      aiGenerated: true,
      note: '⚠ AI 模擬資料，僅供參考',
    })
  } catch (err) {
    console.error('AI fallback failed:', err)
  }

  return NextResponse.json({ jobs: [], error: '職缺搜尋暫時無法使用' })
}
