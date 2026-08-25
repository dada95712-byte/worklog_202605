'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PageTooltip } from '@/components/onboarding/page-tooltip'

// ── Types ──────────────────────────────────────────────────────────────────────

const SKILL_CATEGORIES = ['專業技能', '工具與軟體', '核心職能', '軟實力', '語言能力', '證照與認證', '學習中'] as const
type SkillCategory = typeof SKILL_CATEGORIES[number]

interface TaggedSkill { name: string; category: SkillCategory }
interface JournalSkill {
  name: string
  category: SkillCategory
  journal_ids: string[]
  journalFrequency: number
}
interface Application {
  id: string
  matchAnalysis?: { missingSkills: string[] }
  missingSkills?: string[]
}

const CAT_DOT: Record<SkillCategory, string> = {
  '專業技能':   'bg-terra-400',
  '工具與軟體': 'bg-sky-400',
  '核心職能':   'bg-violet-400',
  '軟實力':     'bg-sage-400',
  '語言能力':   'bg-honey-400',
  '證照與認證': 'bg-warm-400',
  '學習中':     'bg-orange-400',
}

const CAT_BG: Record<SkillCategory, string> = {
  '專業技能':   'bg-terra-50 border-terra-200 text-terra-700',
  '工具與軟體': 'bg-sky-50 border-sky-200 text-sky-700',
  '核心職能':   'bg-violet-50 border-violet-200 text-violet-700',
  '軟實力':     'bg-sage-50 border-sage-200 text-sage-700',
  '語言能力':   'bg-honey-50 border-honey-400 text-ink-700',
  '證照與認證': 'bg-warm-50 border-warm-300 text-ink-600',
  '學習中':     'bg-orange-50 border-orange-200 text-orange-700',
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SkillMapPage() {
  const [skills, setSkills] = useState<TaggedSkill[]>([])
  const [journalSkills, setJournalSkills] = useState<JournalSkill[]>([])
  const [totalJournals, setTotalJournals] = useState(0)
  const [missingTop10, setMissingTop10] = useState<{ skill: string; count: number }[]>([])
  const [jobsWithAnalysis, setJobsWithAnalysis] = useState(0)
  const [catCollapsed, setCatCollapsed] = useState<Partial<Record<SkillCategory, boolean>>>(
    Object.fromEntries(SKILL_CATEGORIES.slice(3).map((c) => [c, true]))
  )

  useEffect(() => {
    // Load personal skills
    fetch('/api/skills').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (res) setSkills(res.skills)
    }).catch(() => { /* ignore */ })

    // Load journal skills (AI-suggestion cache stays local) + journal count
    try {
      const raw = localStorage.getItem('career-journal-skills')
      if (raw) setJournalSkills(JSON.parse(raw))
    } catch { /* ignore */ }
    fetch('/api/work-journal').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (res) setTotalJournals(res.entries.length)
    }).catch(() => { /* ignore */ })

    // Aggregate missing skills from all job match analyses
    fetch('/api/tracker').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const apps: Application[] = res.applications
      const freq: Record<string, number> = {}
      let analyzed = 0
      for (const app of apps) {
        const missing: string[] = app.missingSkills ?? app.matchAnalysis?.missingSkills ?? []
        if (missing.length > 0) {
          analyzed++
          for (const s of missing) {
            freq[s] = (freq[s] ?? 0) + 1
          }
        }
      }
      setJobsWithAnalysis(analyzed)
      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([skill, count]) => ({ skill, count }))
      setMissingTop10(sorted)
    }).catch(() => { /* ignore */ })
  }, [])

  const grouped = SKILL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = skills.filter((s) => s.category === cat)
    return acc
  }, {} as Record<SkillCategory, TaggedSkill[]>)

  const maxFreq = journalSkills.reduce((m, s) => Math.max(m, s.journalFrequency), 0)
  const maxMissing = missingTop10[0]?.count ?? 1

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-6">
      <PageTooltip pageKey="skill_map" />

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ink-900">◈ Skill Map</h1>
          <p className="mt-1 text-sm text-ink-500">個人技能全貌 · 日誌頻率 · 跨職缺缺口彙整</p>
        </div>
        <Link
          href="/dashboard/skills"
          className="shrink-0 rounded-xl border border-warm-200 bg-white px-3 py-2 text-xs text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-colors"
        >
          ✏️ 管理技能庫
        </Link>
      </div>

      {/* ── Section 1: Skill category visualization ── */}
      <div className="rounded-2xl border border-warm-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">⚡ 技能分類全覽</h2>
            <p className="text-xs text-ink-400 mt-0.5">共 {skills.length} 項技能，依 7 大類分組</p>
          </div>
        </div>

        {skills.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-2xl">⚡</p>
            <p className="text-sm text-ink-400">尚未新增技能</p>
            <Link href="/dashboard/skills" className="inline-block mt-2 text-sm text-terra-500 hover:text-terra-700 transition-colors">
              前往技能庫新增 →
            </Link>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {SKILL_CATEGORIES.map((cat) => {
              const catSkills = grouped[cat]
              if (!catSkills.length) return null
              const isCollapsed = catCollapsed[cat] ?? false
              return (
                <div key={cat}>
                  <button
                    type="button"
                    onClick={() => setCatCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))}
                    className="flex items-center gap-2 mb-2 w-full text-left"
                  >
                    <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_DOT[cat]}`} />
                    <span className="text-xs font-semibold text-ink-600">{cat}</span>
                    <span className="text-xs text-ink-400">({catSkills.length})</span>
                    <span className="ml-auto text-xs text-ink-300">{isCollapsed ? '▸' : '▾'}</span>
                  </button>
                  {!isCollapsed && (
                    <div className="flex flex-wrap gap-1.5">
                      {catSkills.map((s) => (
                        <span
                          key={s.name}
                          className={`rounded-full border px-3 py-1 text-xs ${CAT_BG[cat]}`}
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {skills.every((s) => !SKILL_CATEGORIES.includes(s.category as SkillCategory)) && (
              <p className="text-sm text-ink-400 text-center py-4">技能尚未分類</p>
            )}
          </div>
        )}
      </div>

      {/* ── Section 2: Journal skill frequency ── */}
      <div className="rounded-2xl border border-warm-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">📓 來自工作日誌的技能頻率</h2>
            <p className="text-xs text-ink-400 mt-0.5">
              {totalJournals > 0 ? `共 ${totalJournals} 篇日誌` : '尚無日誌資料'}{journalSkills.length > 0 ? `，擷取到 ${journalSkills.length} 項技能` : ''}
            </p>
          </div>
          <Link href="/work-journal" className="text-xs text-terra-500 hover:text-terra-700 transition-colors">
            前往日誌 →
          </Link>
        </div>

        {journalSkills.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-2xl">📓</p>
            <p className="text-sm text-ink-400">尚未從日誌分析技能</p>
            <Link href="/work-journal" className="inline-block mt-1 text-sm text-terra-500 hover:text-terra-700 transition-colors">
              前往 Work Journal 記錄日誌 →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-warm-100">
            {journalSkills
              .slice()
              .sort((a, b) => b.journalFrequency - a.journalFrequency)
              .map((jSkill) => {
                const pct = maxFreq > 0 ? Math.round((jSkill.journalFrequency / maxFreq) * 100) : 0
                return (
                  <div key={jSkill.name} className="px-5 py-3 flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_DOT[jSkill.category] ?? 'bg-warm-400'}`} />
                    <span className="text-sm font-medium text-ink-800 w-28 shrink-0 truncate">{jSkill.name}</span>
                    <div className="hidden sm:block flex-1 h-1.5 rounded-full bg-warm-100">
                      <div className="h-full rounded-full bg-terra-400 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-ink-400 shrink-0 ml-auto sm:ml-0 sm:w-14 text-right">{jSkill.journalFrequency}/{totalJournals}</span>
                    <span className="hidden sm:inline text-[10px] text-ink-300 shrink-0 w-16 text-right">{jSkill.category}</span>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* ── Section 3: Cross-job missing skills Top 10 ── */}
      <div className="rounded-2xl border border-warm-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-warm-100">
          <h2 className="text-sm font-semibold text-ink-800">🔍 跨職缺待補強技能 Top 10</h2>
          <p className="text-xs text-ink-400 mt-0.5">
            {jobsWithAnalysis > 0
              ? `彙整 ${jobsWithAnalysis} 份 AI 匹配分析，最常出現的缺口技能`
              : '完成職缺 AI 匹配分析後，自動彙整缺口技能'}
          </p>
        </div>

        {missingTop10.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <p className="text-2xl">🎯</p>
            <p className="text-sm text-ink-400">尚無匹配分析資料</p>
            <Link href="/jobs" className="inline-block mt-1 text-sm text-terra-500 hover:text-terra-700 transition-colors">
              前往 Application Tracker 進行 AI 分析 →
            </Link>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {missingTop10.map(({ skill, count }, i) => {
              const pct = Math.round((count / maxMissing) * 100)
              return (
                <div key={skill} className="flex items-center gap-3 rounded-xl sm:rounded-none border sm:border-none border-warm-200 px-3 sm:px-0 py-2.5 sm:py-0 bg-white sm:bg-transparent">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-terra-50 text-[10px] font-bold text-terra-500">
                    {i + 1}
                  </div>
                  <span className="text-sm font-medium text-ink-800 flex-1 sm:w-32 sm:flex-none truncate">{skill}</span>
                  <div className="hidden sm:block flex-1 h-2 rounded-full bg-warm-100">
                    <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-red-500 shrink-0 whitespace-nowrap">
                    {count} 份
                  </span>
                  <Link href="/work-journal" className="sm:hidden flex h-7 w-7 items-center justify-center rounded-lg bg-terra-50 text-terra-500 text-sm font-bold shrink-0">+</Link>
                </div>
              )
            })}
            <p className="pt-2 text-[10px] text-ink-300">
              建議優先補強排名前 3 的技能，可至{' '}
              <Link href="/work-journal" className="text-terra-400 hover:text-terra-600 transition-colors">Work Journal</Link>{' '}
              記錄學習過程。
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
