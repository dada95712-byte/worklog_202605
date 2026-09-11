'use client'

import { useEffect, useRef, useState } from 'react'

// 公司名稱輸入框——工作日誌與個人檔案庫（工作經歷／實習）共用這一個元件。
//
// 重點不是樣式，而是「兩邊吃同一份清單」：只要使用者是從下拉挑的，兩處存下來的
// 就是完全相同的字串，跨模組比對（例如把職涯成就插進對應的工作經歷）才能用
// 精確比對，而不是猜「拓宇資訊」和「拓宇資訊股份有限公司」是不是同一家。
//
// 清單以模組層級快取，避免個人檔案庫同時渲染多筆工作經歷時重複打 API；
// 新增公司後呼叫 invalidateCompanyCache() 讓下次重新抓。

let cache: string[] | null = null
let inflight: Promise<string[]> | null = null

export function invalidateCompanyCache() { cache = null; inflight = null }

async function loadCompanies(): Promise<string[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch('/api/companies')
      .then((r) => (r.ok ? r.json() : { companies: [] }))
      .then((d) => { cache = d.companies ?? []; return cache! })
      .catch(() => [])
      .finally(() => { inflight = null })
  }
  return inflight
}

interface CompanyInputProps {
  value: string
  onChange: (v: string) => void
  className?: string
  placeholder?: string
  id?: string
}

export function CompanyInput({ value, onChange, className, placeholder = '公司名稱', id }: CompanyInputProps) {
  const [companies, setCompanies] = useState<string[]>(cache ?? [])
  const [open, setOpen] = useState(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    let alive = true
    loadCompanies().then((list) => { if (alive) setCompanies(list) })
    return () => { alive = false; clearTimeout(blurTimer.current) }
  }, [])

  const q = value.trim().toLowerCase()
  // 已經完全吻合就不用再提示
  const matches = companies
    .filter((c) => c.toLowerCase() !== q && (!q || c.toLowerCase().includes(q)))
    .slice(0, 6)

  return (
    <div className="relative">
      <input
        id={id}
        className={className}
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-warm-200 bg-white shadow-lg">
          {matches.map((c) => (
            <button
              key={c}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onChange(c); setOpen(false) }}
              className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-cream-100 transition-colors"
            >
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
