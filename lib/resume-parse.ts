// 履歷檔案文字擷取共用邏輯（PDF/DOCX），供個人檔案庫匯入與 Resume Lab 上傳共用。

import { callAI } from '@/lib/ai-client'
import { extractJSON } from '@/lib/extract-json'

export async function parsePDF(buffer: Buffer): Promise<string> {
  const PDFParser = (await import('pdf2json')).default
  return new Promise((resolve, reject) => {
    const parser = new PDFParser()
    parser.on('pdfParser_dataReady', (pdfData: { Pages: { Texts: { R: { T: string }[] }[] }[] }) => {
      const text = pdfData.Pages
        .flatMap((p) => p.Texts)
        .map((t) => decodeURIComponent(t.R.map((r) => r.T).join('')))
        .join(' ')
      resolve(text)
    })
    parser.on('pdfParser_dataError', reject)
    parser.parseBuffer(buffer)
  })
}

export async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

// 部分 PDF（常見於某些線上履歷產生器/列印為PDF流程）用 Type3 自繪字形嵌入英文字母與數字，
// 沒有正確的字元對應表，文字擷取工具（不論 pdf2json 或其他基於 pdf.js 的套件）只能猜測，
// 猜錯就會產生方塊/箭頭等符號。中文字通常不受影響（走的是有正確對應表的標準字型）。
// 這裡不嘗試修復內容本身（無法從損毀的字形反推正確文字），只負責偵測，讓上層決定如何處理。
const GARBLED_GLYPH_PATTERN = /[■-◿←-⇿]/g

export function detectGarbledText(text: string): boolean {
  const matches = text.match(GARBLED_GLYPH_PATTERN)
  return (matches?.length ?? 0) >= 3
}

// openrouter/free 會自動路由到品質差異很大的免費模型：實測對同一份履歷連續呼叫 10 次，
// 拿到完整結果的只有 4 次，3 次直接回傳空白，1 次明顯抓漏（學歷 0 筆），1 次甚至被路由到
// 內容安全分類模型（只回「User Safety: safe」，根本沒做解析）。這些情況都不會觸發
// ai-client.ts 既有的 429/空白重試機制——因為回應本身是「有效但太糟」的 JSON，不是真的失敗。
// 這裡另外加一層「結果太空就重試」的判斷：換一次呼叫，路由通常會換到不同模型，
// 實測 3 次內幾乎都能拿到可用結果。
export async function callAIWithQualityRetry<T>(
  prompt: string,
  isGoodEnough: (parsed: T) => boolean,
  maxAttempts = 2,
): Promise<T> {
  let lastParsed: T | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const raw = await callAI(prompt)
      const parsed = extractJSON<T>(raw)
      if (isGoodEnough(parsed)) return parsed
      lastParsed = parsed
    } catch {
      // 這次沒解析出有效 JSON（例如整個回應根本不是 JSON），換下一次嘗試
    }
  }
  if (lastParsed) return lastParsed
  throw new Error('AI 多次嘗試後仍無法解析出有效內容，請稍後再試')
}
