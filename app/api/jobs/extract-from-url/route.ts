import { NextRequest, NextResponse } from 'next/server'
import { callAI, isRateLimitError } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import * as cheerio from 'cheerio'
import { requireAuth } from '@/lib/auth-guard'

function detectPlatform(url: string): string {
  if (url.includes('104.com.tw'))  return '104'
  if (url.includes('linkedin.com')) return 'LinkedIn'
  if (url.includes('cake.me'))     return 'Cake.me'
  if (url.includes('yourator.co')) return 'Yourator'
  if (url.includes('1111.com.tw')) return '1111'
  return '其他'
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { url } = await req.json()

    // Step 1 — validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ success: false, error: 'invalid_url', message: '請輸入有效的網址' }, { status: 400 })
    }
    try {
      const p = new URL(url)
      if (!['http:', 'https:'].includes(p.protocol)) throw new Error('bad protocol')
    } catch {
      return NextResponse.json({ success: false, error: 'invalid_url', message: '請輸入有效的 http/https 網址' }, { status: 400 })
    }

    // Step 2 — fetch page with timeout
    let html: string
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({ success: false, error: 'login_required', message: '此職缺頁面需要登入才能查看，請改用「貼上 JD」方式' })
      }
      if (!res.ok) {
        return NextResponse.json({ success: false, error: 'fetch_failed', message: '無法自動擷取此連結，請改用「貼上 JD」方式' })
      }
      html = await res.text()
    } catch (e) {
      const err = e as { name?: string }
      if (err.name === 'TimeoutError' || err.name === 'AbortError') {
        return NextResponse.json({ success: false, error: 'fetch_failed', message: '讀取頁面逾時，請改用「貼上 JD」方式' })
      }
      return NextResponse.json({ success: false, error: 'fetch_failed', message: '無法自動擷取此連結，請改用「貼上 JD」方式' })
    }

    // Step 3 — parse with cheerio, strip nav/chrome
    const $ = cheerio.load(html)
    $('nav, header, footer, script, style, noscript, iframe, [role="navigation"], [role="banner"], [role="complementary"]').remove()

    let text = ''
    for (const sel of ['main', 'article', '[class*="job-detail"]', '[class*="job_detail"]', '[class*="jd-"]', '[class*="position"]', '#content', '.content', '[class*="description"]']) {
      const el = $(sel).first()
      if (el.length && el.text().trim().length > 200) { text = el.text(); break }
    }
    if (!text) text = $('body').text()
    text = text.replace(/\s+/g, ' ').trim()

    if (text.length < 100) {
      return NextResponse.json({ success: false, error: 'insufficient_content', message: '擷取到的內容不足，請改用「貼上 JD」方式手動貼上職缺說明' })
    }

    // Step 4 — AI extraction
    const platform = detectPlatform(url)
    const pageSlice = text.slice(0, 3000)

    const prompt = `你是職缺資訊擷取工具。
請從以下網頁內容中，擷取職缺的所有資訊。

網頁內容：
<page_content>${pageSlice}</page_content>

回傳純 JSON（找不到的欄位填 null，不得捏造）：
{
  "company_zh": "公司中文名稱",
  "company_en": "公司英文名稱",
  "title_zh": "職位中文名稱",
  "title_en": "職位英文名稱",
  "location": "工作地點",
  "salary_min": null,
  "salary_max": null,
  "salary_text": "薪資原始文字描述",
  "industry": "產業別（從以下選一：科技/軟體、半導體、電子製造、金融/銀行、保險、電商、零售、醫療/生技、製造業、物流/供應鏈、顧問/管理顧問、廣告/行銷、媒體/出版、教育、政府/非營利、新創、外商、其他）",
  "job_type": "全職/兼職/實習/約聘",
  "deadline": "截止日期 YYYY-MM-DD 格式或 null",
  "source_platform": "${platform}",
  "jd_content": "完整職務說明原文",
  "required_skills": ["技能1", "技能2"],
  "experience_required": "經驗要求描述"
}`

    const aiResponse = await callAI(prompt, '你是職缺資訊擷取工具，請只回傳純 JSON，不加任何其他文字。')
    const job = extractJSON(aiResponse)

    return NextResponse.json({ success: true, job })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ success: false, error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[extract-from-url]', err)
    return NextResponse.json({ success: false, error: 'server_error', message: '分析失敗，請改用「貼上 JD」方式' }, { status: 500 })
  }
}
