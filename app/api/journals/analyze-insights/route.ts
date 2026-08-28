import { callAI, isRateLimitError } from '@/lib/ai-client'
import { NextRequest, NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { validateEvidenceExcerpt } from '@/lib/skill-validator'

const MIN_EVIDENCE = 3
const MAX_INSIGHTS_PER_RUN = 3

interface RawEvidence { journal_id: string; excerpt: string }
interface RawInsight { insight_text: string; evidence: RawEvidence[] }

// 粗略擋掉「人格特質／能力評價」型的輸出，跟 prompt 端的禁止規則做雙重防護
const PERSONALITY_TRAIT_PATTERNS = [
  /你是(一)?個?.{0,12}的人/,
  /你(很|非常|十分|相當).{0,10}(責任感|耐心|細心|認真|聰明|善良|積極|負責|靠譜)/,
  /你(具備|擁有).{0,10}(特質|人格|個性)/,
  /(做得很好|做得不錯|這是很難得的能力|你很適合|你應該往|你適合往)/,
]
function looksLikePersonalityTrait(text: string): boolean {
  return PERSONALITY_TRAIT_PATTERNS.some((re) => re.test(text))
}

function evidenceKey(journalIds: string[]): string {
  return [...new Set(journalIds)].sort().join('|')
}

export async function POST() {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const journals = await prisma.workJournal.findMany({ where: { userId } })
    if (journals.length < MIN_EVIDENCE) {
      return NextResponse.json({ error: 'insufficient_journals', message: '日誌篇數還不夠，累積更多再試試' }, { status: 400 })
    }

    const journalMap = new Map(journals.map((j) => [
      j.id,
      [j.title, j.content, j.situation, j.task, j.action, j.result].filter(Boolean).join('\n'),
    ]))

    // 已忽略過的洞察，用「來源日誌組合」當作識別，重新分析時同一組合不再產生
    const dismissed = await prisma.careerInsight.findMany({
      where: { userId, isDismissed: true },
      include: { evidence: { select: { journalId: true } } },
    })
    const dismissedKeys = new Set(dismissed.map((d) => evidenceKey(d.evidence.map((e) => e.journalId))))

    const journalText = [...journalMap.entries()]
      .map(([id, text]) => `[journal_id: ${id}]\n${text}`)
      .join('\n\n---\n\n')

    const prompt = `你的任務是分析使用者的多篇工作日誌，找出重複出現的行為模式。

【什麼是行為模式】
使用者在不同情境下反覆採取的做法。例如「遇到分歧時，先確認各方掌握的
資訊落差，而不是先談立場」——這是一個做法，不是一個特質。

【規則】
1. 每一條洞察必須有至少 ${MIN_EVIDENCE} 篇來源日誌支持
2. 每一篇來源都要附 evidence，包含 journal_id 與 excerpt，excerpt 逐字引用該篇日誌原文
3. excerpt 必須是原文的連續片段，不得改寫、不得拼接不相鄰的句子
4. 洞察文字必須描述「做法」，並明確指出這個做法重複出現在哪些情境
5. 找不到 ${MIN_EVIDENCE} 篇以上證據的模式，不要輸出
6. 一次最多輸出 ${MAX_INSIGHTS_PER_RUN} 條洞察，寧缺勿濫

【禁止】
- 禁止描述人格特質（「你是個細心的人」「你很有責任感」）——只能描述可觀察的做法，不能推論性格
- 禁止心理分析、能力評價、優缺點總結
- 禁止使用日誌以外的資訊（職稱、產業、公司名都不可作為推論依據）
- 禁止輸出鼓勵性或評價性的語句（「你做得很好」「這是很難得的能力」）
- 禁止推測使用者「適合」什麼職位或「應該」往哪個方向發展
- 證據不足 ${MIN_EVIDENCE} 篇時，寧可不輸出，不可放寬標準

日誌內容：
${journalText.slice(0, 10000)}

請只回覆以下格式的 JSON，不要任何說明文字：
{
  "insights": [
    {
      "insight_text": "描述做法的句子，並指出重複出現在哪些情境",
      "evidence": [
        { "journal_id": "xxx", "excerpt": "逐字引用的原文片段" }
      ]
    }
  ]
}`

    const raw = await callAI(prompt, '你是嚴謹的職涯行為分析工具，只描述可觀察的做法，不做人格或能力評價，用繁體中文回答。')
    const parsed = extractJSON<{ insights?: RawInsight[] }>(raw)
    const rawInsights = (parsed?.insights ?? []).slice(0, MAX_INSIGHTS_PER_RUN)

    let passed = 0
    let rejected = 0
    const savedInsights: { insightText: string; evidenceCount: number }[] = []

    for (const ins of rawInsights) {
      const text = (ins.insight_text ?? '').trim()
      const evidenceList = Array.isArray(ins.evidence) ? ins.evidence : []

      if (!text) { rejected++; continue }
      if (looksLikePersonalityTrait(text)) { rejected++; continue }
      if (evidenceList.length < MIN_EVIDENCE) { rejected++; continue }

      // 任一筆比對失敗，整條丟棄（不允許部分保留）
      const allValid = evidenceList.every((e) => {
        const content = journalMap.get(e.journal_id)
        return content && validateEvidenceExcerpt(e.excerpt, content)
      })
      if (!allValid) { rejected++; continue }

      const journalIds = evidenceList.map((e) => e.journal_id)
      const key = evidenceKey(journalIds)
      if (dismissedKeys.has(key)) { rejected++; continue } // 使用者已忽略過同一組來源，不再產生

      // 用「來源日誌組合」找既有洞察來 upsert，同一組合更新內容而不是無限新增
      const existing = await prisma.careerInsight.findFirst({
        where: { userId, isDismissed: false, evidence: { some: { journalId: { in: journalIds } } } },
        include: { evidence: true },
      })
      const existingKey = existing ? evidenceKey(existing.evidence.map((e) => e.journalId)) : null

      const insight = existingKey === key && existing
        ? await prisma.careerInsight.update({ where: { id: existing.id }, data: { insightText: text } })
        : await prisma.careerInsight.create({ data: { userId, insightText: text, isConfirmed: false } })

      for (const e of evidenceList) {
        if (!journalMap.has(e.journal_id)) continue
        await prisma.careerInsightEvidence.upsert({
          where: { insightId_journalId: { insightId: insight.id, journalId: e.journal_id } },
          update: { evidenceExcerpt: e.excerpt },
          create: { userId, insightId: insight.id, journalId: e.journal_id, evidenceExcerpt: e.excerpt },
        })
      }

      passed++
      savedInsights.push({ insightText: text, evidenceCount: evidenceList.length })
    }

    return NextResponse.json({ passed, rejected, total: rawInsights.length, insights: savedInsights })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[journals/analyze-insights]', err)
    return NextResponse.json({ error: '分析失敗，請稍後再試' }, { status: 500 })
  }
}

