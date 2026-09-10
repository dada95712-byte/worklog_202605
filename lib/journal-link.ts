// 跨頁跳轉到某一篇工作日誌的共用機制。
//
// 技能地圖的來源卡片、成就卡片、職涯洞察證據……任何頁面要「點來源跳回原始日誌」
// 都走這支，不要各自組 query string：連結格式只定義在這裡一處，
// 工作日誌頁也只認這一個參數名，之後要改格式或改參數名只需要動這個檔案。

export const JOURNAL_ID_PARAM = 'journalId'

/** 產生指向某篇日誌詳情的連結，工作日誌頁讀到參數後會自動開啟該篇的詳細檢視 */
export function journalDetailHref(journalId: string) {
  return `/work-journal?${JOURNAL_ID_PARAM}=${encodeURIComponent(journalId)}`
}

/** 讀取網址上的目標日誌 id（僅瀏覽器端有效，伺服器端一律回 null） */
export function readJournalIdParam(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get(JOURNAL_ID_PARAM)
}
