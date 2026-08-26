# WorkLog
> 工作記錄・職涯累積・求職準備

WorkLog 是一個整合職涯記錄與求職準備的工具。

多數求職工具只處理「這一次求職」——投完履歷就結束，下次得從頭再來。
WorkLog 的核心是工作日誌：使用者每天記錄工作成果，系統自動萃取技能與成就，
沉澱成可長期累積的職涯資料，需要求職時直接取用。

## 功能模組

八大模組分三層，工作記錄先累積，需要時再轉換成求職戰力，最後投出去追蹤與分析。

### 累積層——你的職涯資料在這裡長大

| 模組 | 路徑 | 功能 |
|------|------|------|
| 工作日誌 | `/work-journal` | STAR／自由／AI 引導三種模式記錄，自動萃取技能與量化成就 |
| 個人檔案庫 | `/profile-library` | 職涯資料的唯一原始來源，履歷生成直接取用 |
| 技能地圖 | `/skill-map` | 技能分類全覽、日誌技能頻率、跨職缺技能缺口累積 |

### 轉換層——把累積轉成求職戰力

| 模組 | 路徑 | 功能 |
|------|------|------|
| 履歷 | `/resume-lab` | PDF/DOCX 履歷解析、AI 從檔案庫生成通用／客製化履歷、ATS 評分 |
| 面試練習 | `/interviews` | 情境化模擬面試題生成、AI 答案評分、雙語練習 |
| AI 教練 | `/career-coach` | 轉職、升職、求職策略對話問答 |

### 出擊層——投出去、追蹤、分析

| 模組 | 路徑 | 功能 |
|------|------|------|
| 求職追蹤 | `/jobs` | 職缺整合、AI 匹配分析、Kanban 看板追蹤 |
| 職缺分析 | `/analytics` | 薪資行情查詢、產業趨勢、公司深度報告 |

## 資料可信度設計

AI 產出的內容一律標示來源，並在程式端驗證：

1. 能以搜尋取得的資料不交由 AI 生成
2. Prompt 明確禁止補充來源以外的內容
3. 程式端逐字比對，驗證失敗的資料直接丟棄不寫入
4. UI 標示每筆資料的來源類型（已驗證／JD 推測／一般推測）

## 技術架構

- **Frontend**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4
- **Auth**: NextAuth.js v4 (Google OAuth + Email)
- **AI**: OpenRouter（統一入口）— `openrouter/free`（主）/ `meta-llama/llama-3.3-70b-instruct:free`（備援）
- **DB**: PostgreSQL via Prisma 7（Neon serverless driver，必填 — 個人檔案／履歷／技能／職缺追蹤／工作日誌皆持久化於此）
- **Deployment**: Vercel

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.example` 為 `.env.local` 並填入實際值：

```bash
cp .env.example .env.local
```

必要環境變數：

| 變數 | 說明 | 取得方式 |
|------|------|---------|
| `OPENROUTER_API_KEY` | OpenRouter API（AI 統一入口） | [OpenRouter Keys](https://openrouter.ai/keys) |
| `NEXTAUTH_SECRET` | Session 加密金鑰 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 部署網址 | `http://localhost:3000`（開發） |
| `GOOGLE_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | 同上 |
| `DATABASE_URL` | PostgreSQL 連線字串（必填） | [Neon.tech](https://neon.tech) — 程式碼使用 Neon 專屬的 serverless driver（`@prisma/adapter-neon`），非標準 TCP 連線，暫不支援 Supabase 等其他 provider |
| `JSEARCH_API_KEY` | 職缺搜尋 API | [RapidAPI JSearch](https://rapidapi.com/letscrape-6bfed1765d1a6/api/jsearch) |
| `SERPER_API_KEY` | 職缺搜尋備援 | [Serper.dev](https://serper.dev) |

> `OPENROUTER_API_KEY`、`NEXTAUTH_SECRET`、`DATABASE_URL` 皆為必填，缺 `DATABASE_URL` 會導致個人檔案／履歷／技能／職缺追蹤／工作日誌無法儲存。

### 3. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

### 4. 資料庫設定

```bash
# 設定 DATABASE_URL 後執行，套用所有 migration
npx prisma migrate deploy
```

> `prisma generate` 已透過 `postinstall` 在 `npm install` 後自動執行，不需手動跑。

## 部署到 Vercel

1. Push 到 GitHub
2. 在 Vercel 匯入專案
3. 設定所有環境變數
4. 部署後將 `NEXTAUTH_URL` 更新為實際網址

## AI Failover 機制

```
Request → OpenRouter: openrouter/free → [失敗] → OpenRouter: meta-llama/llama-3.3-70b-instruct:free
```

> 圖片辨識另用 `meta-llama/llama-3.2-11b-vision-instruct:free`。所有模型皆透過同一個 `OPENROUTER_API_KEY` 呼叫（見 `lib/ai-client.ts`）。

## 安全性

- 所有 API Key 透過環境變數注入，禁止 hardcode
- `.env*` 已加入 `.gitignore`
- NextAuth JWT session，7 天有效期
