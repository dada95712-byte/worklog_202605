# WorkLog

> 工作記錄・職涯累積・求職準備

**線上版本：** https://worklog-yahsinlin.vercel.app/

WorkLog 是一個整合職涯記錄與求職準備的工具。

多數求職工具只處理「這一次求職」——投完履歷就結束，下次得從頭再來。
WorkLog 的核心是工作日誌：使用者每天記錄工作成果，系統自動萃取技能與成就，
沉澱成可長期累積的職涯資料，需要求職時直接取用。

所有功能都在登入後使用，資料存在資料庫而非瀏覽器，換裝置不會遺失。

## 功能模組

八大模組分三層，工作記錄先累積，需要時再轉換成求職戰力，最後投出去追蹤與分析。

### 累積層——你的職涯資料在這裡長大

| 模組 | 路徑 | 功能 |
|------|------|------|
| 個人檔案庫 | `/profile-library` | 基本資訊／學歷／經歷／證照／語言等個人背景資料，上傳既有履歷可由 AI 解析填入，建立履歷時自動取用 |
| 工作日誌 | `/work-journal` | STAR／自由／AI 引導三種模式記錄，自動萃取技能與成就；確認後的成就可插入履歷與面試素材 |
| 技能地圖 | `/skill-map` | 技能分類全覽、日誌技能頻率、跨職缺技能缺口累積 |

### 轉換層——把累積轉成求職戰力

| 模組 | 路徑 | 功能 |
|------|------|------|
| 履歷 | `/resume-lab` | AI 從個人檔案庫生成通用／客製化履歷、ATS 評分、從已確認成就插入 XYZ 列點 |
| 面試練習 | `/interviews` | 情境化模擬面試題生成、AI 答案評分、雙語練習 |
| AI 職涯教練 | `/career-coach` | 轉職、升職、求職策略對話問答 |

### 出擊層——投出去、追蹤、分析

| 模組 | 路徑 | 功能 |
|------|------|------|
| 求職追蹤 | `/jobs` | 職缺整合、AI 匹配分析、Kanban 看板追蹤 |
| 職缺分析 | `/analytics` | 薪資行情查詢、產業趨勢、公司深度報告 |

### 其他頁面

| 頁面 | 路徑 | 說明 |
|------|------|------|
| Dashboard | `/dashboard` | 個人化任務清單、Career Score、各模組進度總覽（資料全部來自各模組實際內容） |
| 我的技能庫 | `/dashboard/skills` | 技能完整清單，含 AI 建議（待確認）與來源日誌 |

## 資料可信度設計

AI 會編造內容是已知的技術特性，杜絕它是開發者的責任，不是使用者該自行辨識的問題。
本專案的四層防護：

1. **資料來源**——能以搜尋取得的資料不交由 AI 生成
2. **Prompt**——明確禁止補充來源以外的內容
3. **程式端驗證**——逐字比對來源，驗證失敗的資料直接丟棄不寫入
4. **UI 標示**——標明每筆資料的來源類型（已驗證／JD 推測／一般推測）

實際落在功能上：

- **技能萃取**採雙軌驗證：工具與證照類逐字比對技能名稱；專業技能／核心職能／軟實力
  只能從固定字典挑選名稱，並比對 AI 附上的逐字證據句確實存在於日誌原文
- **成就萃取**每筆必附逐字摘錄，程式端確認摘錄存在於原文；有指標時另外驗證其中的
  數字確實出現在原文
- **成就轉履歷列點**時建立「來源數字池」，輸出中出現來源沒有的數字即丟棄該列點
- **技能與成就都需使用者確認**才會被履歷或面試素材引用；未確認的一律留在「待確認」
- **職涯洞察**（行為模式觀察）門檻更嚴：需 3 篇以上日誌佐證，任一篇比對失敗整條丟棄，
  且完全不參與履歷生成，避免污染履歷素材

技能與洞察都採「主檔 + 證據表」結構（`user_skills` + `skill_evidences`／
`career_insights` + `career_insight_evidences`），出現頻率一律由證據數計算，
每一筆都點得回原始日誌。

