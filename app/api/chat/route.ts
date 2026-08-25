import { NextRequest, NextResponse } from 'next/server'
import { callAIChat } from '@/lib/ai-client'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { messages, context } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: '缺少對話內容' }, { status: 400 })
    }

    const systemPrompt = `你是一位專業的台灣職涯教練，具備豐富的台灣就業市場知識。

你的特點：
- 了解台灣主要求職平台（104、1111、Yourator、Cake.me、LinkedIn）
- 熟悉台灣職場文化、薪資行情和勞動法規
- 擅長提供實際可執行的職涯建議
- 用溫暖、鼓勵的語氣與求職者溝通
- 主動詢問求職者的具體情況，給出個人化建議

當討論職涯話題時，請：
1. 先理解求職者的具體情況
2. 提供台灣市場的實際建議
3. 給出清楚的行動步驟
4. 用繁體中文回答，語氣親切

${context === 'career_coach' ? '你正在擔任職涯教練角色，請聚焦在職涯規劃、求職策略和職場發展建議。' : ''}`

    const reply = await callAIChat(messages, systemPrompt)
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Chat error:', err)
    return NextResponse.json({ error: 'AI 回應失敗，請稍後再試' }, { status: 500 })
  }
}
