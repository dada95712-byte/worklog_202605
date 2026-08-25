import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { journalText } = await req.json()
    if (!journalText) return NextResponse.json({ error: '缺少日誌內容' }, { status: 400 })

    const prompt = `請將以下工作經歷或成就轉換成 STAR 格式（繁體中文），格式如下：

**情境（Situation）**
[描述當時的背景與情況]

**任務（Task）**
[你負責的任務或目標]

**行動（Action）**
[你具體採取了哪些行動步驟]

**結果（Result）**
[最終帶來的成果，盡量量化]

工作經歷：
${journalText}

請直接輸出 STAR 格式內容。`

    const star = await callAI(prompt)
    return NextResponse.json({ star })
  } catch (err) {
    console.error('STAR convert error:', err)
    return NextResponse.json({ error: '轉換失敗' }, { status: 500 })
  }
}