## 技術架構

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript
- **UI**: Tailwind CSS v4（`@theme` token 化的暖色設計系統）
- **Auth**: NextAuth.js v4（Google OAuth + Credentials），JWT session
- **AI**: OpenRouter（統一入口）— `openrouter/free`（主）/ `meta-llama/llama-3.3-70b-instruct:free`（備援）
- **DB**: PostgreSQL via Prisma 7（Neon serverless driver）— 32 個 model，全模組資料持久化
- **Storage**: Vercel Blob（日誌圖片、作品附件）
- **Deployment**: Vercel

## 本地開發

### 1. 安裝依賴

```bash
npm install
```

> `prisma generate` 已透過 `postinstall` 自動執行，不需手動跑。

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
| `DATABASE_URL` | PostgreSQL 連線字串（必填） | [Neon.tech](https://neon.tech) — 程式碼使用 Neon 專屬的 serverless driver（`@prisma/adapter-neon`），非標準 TCP 連線，暫不支援 Supabase 等其他 provider |
| `GOOGLE_CLIENT_ID` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | 同上 |
| `BLOB_READ_WRITE_TOKEN` | 圖片／附件儲存 | [Vercel Blob](https://vercel.com/docs/storage/vercel-blob)（本機未設定時自動降級為 base64） |
| `SERPER_API_KEY` | 職缺搜尋／公司分析網路搜尋 | [Serper.dev](https://serper.dev) |
| `JSEARCH_API_KEY` | 職缺搜尋 API | [RapidAPI JSearch](https://rapidapi.com/letscrape-6bfed1765d1a6/api/jsearch) |

> `OPENROUTER_API_KEY`、`NEXTAUTH_SECRET`、`DATABASE_URL` 皆為必填；
> 缺 `DATABASE_URL` 會導致所有模組無法儲存。

### 3. 套用資料庫 migration

```bash
npx prisma migrate deploy
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開啟 [http://localhost:3000](http://localhost:3000)

## 專案結構

```
app/
  api/              44 支 API 路由；除登入本身外，43 支全部經 requireAuth() 驗證
  (各模組頁面)/      profile-library, work-journal, skill-map,
                    resume-lab, interviews, career-coach, jobs, analytics
components/
  nav/              側邊欄、手機底部導覽、抽屜
  resume/           履歷編輯器與預覽
  onboarding/       首次使用提示（依實際資料狀態觸發）
  ui/               共用元件（含跨模組共用的 CompanyInput）
lib/
  ai-client.ts      OpenRouter 統一呼叫、failover、429 重試、逾時保護
  auth-guard.ts     requireAuth()，所有 API 路由的驗證入口
  skill-sync.ts     技能批次同步
  resume-parse.ts   PDF/DOCX 解析、亂碼偵測、品質重試
prisma/
  schema.prisma     32 個 model
  migrations/       10 份 migration
```

## AI Failover 機制

```
Request → OpenRouter: openrouter/free → [失敗] → OpenRouter: meta-llama/llama-3.3-70b-instruct:free
```

> 圖片辨識另用 `meta-llama/llama-3.2-11b-vision-instruct:free`。
> 所有模型皆透過同一個 `OPENROUTER_API_KEY` 呼叫（見 `lib/ai-client.ts`）。
>
> `openrouter/free` 是自動路由，實際會落到哪個免費模型不固定，品質也不穩定。
> 因此履歷解析等關鍵流程加上品質重試（結果太空就換一次呼叫），
> client 端亦設定 15 秒逾時避免卡住的請求拖垮整個 serverless function。

## 安全性

- 所有 API Key 透過環境變數注入，禁止 hardcode
- `.env*` 已加入 `.gitignore`（`.env.example` 例外放行，該檔不含任何值）
- NextAuth JWT session，7 天有效期
- API 路由除 `/api/auth/[...nextauth]`（登入本身）外全數經 `requireAuth()` 驗證，
  並以 session 的 `userId` 過濾資料，不接受前端傳來的使用者身分

## 已知限制

- `openrouter/free` 路由到的部分免費模型繁體中文能力不穩定，AI 輸出偶爾會混入
  簡體字；系統提示已要求繁體中文但擋不住，正解是在 `callAI` 回傳後加一層簡轉繁
- 部分 PDF（常見於某些線上履歷產生器）使用 Type3 自繪字形，沒有正確的字元對應表，
  文字擷取只能用猜的。系統會偵測並提示使用者手動檢查，但**無法從損毀的字形反推
  正確文字**
- 每人每日 AI 呼叫上限尚未實作，目前僅有並發數控管與單次 429 重試