// 讀取目前的洞察清單（含已確認、待確認；不含已忽略）
export async function GET() {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const insights = await prisma.careerInsight.findMany({
    where: { userId, isDismissed: false },
    orderBy: { createdAt: 'desc' },
    include: {
      evidence: {
        include: { journal: { select: { id: true, title: true, date: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return NextResponse.json({
    insights: insights.map((i) => ({
      id: i.id,
      text: i.insightText,
      isConfirmed: i.isConfirmed,
      evidenceCount: i.evidence.length,
      evidence: i.evidence.map((e) => ({
        journalId: e.journalId,
        journalTitle: e.journal?.title ?? '',
        journalDate: e.journal?.date ?? null,
        excerpt: e.evidenceExcerpt,
      })),
    })),
  })
}

// 確認（is_confirmed=true）或忽略（is_dismissed=true）一條洞察
export async function PATCH(req: NextRequest) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  const { id, action } = await req.json() as { id: string; action: 'confirm' | 'dismiss' }
  if (!id || (action !== 'confirm' && action !== 'dismiss')) {
    return NextResponse.json({ error: '缺少 id 或 action' }, { status: 400 })
  }

  const owns = await prisma.careerInsight.findFirst({ where: { id, userId }, select: { id: true } })
  if (!owns) return NextResponse.json({ error: '找不到這條洞察' }, { status: 404 })

  const updated = await prisma.careerInsight.update({
    where: { id },
    data: action === 'confirm' ? { isConfirmed: true } : { isDismissed: true },
  })
  return NextResponse.json({ id: updated.id, isConfirmed: updated.isConfirmed, isDismissed: updated.isDismissed })
}
