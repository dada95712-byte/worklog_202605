'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCommandPalette } from '@/contexts/command-palette'
import { cn } from '@/lib/utils'

const NAV = [
  { label: 'Dashboard',       href: '/dashboard',            icon: '⬡',  shortcut: 'G D' },
  { label: 'Resume Lab',      href: '/resume-lab',       icon: '◈',  shortcut: 'G R' },
  { label: 'Job Pipeline',    href: '/jobs',         icon: '◎',  shortcut: 'G J' },
  { label: 'Skill Map',       href: '/skill-map',        icon: '◈',  shortcut: 'G S' },
  { label: 'Interview Arena', href: '/interviews',       icon: '⬟',  shortcut: 'G I' },
  { label: 'Analytics',       href: '/analytics',  icon: '◉',  shortcut: 'G A' },
]

const ACTIONS = [
  { label: '上傳履歷',           href: '/resume-lab',       icon: '↑', tag: '履歷' },
  { label: '模擬面試',           href: '/interviews',       icon: '▶', tag: '面試' },
  { label: '搜尋職缺',           href: '/jobs',         icon: '🔍', tag: '職缺' },
  { label: '分析技能落差',       href: '/skill-map',        icon: '⚡', tag: '技能' },
  { label: '查詢薪資行情',       href: '/analytics',  icon: '💰', tag: '薪資' },
]

type Item = { label: string; href: string; icon: string; shortcut?: string; tag?: string }

export function CommandPalette() {
  const { open, closePalette } = useCommandPalette()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const all: Item[] = [...NAV, ...ACTIONS]
  const filtered = query
    ? all.filter((i) => i.label.toLowerCase().includes(query.toLowerCase()))
    : all

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closePalette()
        else { /* openPalette called by sidebar */ }
      }
      if (!open) return
      if (e.key === 'Escape') { closePalette(); setQuery('') }
      if (e.key === 'ArrowDown') setCursor((c) => (c + 1) % filtered.length)
      if (e.key === 'ArrowUp') setCursor((c) => (c - 1 + filtered.length) % filtered.length)
      if (e.key === 'Enter') {
        const item = filtered[cursor]
        if (item) { router.push(item.href); closePalette(); setQuery('') }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closePalette, cursor, filtered, router])

  // Focus input when open
  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 60); setCursor(0) }
    else setQuery('')
  }, [open])

  if (!open) return null

  function go(item: Item) {
    router.push(item.href)
    closePalette()
    setQuery('')
  }

  const navItems = filtered.filter((i) => NAV.some((n) => n.href === i.href && n.label === i.label))
  const actionItems = filtered.filter((i) => ACTIONS.some((a) => a.href === i.href && a.label === i.label))

  return (
    <div
      className="cmd-overlay fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-warm-300 bg-white overflow-hidden animate-fade-in-up"
        style={{ boxShadow: 'var(--shadow-warm-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-warm-200 px-4 py-3.5">
          <svg className="h-4 w-4 shrink-0 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-300 focus:outline-none"
            placeholder="搜尋功能或指令..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0) }}
          />
          <kbd className="hidden rounded border border-warm-200 px-1.5 py-0.5 text-[10px] text-ink-300 sm:block">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-72 overflow-y-auto p-2 bg-cream-50">
          {filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-ink-300">沒有找到相關指令</p>
          )}

          {!query && (
            <>
              <SectionLabel>快速動作</SectionLabel>
              {ACTIONS.map((item, i) => (
                <PaletteItem key={item.label} item={item} active={cursor === i} onClick={() => go(item)} />
              ))}
              <SectionLabel className="mt-2">頁面導航</SectionLabel>
              {NAV.map((item, i) => (
                <PaletteItem key={item.label} item={item} active={cursor === ACTIONS.length + i} onClick={() => go(item)} />
              ))}
            </>
          )}

          {query && filtered.map((item, i) => (
            <PaletteItem key={item.label} item={item} active={cursor === i} onClick={() => go(item)} />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-warm-100 bg-cream-100 px-4 py-2.5 flex items-center gap-4 text-[10px] text-ink-300">
          <span><kbd className="text-ink-200">↑↓</kbd> 選擇</span>
          <span><kbd className="text-ink-200">↵</kbd> 前往</span>
          <span><kbd className="text-ink-200">Esc</kbd> 關閉</span>
          <span className="ml-auto text-ink-200">⌘K</span>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-300', className)}>
      {children}
    </p>
  )
}

function PaletteItem({ item, active, onClick }: { item: Item; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-all duration-100',
        active ? 'bg-terra-500 text-white shadow-[var(--shadow-warm-sm)]' : 'text-ink-600 hover:bg-cream-200'
      )}
    >
      <span className={cn('text-base shrink-0', active ? 'text-white' : 'text-ink-300')}>{item.icon}</span>
      <span className="flex-1 font-medium">{item.label}</span>
      {item.tag && (
        <span className={cn('text-xs', active ? 'text-terra-100' : 'text-ink-300')}>{item.tag}</span>
      )}
      {item.shortcut && (
        <span className={cn('text-[10px] font-mono', active ? 'text-terra-100' : 'text-ink-200')}>
          {item.shortcut}
        </span>
      )}
    </button>
  )
}

/* ── Keyboard shortcut trigger (mount in layout) ─────────── */
export function CommandPaletteKeyboardShortcut() {
  const { open, openPalette, closePalette } = useCommandPalette()
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closePalette(); else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openPalette, closePalette])
  return null
}
