import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 把一篇工作日誌轉成面試素材（挑題 + STAR 草稿）。
//
// 同一篇日誌如果已經有「使用者親自確認過」的成就，就不該再從原文重跑一次——
// 那等於把已經人工把關過的結論丟掉，讓 AI 重新猜一遍，結果可能和成就卡片
// 不一致。有已確認成就時改以成就為事實基底，日誌原文退為補充脈絡（提供
// 情境與行動細節），Result 一律以成就的結論與指標為準。
export async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const { content, journalId } = await req.json() as { content?: string; journalId?: string }
    if (!content || typeof content !== 'string' || content.trim().length < 20) {
      return NextResponse.json({ error: '日誌內容不足' }, { status: 400 })
    }

    // 只認這篇日誌底下、屬於本人、已確認且未刪除的成就
    const achievements = journalId
      ? await prisma.careerAchievement.findMany({
          where: { journalId, userId, isConfirmed: true, isDismissed: false },
          select: { text: true, metric: true },
          orderBy: { createdAt: 'asc' },
        })
      : []

    const achievementBlock = achievements.length > 0
      ? `\n這篇日誌已經有 ${achievements.length} 條「使用者親自確認過」的成就，這些是已經人工把關過的事實：
<confirmed_achievements>
${achievements.map((a, i) => `${i + 1}. ${a.text}${a.metric ? `（衡量指標：${a.metric}）` : ''}`).join('\n')}
</confirmed_achievements>
`
      : ''

    const basisRules = achievements.length > 0
      ? `- **以上面的「已確認成就」為事實基底**：Result 必須是這些成就的結論與指標，不得改寫成不同的結果，也不得用日誌原文推導出成就裡沒有的成果
- 日誌原文只用來補充 Situation / Task / Action 的情境與做法細節
- 原文與成就沒有的數字一律不得出現；成就有指標的，Result 要把該指標寫進去`
      : `- STAR 內容只能來自日誌原文，不得補充或虛構
- 原文沒有的數字一律不得出現`

    const prompt = `你是台灣職場面試專家。
請分析以下工作日誌，判斷可用於回答哪些常見面試題。

日誌內容：
<journal>${content.slice(0, 3000)}</journal>
${achievementBlock}
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

任務二：針對每道選中的面試題，生成 STAR 格式回答草稿。

STAR 格式規則：
- Situation：背景說明（1–2 句）
- Task：你的任務與責任（1–2 句）
- Action：你採取的具體行動（2–3 句，強調「你」做了什麼）
- Result：具體成果（必須包含來源中出現的數字，若來源無數字則描述質性成果）

重要規則：
${basisRules}
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
    const result = extractJSON<Record<string, unknown>>(response)
    return NextResponse.json({ ...result, basedOnAchievements: achievements.length })
  } catch (err) {
    console.error('Analyze for interview error:', err)
    return NextResponse.json({ error: '分析失敗，請再試一次' }, { status: 500 })
  }
}
