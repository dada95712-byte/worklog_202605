# AI Career OS — 台灣職涯作業系統

以 AI 驅動的職涯規劃平台，專為台灣求職者設計。

## 功能模組

| 模組 | 路徑 | 功能 |
|------|------|------|
| 個人檔案庫 | `/profile-library` | 基本資料、學歷、經歷、技能等原始履歷素材管理 |
| Resume Lab | `/resume-lab` | PDF/DOCX 履歷解析、AI 從檔案庫生成通用/客製化履歷、評分 |
| 職缺配對 | `/jobs` | 台灣職缺搜尋、JD 比對分析、7 階段 Kanban 追蹤 |
| 技能庫 | `/dashboard/skills` | 技能新增/分類、AI 推薦與重新分類、日誌技能採用 |
| Skill Map | `/skill-map` | 技能分類總覽、日誌技能頻率、跨職缺技能落差分析 |
| Work Journal | `/work-journal` | STAR 格式工作日誌、AI 圖片辨識、面試素材萃取 |
| 面試準備 | `/interviews` | 模擬面試題生成、AI 答案評分、常見題庫 |
| AI 職涯教練 | `/career-coach` | 轉職、升職、求職策略問答 |
| 職涯情報 | `/analytics` | 薪資行情查詢、產業趨勢、求職儀表板 |

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
