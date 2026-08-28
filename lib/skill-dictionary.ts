// 技能字典 —— 專業技能／核心職能／軟實力這三類，AI 只能從字典挑選，不得自行發明名稱。
// 工具與軟體、證照與認證不設字典，走嚴格逐字比對，日誌寫什麼就抓什麼。
export const SKILL_DICTIONARY = {
  專業技能: [
    '需求訪談', '需求分析', '規格撰寫', '專案規劃', '時程管理', '範圍管理',
    '風險管理', '變更管理', '驗收管理', '成本估算', '資料分析', '報表製作',
    '流程設計', '品質管理', '供應鏈管理', '合約管理', '標案作業', '產品規劃',
  ],
  核心職能: [
    '問題分析', '跨部門協調', '資源調度', '優先順序判斷', '進度追蹤', '會議主持',
    '文件管理', '決策支援', '供應商管理', '客戶關係管理', '教育訓練規劃',
    '流程改善', '稽核與盤點',
  ],
  軟實力: [
    '溝通表達', '傾聽理解', '衝突處理', '談判協商', '向上管理', '團隊合作',
    '抗壓能力', '主動積極', '自主學習', '細心謹慎', '同理心', '跨文化溝通',
  ],
} as const

export type DictionaryCategory = keyof typeof SKILL_DICTIONARY

export const DICTIONARY_CATEGORIES = Object.keys(SKILL_DICTIONARY) as DictionaryCategory[]

// 顯性技能（不設字典，逐字比對）
export const LITERAL_CATEGORIES = ['工具與軟體', '證照與認證'] as const

// 把使用者在個人檔案庫自訂的技能動態併入字典，下次萃取時 AI 可選用
export function buildSkillDictionary(customSkills: { skillName: string; category: string }[]) {
  const dict: Record<string, string[]> = {
    專業技能: [...SKILL_DICTIONARY.專業技能],
    核心職能: [...SKILL_DICTIONARY.核心職能],
    軟實力: [...SKILL_DICTIONARY.軟實力],
  }
  for (const s of customSkills) {
    if (!(s.category in dict)) continue
    if (!dict[s.category].includes(s.skillName)) dict[s.category].push(s.skillName)
  }
  return dict
}

export function isDictionarySkill(name: string, dict: Record<string, string[]>): DictionaryCategory | null {
  for (const cat of DICTIONARY_CATEGORIES) {
    if (dict[cat]?.includes(name)) return cat
  }
  return null
}
