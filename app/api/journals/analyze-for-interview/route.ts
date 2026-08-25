import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { content } = await req.json()
    if (!content || typeof content !== 'string' || content.trim().length < 20) {
      return NextResponse.json({ error: '日誌內容不足' }, { status: 400 })
    }

    const prompt = `你是台灣職場面試專家。
請分析以下工作日誌，判斷可用於回答哪些常見面試題。

日誌內容：
<journal>${content.slice(0, 3000)}</journal>

任務一：從以下常見面試題清單中，選出最適合用此日誌回答的 3–5 題（只選真正相關的，不強求湊滿 5 題）：

01. 請自我介紹
02. 你最大的挑戰是什麼？如何克服？
03. 說說你帶領團隊的經驗
04. 你如何處理跨部門衝突？
05. 描述一個你解決困難問題的經驗
06. 你最大的成就是什麼？
07. 你如何在壓力下工作？
08. 說說你失敗的經驗，你學到什麼？
09. 你如何影響他人或推動改變？
10. 描述你展現領導力的經驗
11. 你如何管理多個優先任務？
12. 說說你與難相處同事合作的經驗
13. 你如何持續學習與成長？
14. 描述你推動創新或改善流程的經驗
15. 你為何適合這個職位？

任務二：針對每道選中的面試題，根據日誌原文生成 STAR 格式回答草稿。

STAR 格式規則：
- Situation：背景說明（1–2 句）
- Task：你的任務與責任（1–2 句）
- Action：你採取的具體行動（2–3 句，強調「你」做了什麼）
- Result：具體成果（必須包含原文中出現的數字，若原文無數字則描述質性成果）

重要規則：
- STAR 內容只能來自日誌原文，不得補充或虛構
- 原文沒有的數字一律不得出現
- 回傳純 JSON 格式，不含其他文字

{
  "matched_questions": [
    {
      "question_id": "02",
      "question_text": "你最大的挑戰是什麼？如何克服？",
      "relevance_reason": "此日誌描述了...（一句話說明相關性）",
      "star": {
        "situation": "...",
        "task": "...",
        "action": "...",
        "result": "..."
      }
    }
  ]
}`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Analyze for interview error:', err)
    return NextResponse.json({ error: '分析失敗，請再試一次' }, { status: 500 })
  }
}
