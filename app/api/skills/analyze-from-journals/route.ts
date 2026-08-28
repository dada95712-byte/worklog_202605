import { callAI, isRateLimitError } from '@/lib/ai-client'
import { NextResponse } from 'next/server'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { buildSkillDictionary, isDictionarySkill, LITERAL_CATEGORIES } from '@/lib/skill-dictionary'
import { validateVerbatimSkill, validateEvidenceExcerpt } from '@/lib/skill-validator'

interface JournalIn {
  id: string
  title: string
  content?: string
  situation?: string
  task?: string
  action?: string
  result?: string
}

interface RawEvidence { journal_id: string; excerpt: string }
interface RawSkill {
  skill_name: string
  category: string
  source: string // 'verbatim' | 'evidence' | 'inference'
  evidence: RawEvidence[]
}

export async function POST(req: Request) {
  const { session, error: authError } = await requireAuth()
  if (authError) return authError
  const userId = session!.user.id as string

  try {
    const { journals } = await req.json() as { journals: JournalIn[] }
    if (!Array.isArray(journals) || journals.length === 0)
      return NextResponse.json({ error: '請提供日誌資料' }, { status: 400 })

    // 只信任真的屬於這位使用者的日誌 —— 不管client送了什麼id，一律以DB查詢結果為準
    const journalIds = journals.map((j) => j.id)
    const ownedJournals = await prisma.workJournal.findMany({
      where: { id: { in: journalIds }, userId },
    })
    const journalMap = new Map(ownedJournals.map((j) => [
      j.id,
      [j.title, j.content, j.situation, j.task, j.action, j.result].filter(Boolean).join('\n'),
    ]))
    if (journalMap.size === 0)
      return NextResponse.json({ error: '找不到有效的日誌資料' }, { status: 400 })

    // 使用者在個人檔案庫自訂的技能，動態併入字典
    const customSkills = await prisma.userSkill.findMany({
      where: { userId, isManual: true },
      select: { skillName: true, category: true },
    })
    const dictionary = buildSkillDictionary(customSkills)

    const journalText = [...journalMap.entries()]
      .map(([id, text]) => `[journal_id: ${id}]\n${text}`)
      .join('\n\n---\n\n')

    const prompt = `你的任務是從工作日誌中辨識使用者展現的技能。

【技能字典】
專業技能：${dictionary.專業技能.join('、')}
核心職能：${dictionary.核心職能.join('、')}
軟實力：${dictionary.軟實力.join('、')}

【規則】
1. 專業技能、核心職能、軟實力：只能從技能字典中挑選，不得自行發明名稱
2. 工具與軟體、證照與認證：直接從原文擷取專有名詞，必須逐字出現在日誌中
3. 每個技能都必須附 evidence，每筆包含 journal_id 與 excerpt，excerpt 逐字引用日誌原文中支持該技能的句子
4. excerpt 必須是原文的連續片段，不得改寫、不得拼接不相鄰的句子
5. 找不到明確證據的技能，不要輸出
6. 單一日誌就能佐證的技能，source 標記為 "verbatim"（工具/證照類）或 "evidence"（字典類）
7. 只有當同一個技能在兩篇以上不同日誌都有獨立證據時，才把 source 標記為 "inference"，並列出全部來源日誌

【跨日誌推論】
可以辨識多篇日誌之間的行為模式，但：
- 必須列出至少 2 篇來源日誌，每篇各自附 excerpt
- 某篇找不到可引用的證據句，該篇不列入來源；剩餘少於 2 篇則不輸出
- source 標記為 "inference"

【禁止】
- 禁止推論使用者「可能具備」的技能
- 禁止因為職稱或產業，就假設使用者具備相關技能
- 禁止輸出字典以外的技能名稱（工具與軟體、證照與認證除外）
- 禁止用單篇日誌做 inference 推論
- 禁止輸出「潛在能力」「可培養的技能」這類尚未發生的內容
- 寧可少輸出，不可輸出無法驗證的內容

日誌內容：
${journalText.slice(0, 8000)}

請只回覆以下格式的 JSON，不要任何說明文字：
{
  "skills": [
    {
      "skill_name": "跨部門協調",
      "category": "核心職能",
      "source": "evidence",
      "evidence": [
        { "journal_id": "xxx", "excerpt": "逐字引用的原文片段" }
      ]
    }
  ]
}`

    const raw = await callAI(prompt, '你是嚴謹的技能萃取工具，只根據明確證據輸出，寧缺勿濫，用繁體中文回答。')
    const parsed = extractJSON<{ skills?: RawSkill[] }>(raw)
    const rawSkills = parsed?.skills ?? []

    let passed = 0
    let rejected = 0
    const savedSkills: { skillName: string; category: string; source: string }[] = []

    for (const s of rawSkills) {
      const skillName = (s.skill_name ?? '').trim()
      const evidenceList = Array.isArray(s.evidence) ? s.evidence : []
      if (!skillName || evidenceList.length === 0) { rejected++; continue }

      const isLiteralCategory = (LITERAL_CATEGORIES as readonly string[]).includes(s.category)
      const dictCategory = isDictionarySkill(skillName, dictionary)

      if (isLiteralCategory) {
        // 顯性技能：skill_name 本身必須逐字出現在其中一篇引用的日誌原文
        const validEvidence = evidenceList.filter((e) => {
          const content = journalMap.get(e.journal_id)
          return content && validateVerbatimSkill(skillName, content)
        })
        if (validEvidence.length === 0) { rejected++; continue }
        await upsertSkill(userId, skillName, s.category, 'verbatim', true, validEvidence, journalMap)
        passed++
        savedSkills.push({ skillName, category: s.category, source: 'verbatim' })
        continue
      }

      if (!dictCategory) { rejected++; continue } // 不在字典裡的隱性技能，直接丟棄

      const claimedInference = s.source === 'inference' || evidenceList.length >= 2

      if (claimedInference) {
        // 跨日誌推論：至少2篇，任何一篇比對失敗就整筆丟棄
        if (evidenceList.length < 2) { rejected++; continue }
        const allValid = evidenceList.every((e) => {
          const content = journalMap.get(e.journal_id)
          return content && validateEvidenceExcerpt(e.excerpt, content)
        })
        if (!allValid) { rejected++; continue }
        await upsertSkill(userId, skillName, dictCategory, 'inference', false, evidenceList, journalMap)
        passed++
        savedSkills.push({ skillName, category: dictCategory, source: 'inference' })
      } else {
        // 單篇證據：驗證失敗的個別evidence先濾掉，全部失敗才丟棄整個技能
        const validEvidence = evidenceList.filter((e) => {
          const content = journalMap.get(e.journal_id)
          return content && validateEvidenceExcerpt(e.excerpt, content)
        })
        if (validEvidence.length === 0) { rejected++; continue }
        await upsertSkill(userId, skillName, dictCategory, 'evidence', true, validEvidence, journalMap)
        passed++
        savedSkills.push({ skillName, category: dictCategory, source: 'evidence' })
      }
    }

    return NextResponse.json({ passed, rejected, total: rawSkills.length, skills: savedSkills })
  } catch (err) {
    if (isRateLimitError(err)) {
      return NextResponse.json({ error: 'rate_limit', message: 'AI 服務目前使用量較高，請稍後再試' }, { status: 429 })
    }
    console.error('[skills/analyze-from-journals]', err)
    return NextResponse.json({ error: '分析失敗，請稍後再試' }, { status: 500 })
  }
}

