import { NextRequest, NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { isRateLimitError } from '@/lib/ai-client'
import { requireAuth } from '@/lib/auth-guard'

// ── Types ─────────────────────────────────────────────────────────────────────

type SourceType = 'search_result' | 'jd_inference' | 'general_inference' | null

interface SourcedText {
  content: string | null
  source: SourceType
  sourceUrl?: string | null
}

// ── Raw fetch wrapper with OpenRouter web-search plugin ───────────────────────

async function callWithSearch(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY not set')

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: userPrompt },
  ]

  const doFetch = async (usePlugin: boolean, maxRetries = 3): Promise<string> => {
    const body: Record<string, unknown> = {
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      messages,
    }
    if (usePlugin) body.plugins = [{ id: 'web' }]

    let lastErr: Error | undefined
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.status === 429) {
        const retryAfter = res.headers.get('retry-after')
        const waitMs = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000 + Math.random() * 500
        console.warn(`[CompanyAnalysis] 429，等待 ${Math.round(waitMs)}ms（第 ${attempt + 1}/${maxRetries} 次）`)
        await new Promise(r => setTimeout(r, waitMs))
        lastErr = Object.assign(new Error('rate_limit: HTTP 429'), { status: 429 })
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) throw new Error('Empty response')
      return content as string
    }
    throw Object.assign(new Error(`rate_limit: company-analysis 在 ${maxRetries} 次重試後仍返回 429`), { status: 429 })
  }

  // Try with web search plugin; fall back to standard call
  try {
    return await doFetch(true)
  } catch (err) {
    if (isRateLimitError(err)) throw err  // propagate rate limit; don't retry without plugin
    return await doFetch(false)
  }
}

// ── Dedicated salary search step (功能6) ──────────────────────────────────────

async function fetchSalaryStructured(title: string): Promise<SourcedText | null> {
  if (!title?.trim()) return null

  const system = '你是薪資資料查詢工具，只回傳搜尋到的真實薪資數字，嚴禁捏造。請用繁體中文回答。'
  const prompt = `請搜尋「${title} 薪資 台灣 2026」和「${title} 月薪 台灣」。

只回傳以下 JSON，不要其他文字：
{
  "content": "根據搜尋結果的薪資範圍描述（格式：NTD XX~YY 萬/月），或 null（若搜尋無結果）",
  "source": "search_result（有真實搜尋結果）或 general_inference（無法搜尋到，根據同類職位推估，加上建議自行確認）",
  "sourceUrl": "薪資來源網址或 null"
}`

  try {
    const raw = await callWithSearch(system, prompt)
    const parsed = extractJSON<{ content: string | null; source: SourceType; sourceUrl?: string | null }>(raw)
    if (!parsed || parsed.content === undefined) return null
    return parsed
  } catch {
    return null
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { company, title, jd_content } = await req.json()
    if (!company) return NextResponse.json({ error: '請輸入公司名稱' }, { status: 400 })

    const titlePart = title ? `和職位「${title}」` : ''
    const jdSection = jd_content
      ? `\n以下是職缺 JD（僅用於推斷企業文化）：\n${String(jd_content).slice(0, 1500)}`
      : ''

    const trendSearchNote = `請搜尋「${title || company} 招募趨勢 2026 台灣」和「${title || company} 職缺 台灣 2026」，根據結果摘要趨勢。`
    const companySearchNote = `請搜尋「${company} 官網 台灣」和「${company} 競爭對手 台灣」取得公司資訊。`

    const system = '你是台灣資深職涯顧問兼資料驗證專家，對資料來源極度謹慎，絕不捏造數字或無法驗證的資訊。請用繁體中文回答。'

    const prompt = `請分析公司「${company}」${titlePart}。${jdSection}

**搜尋指示**：
- ${companySearchNote}
- ${trendSearchNote}

**嚴格規則 — 違反即為失敗**：
1. 每條資訊必須附 source 欄位：
   - "search_result"：有搜尋到的真實資料，附 sourceUrl（完整網址）
   - "jd_inference"：僅根據提供 JD 原文推測，無 JD 時不得使用
   - "general_inference"：同產業一般推測，需在 content 中加「建議自行確認」
   - null：完全不確定，content 也必須為 null
2. **絕對禁止**：員工確切人數、確切年營收、無法搜尋到的內部薪資數字
3. 企業文化：僅根據 JD 推測（source="jd_inference"），無 JD 則用 general_inference
4. 面試流程：source 必須為 "general_inference"，content 結尾必須加上「⚠ 以上為常見情況，請以公司官方說明為準」
5. 競爭對手：搜尋到則填 search_result，否則根據產業知識填 general_inference

只回傳如下 JSON（不含 salaryNegotiation，由獨立查詢提供），不要其他文字：
{
  "basicInfo": {
    "content": "公司基本資訊（產業別、規模、主要業務），或 null",
    "source": "search_result | general_inference | null",
    "sourceUrl": "搜尋到的網址或 null"
  },
  "culture": {
    "content": "企業文化（工作節奏、加班、年終），或 null",
    "source": "jd_inference | general_inference | null"
  },
  "rolePosition": {
    "content": "職位定位（組織重要性、彙報層級、跨部門合作），或 null",
    "source": "general_inference | null"
  },
  "interviewProcess": {
    "content": "面試流程情報（⚠ 以上為常見情況，請以公司官方說明為準），或 null",
    "source": "general_inference | null"
  },
  "competitors": {
    "names": ["競爭對手1", "競爭對手2", "競爭對手3"],
    "source": "search_result | general_inference | null",
    "sourceUrl": "搜尋來源網址或 null"
  },
  "roleTrend": {
    "recruitmentHeat": "高 | 中 | 低 | null",
    "topSkills": ["技能1", "技能2", "技能3", "技能4", "技能5"],
    "threeMonthTrend": "近3個月趨勢說明（附搜尋依據），或 null",
    "source": "search_result | general_inference | null",
    "sourceUrl": "趨勢來源網址或 null"
  }
}`

    // Run company analysis and dedicated salary search in parallel (功能6)
    const [raw, salaryResult] = await Promise.all([
      callWithSearch(system, prompt),
      title ? fetchSalaryStructured(title) : Promise.resolve(null),
    ])

    const result = extractJSON(raw) as Record<string, unknown>

    // Merge dedicated salary result into salaryNegotiation field
    result.salaryNegotiation = salaryResult ?? {
      content: null,
      source: null,
      sourceUrl: null,
    }

    return NextResponse.json(result)
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json(
        { error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' },
        { status: 429 }
      )
    }
    console.error('Company analysis error:', err)
    return NextResponse.json({ error: '分析失敗，請再試一次' }, { status: 500 })
  }
}
