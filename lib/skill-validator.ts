// 技能驗證共用邏輯 —— 正規化空白與全形/半形標點後逐字比對，不允許改寫內容本身。

const FULLWIDTH_TO_HALFWIDTH: Record<string, string> = {
  '，': ',', '。': '.', '、': ',', '「': '"', '」': '"', '『': '"', '』': '"',
  '（': '(', '）': ')', '：': ':', '；': ';', '！': '!', '？': '?',
  '　': ' ',
}

export function normalizeForCompare(text: string): string {
  let out = text
  for (const [full, half] of Object.entries(FULLWIDTH_TO_HALFWIDTH)) {
    out = out.split(full).join(half)
  }
  return out.toLowerCase().replace(/\s+/g, '')
}

// 顯性技能（工具與軟體、證照與認證）：技能名稱本身須逐字出現在日誌原文
export function validateVerbatimSkill(skillName: string, journalContent: string): boolean {
  if (!skillName?.trim()) return false
  return normalizeForCompare(journalContent).includes(normalizeForCompare(skillName))
}

// 隱性技能（專業技能、核心職能、軟實力）：evidence_excerpt 須是原文中存在的連續片段
export function validateEvidenceExcerpt(excerpt: string, journalContent: string): boolean {
  if (!excerpt?.trim()) return false
  return normalizeForCompare(journalContent).includes(normalizeForCompare(excerpt))
}
