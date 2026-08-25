import { NextRequest, NextResponse } from 'next/server'
import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'
import { requireAuth } from '@/lib/auth-guard'

const BREAKDOWN: Record<number, { behavioral: number; situational: number; technical: number; general: number }> = {
  10: { behavioral: 3, situational: 3, technical: 2, general: 2 },
  15: { behavioral: 5, situational: 4, technical: 3, general: 3 },
  20: { behavioral: 7, situational: 6, technical: 4, general: 3 },
}

// Scenario-specific prompt rules to reduce hallucination
const SCENARIO_RULES: Record<string, string> = {
  fresh_graduate: `
求職情境：應屆畢業生（無正式工作經驗）。
規則：
- 禁止出 "在你的工作中..." 或 "在你的職涯中..." 等預設有工作經驗的題目
- 改用「在你的學習/實習/專案中...」
- 可出 introduction、motivational、behavioral（以學校/社團/實習為背景）題型
- 避免 weakness 題超過 1 道
- suitable_for 必須包含 "fresh_graduate"`,

  career_change_same_industry: `
求職情境：同產業換職能（例如從 PM 轉 BD）。
規則：
- 著重「跨職能轉換動機」和「過去職能如何遷移至新職能」
- 至少 2 道 motivational 題（為什麼轉職能）
- 至少 2 道 behavioral 題（說明過去經驗如何幫助新職能）
- suitable_for 必須包含 "career_change_same_industry"`,

  career_change_cross_industry: `
求職情境：跨產業轉職。
規則：
- 著重「為何跨產業」「新產業的了解」「可遷移技能」
- 至少 2 道 motivational 題
- 至少 1 道 hypothetical 題（如何在新產業快速上手）
- 技術題應聚焦在可跨產業的通用技能，而非特定技術棧
- suitable_for 必須包含 "career_change_cross_industry"`,

  promotion_manager: `
求職情境：升遷管理職（首次或再次擔任管理角色）。
規則：
- 著重「領導力」「團隊管理」「衝突處理」「向上管理」
- 至少 3 道 behavioral 題（管理具體案例）
- 減少純技術題，增加情境判斷題（hypothetical）
- suitable_for 必須包含 "promotion_manager"`,

  returning: `
求職情境：職涯重啟（空窗後重返職場）。
規則：
- 著重「空窗期如何保持學習」「如何重新融入」「最新技能更新」
- 至少 1 道 weakness 題（誠實面對空窗的影響）
- 至少 1 道 motivational 題（為何現在重返）
- 禁止出「你最近在前公司的成就」等假設持續任職的題目
- suitable_for 必須包含 "returning"`,

  general: `
求職情境：一般求職（常規換工作）。
規則：
- 均衡出題，行為題、情境題、技術題、動機題各有涵蓋
- suitable_for 必須包含 "general"`,
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { role, company, questionCount = 15, jdContent, scenario = 'general' } = await req.json()
    if (!role) return NextResponse.json({ error: '請輸入目標職位' }, { status: 400 })

    const count = [10, 15, 20].includes(questionCount) ? questionCount : 15
    const b = BREAKDOWN[count]
    const scenarioRule = SCENARIO_RULES[scenario as string] ?? SCENARIO_RULES.general

    const jdSection = jdContent
      ? `\n以下是該職缺的完整職務說明，請根據此 JD 生成針對性面試題目：\n<jd_content>${String(jdContent).slice(0, 3000)}</jd_content>\n`
      : ''

    const prompt = `你是台灣資深人資顧問，請根據職位「${role}」${company ? `和公司「${company}」` : ''}，生成 ${count} 道面試題目。
${jdSection}
${scenarioRule}

題目分配（可依情境調整比例）：
- ${b.behavioral} 道行為面試題（behavioral）：請描述過去經驗，STAR 方法最佳
- ${b.situational} 道情境題（situational）：假設性情境，考察判斷與應變
- ${b.technical} 道職位專業題（technical）：考察「${role}」相關核心知識
- ${b.general} 道通用題（general）：動機、缺點、自我介紹等
- 必須包含 2-3 道 ai_related 題（詢問對 AI 工具、AI 趨勢的看法與實際使用經驗）

每道題同時提供繁體中文和英文版本。${company ? `\n請結合「${company}」的企業背景與文化出題。` : ''}

重要：question_type 由你根據題目性質判斷，suitable_for 依情境標記，framework 欄位留空（由程式端決定）。

只回傳如下 JSON，不要其他文字：
{
  "questions": [
    {
      "id": "q1",
      "question": "面試題目（繁體中文）",
      "questionEn": "Interview question (English)",
      "type": "behavioral",
      "question_type": "behavioral",
      "suitable_for": ["${scenario}", "general"]
    }
  ]
}

type 只能是：behavioral | situational | technical | general
question_type 只能是：behavioral | motivational | weakness | hypothetical | introduction | ai_related | general`

    const response = await callAI(prompt)
    const result = extractJSON(response)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Interview questions error:', err)
    return NextResponse.json({ error: '生成題目失敗，請再試一次' }, { status: 500 })
  }
}
