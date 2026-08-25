import { NextRequest, NextResponse } from 'next/server'
import { callAI, isRateLimitError } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { original_content, title, company } = await req.json()
    if (!original_content) return NextResponse.json({ error: '缺少工作描述內容' }, { status: 400 })

    const prompt = `你是專業履歷優化師。
職位：${title || '（未填寫）'}
公司：${company || '（未填寫）'}
原始工作描述：
<original>${String(original_content).slice(0, 1500)}</original>

請提供 3 種優化版本，風格各異：
版本 1：強調數據成果（若原文有數字則強化，無數字則維持質性描述）
版本 2：強調跨部門協作與溝通能力
版本 3：強調專業技術與流程優化

重要規則：
- 只能根據原文內容改寫，不得新增任何原文沒有的職責或成就
- 不得捏造數字（原文無數字，優化版本也不得出現數字）
- 每條列點維持 1–2 句，以動詞開頭（Developed / Managed / Led / 開發 / 管理 / 主導）
- 三個版本各自獨立，風格明顯不同

回傳純 JSON：
{
  "versions": [
    { "label": "強調成果導向", "bullets": ["...", "..."] },
    { "label": "強調協作溝通", "bullets": ["...", "..."] },
    { "label": "強調技術流程", "bullets": ["...", "..."] }
  ]
}`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('Optimize description error:', err)
    return NextResponse.json({ error: '優化失敗，請再試一次' }, { status: 500 })
  }
}
