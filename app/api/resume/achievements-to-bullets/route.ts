import { NextRequest, NextResponse } from 'next/server'
import { callAI, isRateLimitError } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'

// 把「已確認的職涯成就」轉成履歷用的 XYZ 列點（達成了 X，用 Y 衡量，靠做 Z 完成）。
//
// 防幻覺：成就本身的 text/metric 在萃取時已逐字比對過日誌原文，這裡只做「措辭改寫」，
// 不得新增事實。程式端再驗一次——輸出裡出現的每個數字都必須在來源成就中找得到，
// 找不到就丟棄該條（與 extract-achievements 的數字驗證同一套規則）。
export const maxDuration = 60

interface VersionOut { label: string; bullets: string[] }

// 取出字串裡所有數字（含 15% / 3-5 / 90 這類），用於比對
function digitsOf(s: string): string[] {
  return (s.match(/\d+(?:\.\d+)?/g) ?? [])
}

export async function POST(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const { achievementIds, title, company, language } = await req.json() as {
      achievementIds: string[]; title?: string; company?: string; language?: string
    }
    if (!Array.isArray(achievementIds) || achievementIds.length === 0) {
      return NextResponse.json({ error: '請選擇要插入的成就' }, { status: 400 })
    }

    // 只信任資料庫裡真的屬於這位使用者、且已確認未刪除的成就
    const achievements = await prisma.careerAchievement.findMany({
      where: { id: { in: achievementIds }, userId, isConfirmed: true, isDismissed: false },
      select: { id: true, text: true, metric: true },
    })
    if (achievements.length === 0) {
      return NextResponse.json({ error: '找不到可用的成就' }, { status: 404 })
    }

    // 來源可用的數字池：輸出的數字必須出自這裡
    const allowedDigits = new Set(
      achievements.flatMap((a) => [...digitsOf(a.text), ...digitsOf(a.metric ?? '')]),
    )

    const langLabel = language === 'en' ? '英文' : '繁體中文'
    const sourceList = achievements
      .map((a, i) => `${i + 1}. ${a.text}${a.metric ? `（指標：${a.metric}）` : ''}`)
      .join('\n')

    const prompt = `你是專業履歷撰寫助手。以下是使用者已確認的工作成就，請改寫成履歷的工作描述列點。

職位：${title || '（未填寫）'}
公司：${company || '（未填寫）'}

已確認的成就（每一條都是使用者親自審核過的事實）：
${sourceList}

請用 Google 的 XYZ 寫法改寫：「達成了 X，用 Y 來衡量，靠做 Z 完成」——
也就是每一點都要講出「做了什麼、造成什麼結果、結果用什麼衡量」。

請提供 2 種版本，風格不同：
版本 1：強調數字與成果（有指標的優先把數字放在顯眼位置）
版本 2：強調做法與過程（說明怎麼做到的，數字作為佐證）

重要規則：
- 只能根據上面的成就改寫措辭，嚴禁新增任何成就中沒有的職責、情境或結果
- **嚴禁捏造或推算數字**：只能使用上面成就中原本就出現的數字，原文沒有數字的那一條，改寫後也不得出現數字
- 每點 1–2 句、以動詞開頭（主導／優化／降低／提升…）
- 每個版本的列點數量與來源成就數量相同（${achievements.length} 條）
- 所有文字使用${langLabel}

回傳純 JSON：
{"versions":[{"label":"強調數字成果","bullets":["...","..."]},{"label":"強調做法過程","bullets":["...","..."]}]}`

    const raw = await callAI(prompt)
    const parsed = extractJSON<{ versions?: VersionOut[] }>(raw)

    // 程式端驗證：丟掉任何含有來源沒有的數字的列點
    let dropped = 0
    const versions = (parsed.versions ?? [])
      .map((v) => ({
        label: String(v.label ?? ''),
        bullets: (v.bullets ?? []).filter((b) => {
          const ok = digitsOf(String(b)).every((d) => allowedDigits.has(d))
          if (!ok) dropped++
          return ok
        }).map((b) => String(b)),
      }))
      .filter((v) => v.bullets.length > 0)

    if (versions.length === 0) {
      return NextResponse.json({ error: '生成結果未通過數字驗證，請再試一次' }, { status: 422 })
    }

    return NextResponse.json({ versions, dropped })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[resume/achievements-to-bullets]', err)
    return NextResponse.json({ error: '轉換失敗，請稍後再試' }, { status: 500 })
  }
}
