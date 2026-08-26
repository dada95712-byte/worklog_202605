'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sidebar } from './sidebar'

const BOTTOM_NAV = [
  { href: '/dashboard',            icon: '🏠', label: 'Home' },
  { href: '/profile-library',      icon: '👤', label: '檔案庫' },
  { href: '/resume-lab',       icon: '📄', label: '履歷' },
  { href: '/jobs',         icon: '🎯', label: '職缺' },
  { href: '/skill-map',        icon: '🌱', label: '技能' },
  { href: '/interviews',       icon: '💬', label: '面試' },
  { href: '/analytics',  icon: '📊', label: '分析' },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Desktop sidebar (md+) ── */}
      <div className="hidden md:flex shrink-0">
        <Sidebar />
      </div>

      {/* ── Mobile drawer overlay ── */}
      <div
        className={`sidebar-overlay md:hidden ${drawerOpen ? 'open' : ''}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile drawer sidebar ── */}
      <div className={`sidebar-drawer md:hidden ${drawerOpen ? 'open' : ''}`}
        style={{ background: '#F3ECE4', borderRight: '1px solid #E6DDD2' }}>
        {/* Close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-warm-200">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-terra-500 text-white text-[11px] font-bold">W</div>
            <div>
              <p className="text-sm font-semibold text-ink-900 leading-none">WorkLog</p>
              <p className="text-[10px] text-ink-300 mt-0.5">工作記錄・職涯累積</p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="關閉選單"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-ink-400 hover:bg-warm-200 transition-colors text-lg"
          >
            ✕
          </button>
        </div>
        <Sidebar mobileDrawer />
      </div>

      {/* ── Mobile hamburger button ── */}
      <button
        className="md:hidden fixed top-3 left-3 z-[198] flex h-11 w-11 items-center justify-center rounded-xl bg-white border border-warm-200 shadow-[var(--shadow-warm-sm)] text-ink-600 text-lg"
        onClick={() => setDrawerOpen(true)}
        aria-label="開啟選單"
      >
        ☰
      </button>

      {/* Main scroll area */}
      <main className="flex-1 overflow-y-auto bg-cream-50 pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile bottom navigation ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-warm-200 bg-white"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {BOTTOM_NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center transition-colors min-h-[44px] ${
                active ? 'text-terra-600' : 'text-ink-400 hover:text-ink-600'
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className={`text-[9px] font-medium ${active ? 'text-terra-500' : ''}`}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
