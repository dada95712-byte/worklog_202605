import Link from 'next/link'

const LAYERS = [
  {
    layer: '累積',
    desc: '每天記錄工作成果，系統自動萃取技能與成就，累積成只屬於你的職涯資料庫。',
    color: 'bg-terra-50 border-terra-100',
    items: [
      { emoji: '📓', title: '工作日誌',   href: '/work-journal',    sub: 'STAR／自由／AI 引導記錄 · 自動萃取技能與成就' },
      { emoji: '🗂️', title: '個人檔案庫', href: '/profile-library', sub: '職涯資料的唯一來源 · 履歷自動取用' },
      { emoji: '🌱', title: '技能地圖',   href: '/skill-map',       sub: '技能分類全覽 · 日誌技能頻率 · 缺口累積' },
    ],
  },
  {
    layer: '轉換',
    desc: '需要求職時，履歷與面試素材直接從你的累積生成，不必從零開始回想。',
    color: 'bg-sage-50 border-sage-100',
    items: [
      { emoji: '📄', title: '履歷',     href: '/resume-lab',   sub: 'AI 解析履歷 · ATS 評分 · 關鍵字優化' },
      { emoji: '💬', title: '面試練習', href: '/interviews',   sub: 'AI 模擬面試 · STAR 評分 · 雙語練習' },
      { emoji: '🤖', title: 'AI 教練',  href: '/career-coach', sub: '24hr 對話教練 · 個人化職涯建議' },
    ],
  },
  {
    layer: '出擊',
    desc: '管理每一個應徵中的職缺，追蹤進度，分析公司與薪資行情。',
    color: 'bg-cream-200 border-warm-200',
    items: [
      { emoji: '🎯', title: '求職追蹤', href: '/jobs',      sub: '職缺整合 · AI 匹配分析 · Kanban 看板' },
      { emoji: '📊', title: '職缺分析', href: '/analytics', sub: '薪資行情 · 產業趨勢 · 公司深度報告' },
    ],
  },
]

function LayerConnector() {
  return (
    <div className="flex flex-col items-center py-2" aria-hidden="true">
      <div className="h-8 w-px bg-warm-300" />
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-warm-300">
        <path d="M8 2v10M3 8l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-cream-100">

      {/* Header */}
      <header className="sticky top-0 z-40 glass-warm border-b border-warm-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-terra-500 text-white text-[11px] font-bold shadow-[var(--shadow-warm-sm)]">W</div>
            <span className="font-semibold text-ink-900 tracking-tight">WorkLog</span>
            <span className="hidden text-xs text-ink-300 sm:block">· 工作記錄・職涯累積・求職準備</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/auth/signin" className="text-sm text-ink-400 hover:text-ink-700 transition-colors">登入</Link>
            <Link href="/onboarding" className="rounded-lg bg-terra-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
              開始使用
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-5 text-4xl font-bold leading-snug tracking-tight text-ink-900 sm:text-5xl">
            讓每天的工作
            <br />
            <span className="text-terra-500">變成下一次機會</span>
          </h1>
          <p className="mb-10 text-base text-ink-400 max-w-xl mx-auto leading-relaxed">
            記錄你每天的工作成果，AI 自動整理成你的技能庫、履歷素材與面試故事。<br className="hidden sm:block"/>
            需要求職時，你已經準備好了。
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/onboarding"
              className="w-full sm:w-auto rounded-xl bg-terra-500 px-8 py-3.5 text-base font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-md)]">
              開始使用 →
            </Link>
            <Link href="/dashboard"
              className="w-full sm:w-auto rounded-xl border border-warm-300 bg-white px-8 py-3.5 text-base font-semibold text-ink-600 hover:bg-cream-200 hover:border-warm-400 transition-all shadow-[var(--shadow-warm-xs)]">
              進入 Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-2 text-center text-2xl font-bold text-ink-900 tracking-tight">你的職涯，分三層長大</h2>
          <p className="mb-12 text-center text-sm text-ink-400">從記錄開始，到投遞結束——每一層都接得起來。</p>

          {LAYERS.map((layer, i) => (
            <div key={layer.layer}>
              <div className="mb-1 flex items-center justify-center gap-2">
                <span className="text-xs font-bold tracking-[0.2em] text-terra-500">{layer.layer}</span>
              </div>
              <p className="mb-5 text-center text-sm text-ink-400 max-w-md mx-auto leading-relaxed">{layer.desc}</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {layer.items.map((item) => (
                  <Link key={item.title} href={item.href}
                    className={`rounded-2xl border p-5 ${layer.color} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-warm-md)]`}>
                    <div className="mb-3 text-2xl">{item.emoji}</div>
                    <h3 className="mb-1 font-semibold text-ink-800">{item.title}</h3>
                    <p className="text-xs text-ink-400 leading-relaxed">{item.sub}</p>
                  </Link>
                ))}
              </div>
              {i < LAYERS.length - 1 && <LayerConnector />}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-warm-200 px-6 py-8 text-center">
        <p className="text-xs text-ink-300">
          © 2026 WorkLog · 工作記錄・職涯累積・求職準備
        </p>
      </footer>
    </div>
  )
}
