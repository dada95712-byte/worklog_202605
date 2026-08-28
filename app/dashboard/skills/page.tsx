'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RateLimitToast } from '@/components/ui/rate-limit-toast'
import { PageTooltip } from '@/components/onboarding/page-tooltip'

// ── Types ──────────────────────────────────────────────────────────────────────

const SKILL_CATEGORIES = ['專業技能', '工具與軟體', '核心職能', '軟實力', '語言能力', '證照與認證', '學習中'] as const
type SkillCategory = typeof SKILL_CATEGORIES[number]
interface SkillEvidenceOut { journalId: string; journalTitle: string; excerpt: string }
interface TaggedSkill {
  name: string
  category: SkillCategory
  id?: string
  source?: 'manual' | 'verbatim' | 'evidence' | 'inference'
  isManual?: boolean
  isConfirmed?: boolean
  evidenceCount?: number
  evidence?: SkillEvidenceOut[]
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

const CAT_GUIDE: Record<SkillCategory, { emoji: string; desc: string; examples: string }> = {
  '專業技能':   { emoji: '🔴', desc: '特定職位才需要的硬技能',        examples: 'Python、財務分析、供應鏈管理、AutoCAD' },
  '工具與軟體': { emoji: '🔵', desc: '你使用過的軟體、平台、系統',    examples: 'Excel、Figma、Salesforce、SAP、Notion' },
  '核心職能':   { emoji: '🟣', desc: '可跨職位應用的工作能力',         examples: '專案管理、數據分析、簡報製作、流程優化' },
  '軟實力':     { emoji: '🟠', desc: '人際互動與工作態度相關能力',     examples: '溝通協調、團隊合作、問題解決、領導力' },
  '語言能力':   { emoji: '🟢', desc: '語言與溝通能力',                 examples: '英文（流利）、日文（中等）、TOEIC 660' },
  '證照與認證': { emoji: '🟡', desc: '已取得的資格證書',               examples: 'PMP、CFA、乙級技術士、AWS Certified' },
  '學習中':     { emoji: '⚪', desc: '正在培養、尚未精通的技能',       examples: 'Rust、機器學習、韓文' },
}

const SOURCE_BADGE: Record<NonNullable<TaggedSkill['source']>, { icon: string; label: string }> = {
  manual:    { icon: '',   label: '' },
  verbatim:  { icon: '🟢', label: '已驗證' },
  evidence:  { icon: '🟢', label: '已驗證' },
  inference: { icon: '🟡', label: 'AI 推論' },
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── CategoryTooltip ───────────────────────────────────────────────────────────

function CategoryTooltip({ cat }: { cat: SkillCategory }) {
  const [visible, setVisible] = useState(false)
  const g = CAT_GUIDE[cat]
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="text-ink-300 hover:text-ink-500 transition-colors text-[13px] leading-none ml-1 focus:outline-none"
        aria-label={`${cat} 說明`}
      >
        ⓘ
      </button>
      <div className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 w-[220px] rounded-lg bg-ink-900 text-white text-xs px-3 py-2 shadow-lg pointer-events-none transition-opacity duration-150 ${visible ? 'opacity-100' : 'opacity-0'}`}>
        <p className="font-semibold mb-1">{g.emoji} {cat}</p>
        <p className="text-white/80 mb-1">{g.desc}</p>
        <p className="text-white/60">範例：{g.examples}</p>
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-ink-900" />
      </div>
    </div>
  )
}

// ── SkillChip ─────────────────────────────────────────────────────────────────

function SkillChip({
  skill, isEditingCat, onStartEditCat, onCancelEditCat, onChangeCat, onDelete, onLongPress,
}: {
  skill: TaggedSkill
  isEditingCat: boolean
  onStartEditCat: () => void
  onCancelEditCat: () => void
  onChangeCat: (cat: SkillCategory) => void
  onDelete: () => void
  onLongPress: () => void
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleTouchStart() {
    timerRef.current = setTimeout(() => { onLongPress(); timerRef.current = null }, 600)
  }
  function clearLongPress() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
  }

  return (
    <div
      className={`group relative inline-flex items-center gap-0.5 rounded-full border text-sm select-none transition-all duration-150
        ${isEditingCat
          ? 'border-terra-400 bg-terra-50 text-terra-700 pl-3 pr-2 py-1'
          : 'bg-white border-warm-200 text-ink-700 hover:border-terra-300 hover:bg-terra-50 px-3 py-1 cursor-default'
        }`}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
    >
      <span>{skill.name}</span>
      {skill.source && skill.source !== 'manual' && (
        <span title={`${SOURCE_BADGE[skill.source].label}（${skill.evidenceCount ?? 0} 篇日誌）`} className="text-[10px]">
          {SOURCE_BADGE[skill.source].icon}
        </span>
      )}
      {isEditingCat ? (
        <select
          autoFocus
          value={skill.category}
          onChange={(e) => onChangeCat(e.target.value as SkillCategory)}
          onBlur={onCancelEditCat}
          onClick={(e) => e.stopPropagation()}
          className="ml-1 rounded-md border border-warm-200 bg-white text-[11px] text-ink-700 focus:outline-none focus:border-terra-400 shadow-[var(--shadow-warm-sm)] py-0.5 pr-1 cursor-pointer"
        >
          {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      ) : (
        <span className="inline-flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 ml-0.5">
          <button
            title="編輯分類"
            onMouseDown={(e) => { e.preventDefault(); onStartEditCat() }}
            className="text-[11px] text-ink-400 hover:text-terra-600 transition-colors px-0.5 leading-none"
          >✏️</button>
          <button
            title="刪除"
            onMouseDown={(e) => { e.preventDefault(); onDelete() }}
            className="text-[12px] text-ink-400 hover:text-red-400 transition-colors px-0.5 leading-none"
          >✕</button>
        </span>
      )}
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SkillsPage() {
  const [skills, setSkills]           = useState<TaggedSkill[]>([])
  const [newSkill, setNewSkill]       = useState('')
  const [newSkillCat, setNewSkillCat] = useState<SkillCategory>('核心職能')
  const [skillView, setSkillView]     = useState<'category' | 'all'>('category')
  const [collapsedCats, setCollapsedCats] = useState<Set<SkillCategory>>(new Set())
  const [dupAlert, setDupAlert]       = useState('')
  const [editingCatFor, setEditingCatFor] = useState<string | null>(null)
  const [toast, setToast]             = useState<{ msg: string; skill: TaggedSkill } | null>(null)
  const [mobileMenuSkill, setMobileMenuSkill] = useState<string | null>(null)
  const [recommendedSkills, setRecommendedSkills] = useState<TaggedSkill[]>([])
  const [checkedSkills, setCheckedSkills] = useState<Set<string>>(new Set())
  const [loadingRecommend, setLoadingRecommend] = useState(false)
  const [showRecommend, setShowRecommend] = useState(false)
  const [showGuideModal, setShowGuideModal] = useState(false)
  const [aiReclassifying, setAiReclassifying] = useState(false)
  const [reclassifyPreview, setReclassifyPreview] = useState<{ skill: TaggedSkill; newCat: SkillCategory; reason: string }[] | null>(null)

  const [journalSkills, setJournalSkills] = useState<TaggedSkill[]>([])
  const [analyzingJournals, setAnalyzingJournals] = useState(false)
  const [journalSkillsLoaded, setJournalSkillsLoaded] = useState(false)
  const [extractStats, setExtractStats] = useState<{ passed: number; rejected: number; total: number } | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [rateLimitToast, setRateLimitToast] = useState(false)
  const [expandedJournalSkill, setExpandedJournalSkill] = useState<string | null>(null)
  const [totalJournals, setTotalJournals] = useState(0)
  const [journalEntriesMap, setJournalEntriesMap] = useState<Record<string, string>>({})

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Init ────────────────────────────────────────────────────────────────────

  // 技能一律存資料庫。isManual||isConfirmed 進「我的技能庫」；其餘（inference 待確認）進「AI 建議」。
  async function loadSkills() {
    try {
      const res = await fetch('/api/skills')
      if (!res.ok) return
      const { skills: all } = await res.json() as { skills: TaggedSkill[] }
      setSkills(all.filter((s) => s.isManual || s.isConfirmed))
      setJournalSkills(all.filter((s) => !s.isConfirmed))
      setJournalSkillsLoaded(true)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    (async () => {
      await loadSkills()

      // 舊版 localStorage 手動技能庫，只在資料庫完全沒有資料時搬遷一次
      try {
        const check = await fetch('/api/skills')
        const { skills: dbSkills } = await check.json() as { skills: TaggedSkill[] }
        if (dbSkills.length > 0) return
        const raw = localStorage.getItem('career-skills')
        if (!raw) return
        const p = JSON.parse(raw)
        if (!Array.isArray(p) || p.length === 0) return
        const legacy: TaggedSkill[] = typeof p[0] === 'string'
          ? p.map((s: string) => ({ name: s, category: '核心職能' as SkillCategory }))
          : p
        const putRes = await fetch('/api/skills', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ skills: legacy }),
        })
        if (putRes.ok) await loadSkills()
      } catch { /* ignore */ }
    })()
  }, [])

  useEffect(() => {
    fetch('/api/work-journal').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const es = res.entries as { id: string; title: string }[]
      setTotalJournals(es.length)
      const map: Record<string, string> = {}
      es.forEach((e) => { map[e.id] = e.title })
      setJournalEntriesMap(map)
    }).catch(() => { /* ignore */ })
  }, [])

  useEffect(() => {
    return () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current) }
  }, [])

  function persist(next: TaggedSkill[]) {
    setSkills(next)
    fetch('/api/skills', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: next }),
    }).catch(() => { /* keep optimistic local state on network failure */ })
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  function norm(s: string) { return s.toLowerCase().replace(/\s+/g, '') }

  function addSkill() {
    const t = newSkill.trim(); if (!t) return
    if (skills.some((s) => norm(s.name) === norm(t))) {
      setDupAlert('此技能已存在'); setTimeout(() => setDupAlert(''), 2500); return
    }
    persist([...skills, { name: t, category: newSkillCat }]); setNewSkill('')
  }

  function changeCat(skillName: string, newCat: SkillCategory) {
    persist(skills.map((s) => s.name === skillName ? { ...s, category: newCat } : s))
    setEditingCatFor(null)
  }

  function deleteWithToast(skillName: string) {
    const skill = skills.find((s) => s.name === skillName)
    if (!skill) return
    persist(skills.filter((s) => s.name !== skillName))
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ msg: `已刪除「${skillName}」`, skill })
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null }, 5000)
  }

  function undoDelete() {
    if (!toast) return
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    persist([toast.skill, ...skills])
    setToast(null)
  }

  function dedupSkills() {
    const seen = new Set<string>()
    const deduped = skills.filter((s) => {
      const k = norm(s.name); if (seen.has(k)) return false; seen.add(k); return true
    })
    const removed = skills.length - deduped.length
    persist(deduped)
    setDupAlert(removed > 0 ? `已移除 ${removed} 個重複技能` : '沒有發現重複技能')
    setTimeout(() => setDupAlert(''), 2500)
  }

  function toggleCat(cat: SkillCategory) {
    setCollapsedCats((p) => { const n = new Set(p); n.has(cat) ? n.delete(cat) : n.add(cat); return n })
  }

  function guessCategory(skill: string): SkillCategory {
    const l = skill.toLowerCase().replace(/\s+/g, '')
    if (/溝通|協調|協作|跨部門|團隊合作|領導|表達|人際|問題解決|服務|軟實力|soft/.test(l)) return '軟實力'
    if (/英文|英語|english|日文|日語|korean|韓文|french|德文|語言|toeic|ielts|雅思|托福/.test(l)) return '語言能力'
    if (/pmp|cfa|cpa|cpe|cissp|certified|certificate|認證|證照|技術士|乙級|甲級/.test(l)) return '證照與認證'
    if (/學習中|進修中|studying|自學/.test(l)) return '學習中'
    if (/python|react|node|sql|docker|git|aws|gcp|azure|figma|excel|powerpoint|office|javascript|typescript|java|c\+\+|ruby|php|swift|kotlin|golang|rust|vue|angular|tailwind|webpack|linux|photoshop|illustrator|premiere|notion|slack|jira|trello|confluence|hubspot|salesforce|googleanalytics|googleads|metaads|facebookads|sap|erp|crm|tableau|powerbi|looker|matlab|spss|stata|hadoop|spark|kubernetes|terraform|ansible/.test(l)) return '工具與軟體'
    if (/管理|規劃|策略|行銷|業務|財務|設計|架構|分析|簡報|研究|開發|運營|專案|品管|採購|供應鏈|數據|報告|預算|成本/.test(l)) return '核心職能'
    return '專業技能'
  }

  async function handleRecommendSkills() {
    let text = ''
    try {
      const jRes = await fetch('/api/work-journal')
      if (jRes.ok) {
        const { entries } = await jRes.json() as { entries: Record<string, string>[] }
        text = entries.map((e) => [e.title, e.content, e.situation, e.task, e.action, e.result].filter(Boolean).join(' ')).join('\n')
      }
    } catch { /* ignore */ }
    if (!text.trim()) { alert('請先在 Work Journal 新增一些日誌再進行分析'); return }
    setLoadingRecommend(true); setRecommendedSkills([]); setCheckedSkills(new Set()); setShowRecommend(true)
    try {
      const res = await fetch('/api/skills/recommend-from-journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalText: text }),
      })
      const data = await res.json()
      setRecommendedSkills((data.skills ?? []).map((s: string) => ({ name: s, category: guessCategory(s) })))
    } catch { setRecommendedSkills([]) }
    finally { setLoadingRecommend(false) }
  }

  async function handleAiReclassify() {
    if (skills.length === 0) return
    setAiReclassifying(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `你是技能分類專家。請根據以下分類規則，判斷每個技能是否在正確的分類，只列出需要調整的項目。

分類規則：
- 專業技能：特定職位的硬技能（如 Python、財務分析）
- 工具與軟體：具體工具/軟體/平台名稱（如 Excel、Figma、Jira、SAP）
- 核心職能：跨職位的工作能力（如專案管理能力、數據分析能力、簡報製作）
- 軟實力：人際與態度（如溝通協調、領導力、問題解決、團隊合作、跨部門協作）
- 語言能力：語言相關（英文、日文、TOEIC）
- 證照與認證：取得的資格證書（PMP、CFA、AWS Certified）
- 學習中：正在學習的技能

用 JSON 格式回覆，只列需調整項目（若無需調整任何技能回傳 {"adjustments":[]}）：
{"adjustments":[{"name":"技能名稱","currentCat":"目前分類","suggestedCat":"建議分類","reason":"原因10字內"}]}

技能列表：
${skills.map((s) => `${s.name}（${s.category}）`).join('、')}

只回傳 JSON。`,
          }],
        }),
      })
      const data = await res.json()
      const m = data.reply?.match(/\{[\s\S]*\}/)
      const parsed = m ? JSON.parse(m[0]) : {}
      const adjustments: { name: string; currentCat: string; suggestedCat: string; reason: string }[] = parsed.adjustments ?? []
      const preview = adjustments
        .filter((a) => (SKILL_CATEGORIES as readonly string[]).includes(a.suggestedCat) && a.suggestedCat !== a.currentCat)
        .map((a) => {
          const skill = skills.find((s) => s.name === a.name)
          return skill ? { skill, newCat: a.suggestedCat as SkillCategory, reason: a.reason } : null
        })
        .filter(Boolean) as { skill: TaggedSkill; newCat: SkillCategory; reason: string }[]
      setReclassifyPreview(preview)
    } catch {
      setReclassifyPreview([])
    } finally { setAiReclassifying(false) }
  }

  function applyReclassify() {
    if (!reclassifyPreview) return
    const updates = new Map(reclassifyPreview.map((p) => [p.skill.name, p.newCat]))
    persist(skills.map((s) => updates.has(s.name) ? { ...s, category: updates.get(s.name)! } : s))
    setReclassifyPreview(null)
  }

  async function analyzeJournals() {
    let journals: Array<{ id: string; title: string; content?: string; situation?: string; task?: string; action?: string; result?: string }> = []
    try {
      const jRes = await fetch('/api/work-journal')
      if (jRes.ok) { const { entries } = await jRes.json(); journals = entries }
    } catch { /* ignore */ }
    if (!journals.length) { alert('請先在 Work Journal 新增一些日誌再進行分析'); return }
    setAnalyzingJournals(true)
    try {
      const res = await fetch('/api/skills/analyze-from-journals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journals }),
      })
      const data = await res.json()
      if (data.error === 'rate_limit') { setRateLimitToast(true); return }
      setExtractStats({ passed: data.passed ?? 0, rejected: data.rejected ?? 0, total: data.total ?? 0 })
      setTimeout(() => setExtractStats(null), 6000)
      await loadSkills()
    } catch { /* keep previous results */ }
    finally { setAnalyzingJournals(false) }
  }

  async function confirmSkill(skill: TaggedSkill) {
    if (!skill.id) return
    setConfirmingId(skill.id)
    try {
      const res = await fetch('/api/skills', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: skill.id, isConfirmed: true }),
      })
      if (res.ok) await loadSkills()
    } catch { /* ignore */ }
    finally { setConfirmingId(null) }
  }

  function addCheckedSkills() {
    const existingNorm = new Set(skills.map((s) => norm(s.name)))
    const toAdd = recommendedSkills.filter((s) => checkedSkills.has(s.name) && !existingNorm.has(norm(s.name)))
    if (toAdd.length) persist([...skills, ...toAdd])
    setShowRecommend(false); setCheckedSkills(new Set())
  }

  const groupedSkills = SKILL_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = skills.filter((s) => s.category === cat); return acc
  }, {} as Record<SkillCategory, TaggedSkill[]>)

  // ── Shared chip renderer ─────────────────────────────────────────────────────

  function renderChip(s: TaggedSkill) {
    return (
      <SkillChip
        key={s.name}
        skill={s}
        isEditingCat={editingCatFor === s.name}
        onStartEditCat={() => setEditingCatFor(s.name)}
        onCancelEditCat={() => setEditingCatFor(null)}
        onChangeCat={(cat) => changeCat(s.name, cat)}
        onDelete={() => deleteWithToast(s.name)}
        onLongPress={() => setMobileMenuSkill(s.name)}
      />
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-8 space-y-5">
      <PageTooltip pageKey="skills" />
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-ink-900">⚡ 我的技能庫</h1>
        <p className="mt-1 text-sm text-ink-500">統一管理技能，自動用於 AI 分析與匹配</p>
      </div>

      {/* ── Usage bar ── */}
      <div className="flex items-center gap-2 flex-wrap bg-cream-50 border border-warm-200 rounded-lg px-4 py-3">
        <span className="text-sm text-ink-500 shrink-0">你的技能將用於：</span>
        <Link href="/jobs" className="text-sm font-medium text-terra-600 hover:text-terra-800 transition-colors whitespace-nowrap">🎯 職缺匹配 →</Link>
        <span className="text-ink-300">·</span>
        <Link href="/skill-map" className="text-sm font-medium text-terra-600 hover:text-terra-800 transition-colors whitespace-nowrap">◈ Skill Map →</Link>
        <span className="text-ink-300">·</span>
        <Link href="/interviews" className="text-sm font-medium text-terra-600 hover:text-terra-800 transition-colors whitespace-nowrap">🎤 面試準備 →</Link>
      </div>

      {/* ── Controls bar ── */}
      <div className="border-b border-warm-200 pb-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Input */}
          <input
            placeholder="新增技能..."
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addSkill()}
            className="h-9 w-40 rounded-xl border border-warm-300 bg-white px-3 text-sm text-ink-800 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none"
          />
          {/* Category select */}
          <select
            value={newSkillCat}
            onChange={(e) => setNewSkillCat(e.target.value as SkillCategory)}
            className="h-9 w-[120px] rounded-xl border border-warm-300 bg-white px-2 text-sm text-ink-700 focus:border-terra-400 focus:outline-none"
          >
            {SKILL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {/* Add button */}
          <button
            onClick={addSkill}
            className="h-9 rounded-xl bg-terra-500 px-4 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]"
          >
            新增
          </button>

          {/* Separator */}
          <div className="h-5 w-px bg-warm-200 mx-1" />

          {/* AI recommend */}
          <button
            onClick={handleRecommendSkills}
            disabled={loadingRecommend}
            className="h-9 flex items-center gap-1.5 rounded-xl border border-warm-200 bg-white px-3 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-50"
          >
            {loadingRecommend ? <Spinner /> : '🤖'} AI 推薦
          </button>
          {/* AI reclassify */}
          <button
            onClick={handleAiReclassify}
            disabled={aiReclassifying || skills.length === 0}
            className="h-9 flex items-center gap-1.5 rounded-xl border border-warm-200 bg-white px-3 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-50"
          >
            {aiReclassifying ? <Spinner /> : '🤖'} AI 重新分類
          </button>
          {/* Dedup */}
          <button
            onClick={dedupSkills}
            className="h-9 rounded-xl border border-warm-200 bg-white px-3 text-sm text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors"
          >
            清除重複
          </button>
          {/* Guide */}
          <button
            onClick={() => setShowGuideModal(true)}
            className="h-9 flex items-center gap-1.5 rounded-xl bg-cream-200 px-3 text-sm text-ink-600 hover:bg-cream-300 transition-colors"
          >
            📖 分類指引
          </button>

          {/* View toggle — pushed to right */}
          <div className="ml-auto flex gap-0.5 rounded-lg border border-warm-200 bg-white p-0.5 h-9 items-center">
            {(['category', 'all'] as const).map((v) => (
              <button key={v} onClick={() => setSkillView(v)}
                className={`rounded-md px-3 h-7 text-xs font-medium transition-all ${skillView === v ? 'bg-cream-200 text-ink-700' : 'text-ink-400 hover:text-ink-600'}`}>
                {v === 'category' ? '分類視圖' : '全部顯示'}
              </button>
            ))}
          </div>
        </div>

        {/* Dup alert */}
        {dupAlert && (
          <p className="text-xs text-terra-600 bg-terra-50 border border-terra-100 rounded-lg px-3 py-1.5">{dupAlert}</p>
        )}
      </div>

      {/* ── Mobile long-press menu ── */}
      {mobileMenuSkill && (
        <div className="fixed inset-0 z-[100] flex items-end" onClick={() => setMobileMenuSkill(null)}>
          <div className="w-full bg-white rounded-t-2xl border-t border-warm-200 p-4 space-y-1 shadow-[var(--shadow-warm-lg)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-xs font-semibold text-ink-400 pb-2 border-b border-warm-100">{mobileMenuSkill}</p>
            <button
              className="w-full text-left py-3 px-1 text-sm text-ink-700 hover:text-terra-600 transition-colors"
              onClick={() => { setEditingCatFor(mobileMenuSkill); setMobileMenuSkill(null) }}>
              ✏️ 編輯分類
            </button>
            <button
              className="w-full text-left py-3 px-1 text-sm text-red-500 hover:text-red-600 transition-colors"
              onClick={() => { deleteWithToast(mobileMenuSkill); setMobileMenuSkill(null) }}>
              ✕ 刪除
            </button>
            <button
              className="w-full text-center py-2 text-sm text-ink-400 mt-1"
              onClick={() => setMobileMenuSkill(null)}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 rounded-2xl border border-warm-200 bg-white px-5 py-3 shadow-[var(--shadow-warm-md)] text-sm whitespace-nowrap">
          <span className="text-ink-600">{toast.msg}</span>
          <button onClick={undoDelete} className="text-terra-500 font-semibold hover:text-terra-700 transition-colors">復原</button>
        </div>
      )}

      {/* ── AI Recommend panel ── */}
      {showRecommend && (
        <Card className="border-terra-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>AI 推薦技能</CardTitle>
              <button onClick={() => setShowRecommend(false)} className="text-ink-400 hover:text-ink-600 text-lg leading-none">×</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingRecommend ? (
              <div className="flex items-center gap-2 text-sm text-terra-500 py-4 justify-center"><Spinner />AI 分析日誌中...</div>
            ) : recommendedSkills.length === 0 ? (
              <p className="text-sm text-ink-400 py-2">無法取得推薦，請確認日誌有足夠內容。</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {recommendedSkills.map((s) => (
                    <label key={s.name} className={`flex items-center gap-1.5 cursor-pointer rounded-full border px-3 py-1 text-sm transition-all ${checkedSkills.has(s.name) ? 'border-terra-400 bg-terra-50 text-terra-600' : 'border-warm-200 text-ink-500 hover:border-warm-300'}`}>
                      <input type="checkbox" className="hidden" checked={checkedSkills.has(s.name)}
                        onChange={(e) => setCheckedSkills((p) => { const n = new Set(p); e.target.checked ? n.add(s.name) : n.delete(s.name); return n })} />
                      {checkedSkills.has(s.name) ? '✓ ' : ''}{s.name}
                      <span className="text-[10px] text-ink-400">· {s.category}</span>
                    </label>
                  ))}
                </div>
                <Button variant="primary" size="sm" disabled={checkedSkills.size === 0} onClick={addCheckedSkills}>
                  一鍵新增 {checkedSkills.size > 0 ? `(${checkedSkills.size})` : ''}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── AI 建議（待確認）Block ── */}
      <div className="rounded-2xl border border-warm-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-warm-100">
          <div>
            <h2 className="text-sm font-semibold text-ink-800">🟡 AI 建議（待確認）</h2>
            <p className="text-xs text-ink-400 mt-0.5">從工作日誌萃取，附逐字引用的原文證據，確認後才會用於履歷生成</p>
          </div>
          <button
            onClick={analyzeJournals}
            disabled={analyzingJournals}
            className="h-8 flex items-center gap-1.5 rounded-xl border border-warm-200 bg-white px-3 text-xs text-ink-500 hover:border-warm-300 hover:text-ink-700 transition-colors disabled:opacity-50"
          >
            {analyzingJournals ? <Spinner /> : '🔄'} {journalSkillsLoaded ? '重新分析日誌' : '分析日誌'}
          </button>
        </div>

        {extractStats && (
          <p className="px-5 py-2 text-xs text-terra-600 bg-terra-50 border-b border-terra-100">
            本次擷取 {extractStats.total} 項，通過驗證 {extractStats.passed} 項，{extractStats.rejected} 項因無法比對原文而丟棄
          </p>
        )}

        {analyzingJournals ? (
          <div className="flex items-center gap-2 text-sm text-terra-500 py-8 justify-center">
            <Spinner className="h-5 w-5" /> AI 正在分析你的日誌...
          </div>
        ) : !journalSkillsLoaded ? (
          <div className="py-10 text-center">
            <p className="text-2xl mb-2">📓</p>
            <p className="text-sm text-ink-400">點擊「分析日誌」讓 AI 從你的工作日誌中擷取技能</p>
          </div>
        ) : journalSkills.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-ink-400">目前沒有待確認的建議</p>
          </div>
        ) : (
          <div className="divide-y divide-warm-100">
            {journalSkills.map((jSkill) => {
              const isExpanded = expandedJournalSkill === jSkill.name
              const evidence = jSkill.evidence ?? []
              return (
                <div key={jSkill.id ?? jSkill.name} className="px-5 py-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_DOT[jSkill.category] ?? 'bg-warm-400'}`} />
                    <span className="text-sm font-medium text-ink-800 flex-1">{jSkill.name}</span>
                    <span className="text-xs text-ink-400">{jSkill.category}</span>
                    <button
                      onClick={() => setExpandedJournalSkill(isExpanded ? null : jSkill.name)}
                      className="text-xs text-ink-400 hover:text-ink-600 transition-colors whitespace-nowrap"
                    >
                      {jSkill.evidenceCount ?? evidence.length} 篇 {isExpanded ? '▲' : '▼'}
                    </button>
                    <button
                      onClick={() => confirmSkill(jSkill)}
                      disabled={confirmingId === jSkill.id}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap bg-terra-500 text-white hover:bg-terra-700 shadow-[var(--shadow-warm-sm)] disabled:opacity-50"
                    >
                      {confirmingId === jSkill.id ? '確認中…' : '✓ 確認正確'}
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="pl-5 space-y-1.5">
                      {evidence.map((e) => (
                        <div key={e.journalId} className="text-xs bg-cream-50 border border-warm-100 rounded-lg px-3 py-2">
                          <p className="text-ink-400 mb-0.5">· {e.journalTitle || journalEntriesMap[e.journalId] || e.journalId}</p>
                          <p className="text-ink-600">「{e.excerpt}」</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Skill list ── */}
      {skillView === 'all' ? (
        <div className="rounded-2xl border border-warm-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink-700">所有技能 <span className="text-ink-400 font-normal">({skills.length})</span></p>
          </div>
          {skills.length === 0 ? (
            <div className="py-8 text-center"><p className="text-2xl mb-2">⚡</p><p className="text-sm text-ink-500">尚未新增技能</p></div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => renderChip(s))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {SKILL_CATEGORIES.map((cat) => {
            const catSkills = groupedSkills[cat]
            if (!catSkills.length) return null
            const collapsed = collapsedCats.has(cat)
            return (
              <div key={cat} className="rounded-2xl border border-warm-200 bg-white overflow-hidden">
                <div className="w-full flex items-center justify-between px-5 py-3 hover:bg-cream-50 transition-colors">
                  <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleCat(cat)}>
                    <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_DOT[cat]}`} />
                    <span className="text-sm font-semibold text-ink-700">{cat}</span>
                    <span className="text-xs text-ink-400 font-normal">({catSkills.length})</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <CategoryTooltip cat={cat} />
                    <button onClick={() => toggleCat(cat)} className="text-ink-300 text-xs ml-1">{collapsed ? '▶' : '▼'}</button>
                  </div>
                </div>
                {!collapsed && (
                  <div className="px-5 pb-4 pt-1 flex flex-wrap gap-2">
                    {catSkills.map((s) => renderChip(s))}
                  </div>
                )}
              </div>
            )
          })}
          {skills.length === 0 && (
            <div className="py-10 text-center"><p className="text-2xl mb-2">⚡</p><p className="text-sm text-ink-500">尚未新增技能</p></div>
          )}
        </div>
      )}

      {/* ── Guide Modal ── */}
      {showGuideModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowGuideModal(false)}>
          <div className="bg-white rounded-2xl shadow-[var(--shadow-warm-lg)] max-w-[560px] w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">分類指引</h2>
                  <p className="text-sm text-ink-400 mt-0.5">如何正確分類你的技能？</p>
                </div>
                <button onClick={() => setShowGuideModal(false)} className="text-ink-300 hover:text-ink-600 transition-colors text-xl leading-none ml-4">✕</button>
              </div>

              <div className="space-y-2">
                {SKILL_CATEGORIES.map((cat) => {
                  const g = CAT_GUIDE[cat]
                  return (
                    <div key={cat} className="flex gap-3 p-3 rounded-xl border border-warm-100 bg-cream-50">
                      <span className="text-lg shrink-0 mt-0.5">{g.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${CAT_DOT[cat]}`} />
                          <p className="text-sm font-semibold text-ink-800">{cat}</p>
                        </div>
                        <p className="text-xs text-ink-500 mt-0.5">{g.desc}</p>
                        <p className="text-xs text-ink-400 mt-0.5">範例：{g.examples}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-ink-800">🔴 專業技能 vs 🟣 核心職能 最容易搞混：</p>
                <div className="space-y-1 text-xs text-ink-600">
                  <p>→ 「專案管理工具（Jira）」屬於<strong>工具與軟體</strong></p>
                  <p>→ 「專案管理能力」屬於<strong>核心職能</strong></p>
                  <p>→ 「Python 程式設計」屬於<strong>專業技能</strong></p>
                </div>
                <p className="text-sm font-semibold text-ink-800 mt-3">🟠 軟實力 常見錯誤分類：</p>
                <div className="space-y-1 text-xs text-ink-600">
                  <p>→ 「溝通協調、團隊合作、跨部門協作」→ 應歸<strong>軟實力</strong>，不是核心職能</p>
                  <p>→ 「領導力、問題解決」→ 應歸<strong>軟實力</strong></p>
                </div>
              </div>

              <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 space-y-1.5">
                <p className="text-sm font-semibold text-sage-700">💡 小技巧：</p>
                <p className="text-xs text-ink-600">→ 如果是「工具或軟體名稱」→ <strong>工具與軟體</strong></p>
                <p className="text-xs text-ink-600">→ 如果是「一種能力或方法」→ <strong>核心職能或軟實力</strong></p>
                <p className="text-xs text-ink-600">→ 如果是「考取的證書」→ <strong>證照與認證</strong></p>
              </div>

              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                了解了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Reclassify Preview Modal ── */}
      {reclassifyPreview !== null && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setReclassifyPreview(null)}>
          <div className="bg-white rounded-2xl shadow-[var(--shadow-warm-lg)] max-w-[560px] w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-ink-900">🤖 AI 重新分類預覽</h2>
                  {reclassifyPreview.length > 0
                    ? <p className="text-sm text-ink-400 mt-0.5">以下技能分類將被調整（共 {reclassifyPreview.length} 項）</p>
                    : <p className="text-sm text-sage-600 mt-0.5">✓ 所有技能分類都已正確，無需調整！</p>
                  }
                </div>
                <button onClick={() => setReclassifyPreview(null)} className="text-ink-300 hover:text-ink-600 transition-colors text-xl leading-none ml-4">✕</button>
              </div>

              {reclassifyPreview.length > 0 ? (
                <>
                  <div className="space-y-2">
                    {reclassifyPreview.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-warm-100 bg-cream-50 text-sm flex-wrap">
                        <span className="font-medium text-ink-800 flex-1 min-w-[80px]">{p.skill.name}</span>
                        <span className="text-ink-400 text-xs">{p.skill.category}</span>
                        <span className="text-ink-300 text-xs">→</span>
                        <span className="text-terra-600 text-xs font-semibold">{p.newCat}</span>
                        {p.reason && <span className="text-ink-400 text-[10px] w-full sm:w-auto">（{p.reason}）</span>}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={applyReclassify}
                      className="flex-1 rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                      確認更新 {reclassifyPreview.length} 項
                    </button>
                    <button
                      onClick={() => setReclassifyPreview(null)}
                      className="rounded-xl border border-warm-200 bg-cream-100 px-5 py-3 text-sm text-ink-500 hover:bg-cream-200 transition-colors">
                      取消
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setReclassifyPreview(null)}
                  className="w-full rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                  了解了
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <RateLimitToast visible={rateLimitToast} onDismiss={() => setRateLimitToast(false)} />
    </div>
  )
}
