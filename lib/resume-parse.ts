// 履歷檔案文字擷取共用邏輯（PDF/DOCX），供個人檔案庫匯入與 Resume Lab 上傳共用。

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