async function upsertSkill(
  userId: string,
  skillName: string,
  category: string,
  source: 'verbatim' | 'evidence' | 'inference',
  autoConfirm: boolean,
  evidence: RawEvidence[],
  journalMap: Map<string, string>,
) {
  const skill = await prisma.userSkill.upsert({
    where: { userId_skillName: { userId, skillName } },
    update: {
      // 已經是 manual 或已確認的技能不要被 AI 結果降級；否則採用這次的分類/來源判斷
      source,
      category,
    },
    create: { userId, skillName, category, source, isManual: false, isConfirmed: autoConfirm },
  })

  // inference 技能永遠不自動確認；其餘尊重既有的 isConfirmed（若使用者已手動確認過，不要被覆蓋回去）
  if (source === 'inference') {
    await prisma.userSkill.update({ where: { id: skill.id }, data: { isConfirmed: false } })
  } else if (autoConfirm && !skill.isConfirmed) {
    await prisma.userSkill.update({ where: { id: skill.id }, data: { isConfirmed: true } })
  }

  for (const e of evidence) {
    if (!journalMap.has(e.journal_id)) continue
    await prisma.skillEvidence.upsert({
      where: { skillId_journalId: { skillId: skill.id, journalId: e.journal_id } },
      update: { evidenceExcerpt: e.excerpt },
      create: { userId, skillId: skill.id, journalId: e.journal_id, evidenceExcerpt: e.excerpt },
    })
  }
}
