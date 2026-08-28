'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { PageTooltip } from '@/components/onboarding/page-tooltip'

// ── Types ─────────────────────────────────────────────────────────────────────

interface JournalImage { url: string; aiDescription?: string; uploadedAt: string }

interface CareerAchievementItem {
  id: string
  journalId: string | null
  journalTitle: string
  journalDate: string | null
  company: string | null
  text: string
  metric: string | null
  journalExcerpt: string | null
  isConfirmed: boolean
  createdAt: string
}

interface PendingSkillItem { id: string; name: string; category: string; evidenceCount: number }

interface CareerInsightEvidenceItem { journalId: string; journalTitle: string; journalDate: string | null; excerpt: string }
interface CareerInsightItem {
  id: string
  text: string
  isConfirmed: boolean
  evidenceCount: number
  evidence: CareerInsightEvidenceItem[]
}

interface JournalEntry {
  id: string
  title: string
  company: string
  jobTitle?: string
  date: string
  template: 'star' | 'free' | 'ai'
  situation?: string
  task?: string
  action?: string
  result?: string
  content?: string
  tags: string[]
  images: JournalImage[]
  createdAt: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const AI_TOPICS = [
  { id: 'achievement', icon: '🏆', label: '工作成就', desc: '記錄一件最近完成的成果' },
  { id: 'problem',     icon: '💡', label: '問題解決', desc: '記錄一個你解決的難題' },
  { id: 'teamwork',    icon: '🤝', label: '團隊協作', desc: '記錄一次與他人合作的經歷' },
  { id: 'growth',      icon: '📈', label: '技能成長', desc: '記錄你學到的新技能或知識' },
]

const AI_QUESTIONS: Record<string, string[]> = {
  achievement: [
    '這件事情發生在什麼時候？在哪家公司？',
    '你負責的是什麼任務或目標？',
    '你具體做了哪些行動或決策？',
    '最後的結果是什麼？有沒有具體的數字或成效？',
    '這件事對你來說有什麼意義或學習？',
  ],
  problem: [
    '遇到的是什麼問題？當時的工作背景是什麼？',
    '這個問題對工作造成了哪些影響？',
    '你是如何分析問題的？有哪些可能的解決方向？',
    '你最後採取了什麼行動？過程中遇到哪些挑戰？',
    '問題解決後，結果如何？你從中學到了什麼？',
  ],
  teamwork: [
    '這次合作的背景是什麼？有哪些人一起參與？',
    '你在這個團隊中扮演什麼角色？',
    '合作過程中遇到了哪些困難或意見分歧？',
    '你如何促進團隊溝通或化解衝突？',
    '最後的成果是什麼？這次合作對你有什麼啟發？',
  ],
  growth: [
    '你學到的是什麼技能或知識？是什麼契機讓你開始學習？',
    '學習的過程是怎樣的？有遇到哪些挑戰或困難？',
    '你使用了哪些方法或資源來學習？',
    '學會之後，你在工作中如何實際應用這個技能？',
    '這項技能對你的職涯發展有什麼幫助或影響？',
  ],
}

const JOURNAL_KEY = 'career-journal'

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(iso: string) {
  try { const d = new Date(iso); return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')}` }
  catch { return iso }
}
function relativeTime(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(0,mins)} 分鐘前`
  if (mins < 1440) return `${Math.floor(mins/60)} 小時前`
  return `${Math.floor(mins/1440)} 天前`
}
function monthLabel(iso: string) {
  const d = new Date(iso); return `${d.getFullYear()}年 ${d.getMonth()+1}月`
}
function emptyEntry(): JournalEntry {
  return { id: '', title: '', company: '', jobTitle: '', date: todayStr(), template: 'star', content: '', situation: '', task: '', action: '', result: '', tags: [], images: [], createdAt: '' }
}

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── Voice Button ──────────────────────────────────────────────────────────────

interface VoiceButtonProps {
  onResult: (text: string) => void
  listeningField: string | null
  fieldKey: string
  setListeningField: (f: string | null) => void
}

function VoiceButton({ onResult, listeningField, fieldKey, setListeningField }: VoiceButtonProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const isListening = listeningField === fieldKey
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supported = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

  function toggle() {
    if (isListening) {
      recognitionRef.current?.stop()
      setListeningField(null)
      return
    }
    if (listeningField) {
      recognitionRef.current?.stop()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r: any = new SR()
    r.lang = 'zh-TW'; r.continuous = true; r.interimResults = true
    r.onresult = (e: any) => {
      let final = ''; let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript
        else interim += e.results[i][0].transcript
      }
      if (final) onResult(final)
      if (interim) onResult(interim)
    }
    r.onend = () => setListeningField(null)
    r.onerror = () => setListeningField(null)
    recognitionRef.current = r
    r.start()
    setListeningField(fieldKey)
  }

  if (!supported) {
    return (
      <button type="button" disabled title="語音輸入需使用 Chrome 瀏覽器"
        className="flex items-center gap-1 text-[10px] text-ink-300 cursor-not-allowed">
        🎤 語音
      </button>
    )
  }
  return (
    <button type="button" onClick={toggle}
      className={`flex items-center gap-1 text-[10px] rounded-md px-2 py-0.5 transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-ink-400 hover:text-ink-700 hover:bg-warm-100'}`}>
      {isListening ? '⏹ 停止' : '🎤 語音'}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function WorkJournalPage() {
  const [mainTab, setMainTab] = useState<'list' | 'timeline' | 'pending' | 'career'>('list')
  const [view, setView] = useState<'main' | 'add' | 'detail'>('main')
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [draft, setDraft] = useState<JournalEntry>(emptyEntry())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null)

  // AI 萃取成就（待確認/已確認）
  const [achievements, setAchievements] = useState<CareerAchievementItem[]>([])
  const [achievementsLoading, setAchievementsLoading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  // 待確認技能（技能萃取改版後，AI 推論但未確認的技能也收在「待確認」頁一起審核）
  const [pendingSkills, setPendingSkills] = useState<PendingSkillItem[]>([])
  const [skillActionId, setSkillActionId] = useState<string | null>(null)

  // 職涯洞察（AI 推論的行為模式觀察，跟成就是兩套獨立資料）
  const [insights, setInsights] = useState<CareerInsightItem[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [analyzingInsights, setAnalyzingInsights] = useState(false)
  const [insightActionId, setInsightActionId] = useState<string | null>(null)
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)
  const [insightStats, setInsightStats] = useState<{ passed: number; rejected: number; total: number } | null>(null)
  const [insightError, setInsightError] = useState('')

  // Search / filter / sort
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'company'>('date-desc')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterTag, setFilterTag] = useState('')

  // Edit view
  const [tagInput, setTagInput] = useState('')
  const [aiTagging, setAiTagging] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // AI guided mode
  const [aiStep, setAiStep] = useState<1 | 2 | 3>(1)
  const [aiTopic, setAiTopic] = useState('')
  const [aiQaIdx, setAiQaIdx] = useState(0)
  const [aiAnswers, setAiAnswers] = useState<string[]>([])
  const [aiCurrentAnswer, setAiCurrentAnswer] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)

  // Image upload
  const [uploadingImg, setUploadingImg] = useState(false)
  const [analyzingImg, setAnalyzingImg] = useState(false)
  const [pendingAnalysisImg, setPendingAnalysisImg] = useState<JournalImage | null>(null)
  const [analysisResult, setAnalysisResult] = useState('')
  const [imgToast, setImgToast] = useState('')
  const uploadRef = useRef<HTMLInputElement>(null)

  // Voice input
  const [listeningField, setListeningField] = useState<string | null>(null)

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  // Company autocomplete
  const [showCompanyDD, setShowCompanyDD] = useState(false)
  const companyHistory = useMemo(() => [...new Set(entries.map((e) => e.company).filter(Boolean))], [entries])

  // Interview analysis (detail view)
  const [analyzing, setAnalyzing] = useState(false)
  const [interviewMatches, setInterviewMatches] = useState<{ question_text: string; relevance_reason: string; star: Record<string, string> }[] | null>(null)

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    // Entries now persist server-side. On first load with no DB rows yet, migrate
    // whatever was sitting in localStorage from the old client-only version once.
    ;(async () => {
      try {
        const res = await fetch('/api/work-journal')
        if (!res.ok) return
        const { entries: dbEntries } = await res.json() as { entries: JournalEntry[] }
        if (dbEntries.length > 0) { setEntries(dbEntries); return }

        const raw = localStorage.getItem(JOURNAL_KEY)
        if (!raw) return
        const legacy: JournalEntry[] = JSON.parse(raw)
        if (legacy.length === 0) return
        const putRes = await fetch('/api/work-journal', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries: legacy }),
        })
        if (putRes.ok) {
          const { entries: migrated } = await putRes.json()
          setEntries(migrated)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // 進到「待確認」或「職涯成就」分頁時才載入 AI 萃取的成就／技能／洞察清單
  useEffect(() => {
    if (mainTab !== 'pending' && mainTab !== 'career') return
    setAchievementsLoading(true)
    fetch('/api/journals/achievements')
      .then((res) => res.json())
      .then((data) => setAchievements(data.achievements ?? []))
      .catch(() => { /* keep whatever was already loaded */ })
      .finally(() => setAchievementsLoading(false))
  }, [mainTab])

  useEffect(() => {
    if (mainTab !== 'pending' && mainTab !== 'career') return
    loadInsights()
  }, [mainTab])

  useEffect(() => {
    if (mainTab !== 'pending') return
    fetch('/api/skills').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const list: PendingSkillItem[] = (res.skills ?? [])
        .filter((s: { isConfirmed: boolean; isManual: boolean }) => !s.isConfirmed && !s.isManual)
        .map((s: { id: string; name: string; category: string; evidenceCount: number }) => ({ id: s.id, name: s.name, category: s.category, evidenceCount: s.evidenceCount }))
      setPendingSkills(list)
    }).catch(() => { /* keep whatever was already loaded */ })
  }, [mainTab])

  async function confirmPendingSkill(id: string) {
    setSkillActionId(id)
    try {
      const res = await fetch('/api/skills', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isConfirmed: true }),
      })
      if (res.ok) setPendingSkills((prev) => prev.filter((s) => s.id !== id))
    } catch { /* silent */ }
    finally { setSkillActionId(null) }
  }

  async function handleExtractAchievements() {
    if (entries.length === 0) return
    setExtracting(true)
    try {
      const res = await fetch('/api/journals/extract-achievements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journals: entries.map((e) => ({
          id: e.id, title: e.title, content: e.content,
          situation: e.situation, task: e.task, action: e.action, result: e.result,
        })) }),
      })
      const data = await res.json()
      if (data.error) return
      // 重新整理清單，帶出新萃取（含這次沒有新內容時原本已存在的）成就
      const listRes = await fetch('/api/journals/achievements')
      const listData = await listRes.json()
      setAchievements(listData.achievements ?? [])
    } catch { /* silent */ }
    finally { setExtracting(false) }
  }

  async function handleAchievementAction(id: string, action: 'confirm' | 'dismiss') {
    setConfirmingId(id)
    try {
      const res = await fetch('/api/journals/achievements', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        if (action === 'dismiss') {
          setAchievements((prev) => prev.filter((a) => a.id !== id))
        } else {
          setAchievements((prev) => prev.map((a) => a.id === id ? { ...a, isConfirmed: true } : a))
        }
      }
    } catch { /* silent */ }
    finally { setConfirmingId(null) }
  }

  async function loadInsights() {
    setInsightsLoading(true)
    try {
      const res = await fetch('/api/journals/analyze-insights')
      const data = await res.json()
      setInsights(data.insights ?? [])
    } catch { /* keep whatever was already loaded */ }
    finally { setInsightsLoading(false) }
  }

  async function handleAnalyzeInsights() {
    setAnalyzingInsights(true)
    setInsightError('')
    try {
      const res = await fetch('/api/journals/analyze-insights', { method: 'POST' })
      const data = await res.json()
      if (data.error === 'insufficient_journals') { setInsightError(data.message); return }
      if (data.error) { setInsightError('分析失敗，請稍後再試'); return }
      setInsightStats({ passed: data.passed ?? 0, rejected: data.rejected ?? 0, total: data.total ?? 0 })
      setTimeout(() => setInsightStats(null), 6000)
      await loadInsights()
    } catch { setInsightError('分析失敗，請稍後再試') }
    finally { setAnalyzingInsights(false) }
  }

  async function handleInsightAction(id: string, action: 'confirm' | 'dismiss') {
    setInsightActionId(id)
    try {
      const res = await fetch('/api/journals/analyze-insights', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })
      if (res.ok) {
        if (action === 'dismiss') {
          setInsights((prev) => prev.filter((i) => i.id !== id))
        } else {
          setInsights((prev) => prev.map((i) => i.id === id ? { ...i, isConfirmed: true } : i))
        }
      }
    } catch { /* silent */ }
    finally { setInsightActionId(null) }
  }

  async function copyInsight(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { /* clipboard unavailable */ }
  }

  // ── Core handlers ─────────────────────────────────────────────────────────

  function persist(next: JournalEntry[]) {
    setEntries(next)
    fetch('/api/work-journal', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: next }),
    }).then(async (res) => {
      if (res.ok) {
        const { entries: fresh } = await res.json() as { entries: JournalEntry[] }
        setEntries(fresh)
      }
    }).catch(() => { /* keep optimistic local state on network failure */ })
  }

  function startNew() {
    const d = emptyEntry(); d.id = genId(); d.createdAt = new Date().toISOString()
    setDraft(d); setEditingId(null); setTagInput('')
    setAiStep(1); setAiTopic(''); setAiQaIdx(0); setAiAnswers([]); setAiCurrentAnswer('')
    setView('add')
  }

  function startEdit(entry: JournalEntry) {
    setDraft({ ...entry }); setEditingId(entry.id)
    setTagInput((entry.tags ?? []).join(', '))
    setAiStep(1); setAiTopic(''); setAiQaIdx(0); setAiAnswers([]); setAiCurrentAnswer('')
    setView('add')
  }

  const saveEntry = useCallback(async () => {
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean)
    let toSave: JournalEntry = { ...draft, tags, images: draft.images ?? [] }
    setSaving(true)
    // Auto-generate title if empty
    if (!toSave.title.trim()) {
      const content = [toSave.situation, toSave.task, toSave.action, toSave.result, toSave.content].filter(Boolean).join('\n').slice(0, 200)
      if (content.trim()) {
        try {
          const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: [{ role: 'user', content: `根據以下日誌內容，生成一個簡短的標題（10字以內）。只回傳標題文字，不要任何解釋。\n日誌內容：${content}` }], context: 'journal_title' }) })
          const data = await res.json()
          const t = (data.reply as string || '').trim().replace(/["「」]/g, '')
          if (t) toSave = { ...toSave, title: t }
        } catch { /* ignore */ }
      }
      if (!toSave.title.trim()) toSave = { ...toSave, title: `日誌 ${fmtDate(toSave.date)}` }
    }
    setSaving(false)
    const exists = entries.some((e) => e.id === toSave.id)
    const next = exists ? entries.map((e) => e.id === toSave.id ? toSave : e) : [toSave, ...entries]
    persist(next)
    setView('main')
  }, [draft, tagInput, entries])

  function deleteEntry(id: string) {
    if (!confirm('確定刪除此日誌？')) return
    persist(entries.filter((e) => e.id !== id))
    if (view === 'detail') setView('main')
  }

  function updateDraft<K extends keyof JournalEntry>(field: K, value: JournalEntry[K]) {
    setDraft((p) => ({ ...p, [field]: value }))
  }

  // ── Image handlers ────────────────────────────────────────────────────────

  async function handleImageFiles(files: FileList | null) {
    if (!files || !files.length) return
    const available = 3 - (draft.images?.length ?? 0)
    if (available <= 0) { alert('最多上傳 3 張圖片'); return }
    setUploadingImg(true)
    for (const f of Array.from(files).slice(0, available)) {
      if (f.size > 5 * 1024 * 1024) { alert(`「${f.name}」超過 5MB，請上傳 5MB 以內的圖片`); continue }
      const form = new FormData(); form.append('file', f)
      try {
        const res = await fetch('/api/journal/upload', { method: 'POST', body: form })
        const data = await res.json()
        if (data.url) {
          const img: JournalImage = { url: data.url, uploadedAt: new Date().toISOString() }
          setDraft((p) => ({ ...p, images: [...(p.images ?? []), img] }))
          setPendingAnalysisImg(img)
        }
      } catch { /* ignore */ }
    }
    setUploadingImg(false)
  }

  async function analyzeImage(img: JournalImage) {
    setAnalyzingImg(true); setPendingAnalysisImg(null)
    try {
      const res = await fetch('/api/journal/analyze-image', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: img.url }) })
      const data = await res.json()
      if (data.description) { setAnalysisResult(data.description) }
      else throw new Error('no description')
    } catch {
      setImgToast('AI 解析暫時無法使用，圖片已儲存')
      setTimeout(() => setImgToast(''), 3000)
    }
    setAnalyzingImg(false)
  }

  function applyAnalysis() {
    const prefix = '\n\n📷 圖片內容：\n'
    const current = draft.template === 'free' ? (draft.content ?? '') : (draft.result ?? '')
    if (draft.template === 'free') updateDraft('content', current + prefix + analysisResult)
    else updateDraft('result', current + prefix + analysisResult)
    setAnalysisResult('')
  }

  // ── AI tag ────────────────────────────────────────────────────────────────

  async function handleAiTag() {
    const text = [draft.title, draft.content, draft.situation, draft.task, draft.action, draft.result].filter(Boolean).join(' ')
    if (!text.trim() || aiTagging) return
    setAiTagging(true)
    try {
      const res = await fetch('/api/journal/tag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.slice(0, 2000) }) })
      const data = await res.json()
      setTagInput((data.tags as string[] ?? []).join(', '))
    } catch { /* ignore */ }
    finally { setAiTagging(false) }
  }

  // ── AI guided mode ────────────────────────────────────────────────────────

  function selectAiTopic(id: string) {
    setAiTopic(id); setAiStep(2); setAiQaIdx(0); setAiAnswers([]); setAiCurrentAnswer('')
  }

  function nextAiQuestion() {
    const qs = AI_QUESTIONS[aiTopic] ?? []
    const newAnswers = [...aiAnswers, aiCurrentAnswer]
    setAiAnswers(newAnswers); setAiCurrentAnswer('')
    if (aiQaIdx + 1 < qs.length) setAiQaIdx((p) => p + 1)
    else generateFromAi(newAnswers)
  }

  async function generateFromAi(answers: string[]) {
    setAiGenerating(true)
    const qs = AI_QUESTIONS[aiTopic] ?? []
    const qa = qs.map((q, i) => `Q: ${q}\nA: ${answers[i] ?? ''}`).join('\n\n')
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: `以下是使用者的工作日誌問答記錄，請整理成一篇結構清晰的 STAR 格式工作日誌。\n\n${qa}\n\n請輸出 JSON 格式：{"title":"","situation":"","task":"","action":"","result":""}` }], context: 'journal_ai' }) })
      const data = await res.json()
      const m = (data.reply as string || '').match(/\{[\s\S]*\}/)
      if (m) {
        const parsed = JSON.parse(m[0])
        setDraft((p) => ({ ...p, title: parsed.title || p.title, situation: parsed.situation || '', task: parsed.task || '', action: parsed.action || '', result: parsed.result || '', template: 'star' }))
      }
      setAiStep(3)
    } catch { setAiStep(3) }
    finally { setAiGenerating(false) }
  }

  // ── Interview analysis ────────────────────────────────────────────────────

  async function analyzeForInterview(entry: JournalEntry) {
    const content = [entry.situation, entry.task, entry.action, entry.result, entry.content].filter(Boolean).join('\n')
    if (content.trim().length < 20) return
    setAnalyzing(true); setInterviewMatches(null)
    try {
      const res = await fetch('/api/journals/analyze-for-interview', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }) })
      const data = await res.json()
      setInterviewMatches(data.matched_questions ?? [])
    } catch { setInterviewMatches([]) }
    finally { setAnalyzing(false) }
  }

  // ── Filtered / sorted data ────────────────────────────────────────────────

  const filteredEntries = useMemo(() => {
    let r = [...entries]
    if (search) {
      const q = search.toLowerCase()
      r = r.filter((e) => [e.title, e.company, e.jobTitle, e.content, e.situation, e.task, e.action, e.result, ...(e.tags ?? [])].join(' ').toLowerCase().includes(q))
    }
    if (filterCompany) r = r.filter((e) => e.company.toLowerCase().includes(filterCompany.toLowerCase()))
    if (filterTag) r = r.filter((e) => (e.tags ?? []).some((t) => t.toLowerCase().includes(filterTag.toLowerCase())))
    r.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime()
      if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime()
      return a.company.localeCompare(b.company)
    })
    return r
  }, [entries, search, filterCompany, filterTag, sortBy])

  // Timeline grouped by month
  const timelineGroups = useMemo(() => {
    const groups: Record<string, JournalEntry[]> = {}
    ;[...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).forEach((e) => {
      const key = monthLabel(e.date)
      if (!groups[key]) groups[key] = []
      groups[key].push(e)
    })
    return Object.entries(groups)
  }, [entries])

  // Achievements stats
  const achievementStats = useMemo(() => {
    const tagCount: Record<string, number> = {}
    const companyCount: Record<string, number> = {}
    let starCount = 0
    entries.forEach((e) => {
      if (e.situation || e.task || e.action || e.result) starCount++
      ;(e.tags ?? []).forEach((t) => { tagCount[t] = (tagCount[t] ?? 0) + 1 })
      if (e.company) companyCount[e.company] = (companyCount[e.company] ?? 0) + 1
    })
    const topTags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 10)
    const topCompanies = Object.entries(companyCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const starEntries = entries.filter((e) => e.situation && e.task && e.action && e.result).slice(0, 5)
    return { total: entries.length, starCount, topTags, topCompanies, starEntries }
  }, [entries])

  // ─────────────────────────────────────────────────────────────────────────
  // ADD / EDIT VIEW
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'add') {
    const isNew = !editingId
    const template = draft.template

    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5 pb-16">
        <PageTooltip pageKey="work_journal" />
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setView('main')} className="text-sm text-ink-400 hover:text-ink-700 transition-colors">← 返回</button>
          <h1 className="text-lg font-bold text-ink-900">{isNew ? '新增日誌' : '編輯日誌'}</h1>
        </div>

        {/* Title + date + company */}
        <div className="space-y-3">
          <input
            placeholder="日誌標題（留空則由 AI 自動生成）"
            value={draft.title}
            onChange={(e) => updateDraft('title', e.target.value)}
            className="w-full rounded-xl border border-warm-300 bg-white px-4 py-3 text-sm font-medium text-ink-900 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" value={draft.date} onChange={(e) => updateDraft('date', e.target.value)}
              className="rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-700 focus:border-terra-400 focus:outline-none" />
            <div className="relative">
              <input placeholder="公司名稱" value={draft.company}
                onChange={(e) => { updateDraft('company', e.target.value); setShowCompanyDD(true) }}
                onBlur={() => setTimeout(() => setShowCompanyDD(false), 150)}
                className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
              {showCompanyDD && companyHistory.filter((c) => c.toLowerCase().includes(draft.company.toLowerCase())).length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 rounded-xl border border-warm-200 bg-white shadow-lg overflow-hidden">
                  {companyHistory.filter((c) => c.toLowerCase().includes(draft.company.toLowerCase())).slice(0, 5).map((c) => (
                    <button key={c} onClick={() => { updateDraft('company', c); setShowCompanyDD(false) }}
                      className="block w-full px-3 py-2 text-left text-sm text-ink-700 hover:bg-cream-100 transition-colors">{c}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <input placeholder="職位（選填）" value={draft.jobTitle ?? ''}
            onChange={(e) => updateDraft('jobTitle', e.target.value)}
            className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'star', icon: '📋', label: 'STAR 格式', desc: '結構化記錄工作成就' },
            { key: 'free', icon: '✏️', label: '自由記錄', desc: '自由書寫，不限格式' },
            { key: 'ai',   icon: '🤖', label: 'AI 引導',   desc: 'AI 依序提問，幫你整理' },
          ].map(({ key, icon, label, desc }) => (
            <button key={key} type="button"
              onClick={() => { updateDraft('template', key as JournalEntry['template']); setAiStep(1); setAiTopic(''); setAiQaIdx(0); setAiAnswers([]); setAiCurrentAnswer('') }}
              className={`rounded-xl border-2 p-3 text-left transition-all ${template === key ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-terra-200'}`}>
              <p className="text-lg mb-1">{icon}</p>
              <p className="text-xs font-semibold text-ink-800">{label}</p>
              <p className="text-[10px] text-ink-400 mt-0.5 leading-tight">{desc}</p>
            </button>
          ))}
        </div>

        {/* STAR mode */}
        {template === 'star' && (
          <div className="space-y-3">
            {([
              { key: 'situation', label: 'S — Situation', placeholder: '描述當時的情境、背景、時間點...', hint: '例：Q3 末，公司決定在 2 週內完成系統遷移' },
              { key: 'task',      label: 'T — Task',      placeholder: '你負責的任務或挑戰是什麼？',    hint: '例：我負責協調 3 個部門，確保資料不中斷' },
              { key: 'action',    label: 'A — Action',    placeholder: '你具體採取了哪些行動？',        hint: '例：我建立了日報機制、設立緊急聯絡 SOP' },
              { key: 'result',    label: 'R — Result',    placeholder: '結果與成效（最好附上數字）',     hint: '例：如期完成，服務中斷時間 < 30 分鐘' },
            ] as const).map(({ key, label, placeholder, hint }) => (
              <div key={key} className={`rounded-xl border overflow-hidden ${listeningField === `star-${key}` ? 'border-red-400' : 'border-warm-200'}`}>
                <div className="px-4 py-2 bg-cream-50 border-b border-warm-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-ink-700">{label}</p>
                    <p className="text-[10px] text-ink-400">{hint}</p>
                  </div>
                  <VoiceButton fieldKey={`star-${key}`} listeningField={listeningField} setListeningField={setListeningField}
                    onResult={(t) => updateDraft(key, ((draft as unknown as Record<string,string>)[key] ?? '') + t)} />
                </div>
                <textarea placeholder={placeholder}
                  value={(draft as unknown as Record<string, string>)[key] ?? ''}
                  onChange={(e) => updateDraft(key as keyof JournalEntry, e.target.value)}
                  className={`w-full px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none bg-white ${listeningField === `star-${key}` ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                  style={{ minHeight: '80px' }} />
              </div>
            ))}
          </div>
        )}

        {/* Free mode */}
        {template === 'free' && (
          <div className={`rounded-xl border overflow-hidden ${listeningField === 'free-content' ? 'border-red-400' : 'border-warm-200'}`}>
            <div className="px-4 py-2 bg-cream-50 border-b border-warm-100 flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-700">日誌內容</p>
              <VoiceButton fieldKey="free-content" listeningField={listeningField} setListeningField={setListeningField}
                onResult={(t) => updateDraft('content', (draft.content ?? '') + t)} />
            </div>
            <textarea placeholder="自由撰寫日誌內容..." value={draft.content ?? ''}
              onChange={(e) => updateDraft('content', e.target.value)}
              className="w-full px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none bg-white"
              style={{ minHeight: '200px' }} />
          </div>
        )}

        {/* AI guided mode */}
        {template === 'ai' && (
          <div className="rounded-xl border border-terra-200 bg-white p-5 space-y-4">
            {aiStep === 1 && (
              <>
                <p className="text-sm font-semibold text-ink-800">選擇記錄主題</p>
                <div className="grid grid-cols-2 gap-3">
                  {AI_TOPICS.map((t) => (
                    <button key={t.id} onClick={() => selectAiTopic(t.id)}
                      className="rounded-xl border-2 border-warm-200 bg-white p-4 text-left hover:border-terra-300 hover:bg-terra-50 transition-all">
                      <p className="text-2xl mb-1">{t.icon}</p>
                      <p className="text-sm font-semibold text-ink-800">{t.label}</p>
                      <p className="text-xs text-ink-400 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </>
            )}
            {aiStep === 2 && !aiGenerating && (
              <>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-400">問題 {aiQaIdx + 1} / {(AI_QUESTIONS[aiTopic] ?? []).length}</p>
                  <div className="h-1 flex-1 mx-3 bg-warm-200 rounded-full overflow-hidden">
                    <div className="h-full bg-terra-400 rounded-full transition-all" style={{ width: `${((aiQaIdx + 1) / (AI_QUESTIONS[aiTopic]?.length ?? 1)) * 100}%` }} />
                  </div>
                </div>
                <p className="text-sm font-semibold text-ink-800">{(AI_QUESTIONS[aiTopic] ?? [])[aiQaIdx]}</p>
                <div className={`relative rounded-xl border overflow-hidden ${listeningField === 'ai-answer' ? 'border-red-400' : 'border-warm-200'}`}>
                  <div className="flex justify-end px-3 pt-2">
                    <VoiceButton fieldKey="ai-answer" listeningField={listeningField} setListeningField={setListeningField}
                      onResult={(t) => setAiCurrentAnswer((p) => p + t)} />
                  </div>
                  <textarea placeholder="輸入你的回答..." value={aiCurrentAnswer}
                    onChange={(e) => setAiCurrentAnswer(e.target.value)}
                    className="w-full px-4 pb-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none resize-none bg-white"
                    style={{ minHeight: '100px' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={nextAiQuestion} disabled={!aiCurrentAnswer.trim()}
                    className="flex-1 h-10 rounded-xl bg-terra-500 text-sm font-semibold text-white hover:bg-terra-700 disabled:opacity-40 transition-colors shadow-[var(--shadow-warm-sm)]">
                    {aiQaIdx + 1 < (AI_QUESTIONS[aiTopic]?.length ?? 0) ? '下一題 →' : '生成日誌 ✓'}
                  </button>
                  <button onClick={() => setAiStep(1)} className="h-10 px-3 rounded-xl border border-warm-200 text-sm text-ink-400 hover:text-ink-700">取消</button>
                </div>
              </>
            )}
            {aiStep === 2 && aiGenerating && (
              <div className="flex flex-col items-center py-10 gap-3">
                <Spinner className="h-8 w-8 text-terra-500" />
                <p className="text-sm text-ink-500">AI 正在整理你的日誌...</p>
              </div>
            )}
            {aiStep === 3 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sage-500">✓</span>
                  <p className="text-sm font-semibold text-ink-800">AI 已生成日誌內容，請確認並修改</p>
                </div>
                <p className="text-xs text-ink-400">已切換到 STAR 格式，你可以在上方直接編輯內容，完成後點擊「儲存日誌」</p>
                <button onClick={() => updateDraft('template', 'star')}
                  className="text-xs text-terra-500 hover:text-terra-700 transition-colors">切換到 STAR 格式編輯 →</button>
              </div>
            )}
          </div>
        )}

        {/* Tags */}
        <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-700">🏷 標籤</p>
            <button onClick={handleAiTag} disabled={aiTagging}
              className="flex items-center gap-1 text-xs text-terra-500 hover:text-terra-700 disabled:opacity-40 transition-colors">
              {aiTagging ? <Spinner /> : '🤖'} AI 建議標籤
            </button>
          </div>
          <input placeholder="用逗號分隔，例如：溝通、跨部門、專案管理"
            value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            className="w-full rounded-lg border border-warm-200 px-3 py-2 text-xs text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
          {tagInput && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {tagInput.split(',').map((t) => t.trim()).filter(Boolean).map((t) => (
                <span key={t} className="rounded-full border border-terra-200 bg-terra-50 px-2.5 py-0.5 text-[11px] text-terra-600">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Image upload */}
        <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
          <p className="text-xs font-semibold text-ink-700">📷 附加圖片（選填）</p>
          <p className="text-[10px] text-ink-400">支援 JPG、PNG，單張最大 5MB，最多 3 張</p>

          {/* Previews */}
          {(draft.images ?? []).length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {(draft.images ?? []).map((img, i) => (
                <div key={i} className="relative group">
                  <img src={img.url} alt="" onClick={() => setLightboxUrl(img.url)}
                    className="h-20 w-20 rounded-xl object-cover cursor-pointer hover:opacity-80 transition-opacity border border-warm-200" />
                  <button onClick={() => updateDraft('images', (draft.images ?? []).filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  {img.aiDescription && <p className="text-[9px] text-ink-400 mt-0.5 max-w-[80px] truncate">{img.aiDescription}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Upload buttons */}
          {(draft.images ?? []).length < 3 && (
            <div className="flex gap-2">
              <button onClick={() => uploadRef.current?.click()} disabled={uploadingImg}
                className="flex items-center gap-1.5 rounded-lg border border-warm-200 bg-cream-50 px-4 py-2 text-sm text-ink-500 hover:border-terra-300 hover:bg-terra-50 transition-all disabled:opacity-50">
                {uploadingImg ? <Spinner className="h-3.5 w-3.5" /> : '📎'} 上傳圖片
              </button>
              {isMobile && (
                <button
                  onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = (e) => handleImageFiles((e.target as HTMLInputElement).files); i.click() }}
                  disabled={uploadingImg}
                  className="flex items-center gap-1.5 rounded-lg border border-warm-200 bg-cream-50 px-4 py-2 text-sm text-ink-500 hover:border-terra-300 hover:bg-terra-50 transition-all disabled:opacity-50">
                  📷 拍照
                </button>
              )}
              <input ref={uploadRef} type="file" accept="image/jpeg,image/png" multiple className="hidden"
                onChange={(e) => handleImageFiles(e.target.files)} />
            </div>
          )}

          {imgToast && <p className="text-xs text-terra-500">{imgToast}</p>}
        </div>

        {/* Save */}
        <div className="flex gap-3">
          <button onClick={saveEntry} disabled={saving}
            className="flex-1 rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 disabled:opacity-40 transition-colors shadow-[var(--shadow-warm-sm)] flex items-center justify-center gap-2">
            {saving ? <><Spinner className="h-4 w-4" /> 生成標題中...</> : (isNew ? '儲存日誌' : '更新日誌')}
          </button>
          <button onClick={() => setView('main')}
            className="rounded-xl border border-warm-200 bg-cream-100 px-5 text-sm text-ink-500 hover:bg-cream-200 transition-colors">
            取消
          </button>
        </div>

        {/* AI image analysis modal */}
        {pendingAnalysisImg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-ink-900">剛上傳的圖片要如何處理？</p>
              <img src={pendingAnalysisImg.url} alt="" className="w-full rounded-xl object-contain max-h-40" />
              <div className="space-y-2">
                <button onClick={() => { analyzeImage(pendingAnalysisImg); }}
                  className="w-full rounded-xl border-2 border-terra-300 bg-white py-2.5 text-sm font-medium text-terra-700 hover:bg-terra-50 transition-colors">
                  🤖 AI 解析圖片內容為文字
                </button>
                <button onClick={() => setPendingAnalysisImg(null)}
                  className="w-full rounded-xl border border-warm-200 bg-white py-2.5 text-sm text-ink-500 hover:bg-cream-100 transition-colors">
                  📎 僅作為附件紀錄
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Analyzing spinner */}
        {analyzingImg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="rounded-2xl bg-white shadow-xl px-8 py-6 flex flex-col items-center gap-3">
              <Spinner className="h-8 w-8 text-terra-500" />
              <p className="text-sm text-ink-500">AI 正在解析圖片內容...</p>
            </div>
          </div>
        )}

        {/* Analysis result modal */}
        {analysisResult && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-ink-900">AI 圖片解析結果</p>
              <div className="rounded-xl bg-cream-50 border border-warm-200 px-4 py-3 text-sm text-ink-700 max-h-60 overflow-y-auto">{analysisResult}</div>
              <div className="flex gap-2">
                <button onClick={applyAnalysis}
                  className="flex-1 rounded-xl bg-terra-500 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors">
                  ✓ 加入日誌內容
                </button>
                <button onClick={() => setAnalysisResult('')}
                  className="flex-1 rounded-xl border border-warm-200 py-2.5 text-sm text-ink-500 hover:bg-cream-100 transition-colors">
                  ✕ 不使用，僅保留圖片
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">×</button>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────

  if (view === 'detail' && detailEntry) {
    const e = detailEntry
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => { setView('main'); setInterviewMatches(null) }} className="text-sm text-ink-400 hover:text-ink-700 transition-colors">← 返回</button>
          <div className="flex gap-2">
            <button onClick={() => startEdit(e)} className="rounded-xl border border-warm-200 bg-white px-3 py-1.5 text-xs text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-colors">✏️ 編輯</button>
            <button onClick={() => deleteEntry(e.id)} className="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-500 hover:bg-red-100 transition-colors">刪除</button>
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-ink-900">{e.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-ink-400">
            <span>{fmtDate(e.date)}</span>
            {e.company && <><span>·</span><span>{e.company}</span></>}
            {e.jobTitle && <span className="text-ink-300">{e.jobTitle}</span>}
          </div>
        </div>

        {(e.situation || e.task || e.action || e.result) ? (
          <div className="space-y-3">
            {[['S — Situation', e.situation], ['T — Task', e.task], ['A — Action', e.action], ['R — Result', e.result]].filter(([, v]) => v).map(([label, content]) => (
              <div key={label as string} className="rounded-xl border border-warm-200 bg-white overflow-hidden">
                <div className="px-4 py-2 bg-cream-50 border-b border-warm-100">
                  <p className="text-xs font-semibold text-ink-600">{label as string}</p>
                </div>
                <p className="px-4 py-3 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{content as string}</p>
              </div>
            ))}
          </div>
        ) : e.content ? (
          <div className="rounded-xl border border-warm-200 bg-white px-4 py-3 text-sm text-ink-700 whitespace-pre-wrap leading-relaxed">{e.content}</div>
        ) : null}

        {(e.tags ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(e.tags ?? []).map((t) => <span key={t} className="rounded-full border border-terra-200 bg-terra-50 px-2.5 py-0.5 text-xs text-terra-600">{t}</span>)}
          </div>
        )}

        {(e.images ?? []).length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {(e.images ?? []).map((img, i) => (
              <div key={i}>
                <img src={img.url} alt="" onClick={() => setLightboxUrl(img.url)}
                  className="h-24 w-24 rounded-xl object-cover cursor-pointer hover:opacity-80 border border-warm-200" />
                {img.aiDescription && <p className="text-[10px] text-ink-400 mt-0.5 max-w-[96px] truncate">{img.aiDescription}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Interview analysis */}
        <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-ink-700">🤖 面試素材分析</p>
            <button onClick={() => analyzeForInterview(e)} disabled={analyzing}
              className="flex items-center gap-1 text-xs text-terra-500 hover:text-terra-700 disabled:opacity-40 transition-colors">
              {analyzing ? <Spinner /> : null} {interviewMatches !== null ? '重新分析' : '分析面試素材'}
            </button>
          </div>
          {analyzing && <div className="py-4 flex justify-center"><Spinner className="h-6 w-6 text-terra-400" /></div>}
          {interviewMatches !== null && !analyzing && (
            interviewMatches.length === 0
              ? <p className="text-xs text-ink-400">未找到相關面試題目，可嘗試補充更多細節後重新分析</p>
              : <div className="space-y-2">
                {interviewMatches.map((m, i) => (
                  <div key={i} className="rounded-xl border border-warm-100 bg-cream-50 p-3">
                    <p className="text-xs font-semibold text-ink-700 mb-1">{m.question_text}</p>
                    <p className="text-[10px] text-ink-400">{m.relevance_reason}</p>
                  </div>
                ))}
              </div>
          )}
        </div>

        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setLightboxUrl(null)}>
            <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
            <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">×</button>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MAIN VIEW
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-5">
      <PageTooltip pageKey="work_journal" />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ink-900">✍ Work Journal</h1>
          <p className="mt-1 text-xs md:text-sm text-ink-500">記錄工作成就 · 整理面試素材</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 rounded-xl bg-terra-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-600 transition-colors shadow-[var(--shadow-warm-xs)]">
          <span className="text-base leading-none">＋</span> 新增日誌
        </button>
      </div>

      {/* Tab bar — icon only on mobile */}
      {(() => {
        const pendingCount = achievements.filter((a) => !a.isConfirmed).length
          + pendingSkills.length
          + insights.filter((i) => !i.isConfirmed).length
        return (
          <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 w-fit shadow-[var(--shadow-warm-xs)]">
            {([
              { key: 'list',     icon: '📋', label: '日誌列表', badge: 0 },
              { key: 'timeline', icon: '📅', label: '時間軸', badge: 0 },
              { key: 'pending',  icon: '📥', label: '待確認', badge: pendingCount },
              { key: 'career',   icon: '🏆', label: '職涯成就', badge: 0 },
            ] as const).map(({ key, icon, label, badge }) => (
              <button key={key} onClick={() => setMainTab(key)}
                className={`relative rounded-lg px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${mainTab === key ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}
                title={label}>
                <span className="md:hidden">{icon}</span>
                <span className="hidden md:inline">
                  {icon} {label}{!!badge && ` (${badge > 9 ? '9+' : badge})`}
                </span>
                {!!badge && <span className="md:hidden absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-terra-500 text-white text-[9px] leading-4 text-center">{badge > 9 ? '9+' : badge}</span>}
              </button>
            ))}
          </div>
        )
      })()}

      {/* ── 日誌列表 ── */}
      {mainTab === 'list' && (
        <div className="space-y-4">
          {/* Search + filter */}
          <div className="flex flex-wrap gap-2">
            <input placeholder="搜尋日誌..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[160px] rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
            <input placeholder="篩選公司" value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)}
              className="w-28 rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
            <input placeholder="篩選標籤" value={filterTag} onChange={(e) => setFilterTag(e.target.value)}
              className="w-24 rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm text-ink-700 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none" />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm text-ink-600 focus:outline-none cursor-pointer">
              <option value="date-desc">最新優先</option>
              <option value="date-asc">最舊優先</option>
              <option value="company">公司 A→Z</option>
            </select>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-warm-200 py-20 space-y-4">
              <span className="text-5xl">✍</span>
              <p className="font-medium text-ink-600">還沒有任何日誌</p>
              <p className="text-sm text-ink-400">記錄你的工作成就，讓面試不再沒話說</p>
              <button onClick={startNew} className="rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">＋ 新增第一篇日誌</button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEntries.map((e) => (
                <div key={e.id}
                  onClick={() => { setDetailEntry(e); setInterviewMatches(null); setView('detail') }}
                  className="cursor-pointer rounded-xl border border-warm-200 bg-white p-4 hover:border-terra-200 hover:shadow-[var(--shadow-warm-sm)] transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-800 text-sm truncate">{e.title || '（無標題）'}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-400">
                        <span>{fmtDate(e.date)}</span>
                        {e.company && <><span>·</span><span>{e.company}</span></>}
                        {e.images?.length ? <span>📷 {e.images.length}</span> : null}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${e.template === 'star' ? 'bg-sage-50 text-sage-600' : e.template === 'ai' ? 'bg-honey-50 text-honey-700' : 'bg-cream-100 text-ink-500'}`}>
                          {e.template === 'star' ? 'STAR' : e.template === 'ai' ? 'AI' : '自由'}
                        </span>
                      </div>
                      {(e.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(e.tags ?? []).slice(0, 4).map((t) => <span key={t} className="rounded-full border border-terra-200 bg-terra-50 px-2 py-0.5 text-[10px] text-terra-600">{t}</span>)}
                          {(e.tags ?? []).length > 4 && <span className="text-[10px] text-ink-300">+{(e.tags ?? []).length - 4}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={(ev) => { ev.stopPropagation(); startEdit(e) }}
                        className="rounded-lg border border-warm-200 px-2 py-1 text-[11px] text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">編輯</button>
                      <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id) }}
                        className="rounded-lg border border-warm-200 px-2 py-1 text-[11px] text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 時間軸 ── */}
      {mainTab === 'timeline' && (
        <div className="space-y-6">
          {timelineGroups.length === 0 ? (
            <div className="py-20 text-center text-ink-400">尚無日誌記錄</div>
          ) : timelineGroups.map(([month, monthEntries]) => (
            <div key={month} className="relative">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-3 w-3 rounded-full bg-terra-400 shrink-0" />
                <p className="text-sm font-semibold text-ink-700">{month}</p>
                <div className="flex-1 h-px bg-warm-200" />
                <span className="text-xs text-ink-400">{monthEntries.length} 篇</span>
              </div>
              <div className="ml-6 border-l-2 border-warm-200 pl-4 space-y-3">
                {monthEntries.map((e) => (
                  <div key={e.id}
                    onClick={() => { setDetailEntry(e); setInterviewMatches(null); setView('detail') }}
                    className="cursor-pointer rounded-xl border border-warm-200 bg-white p-3 hover:border-terra-200 hover:shadow-[var(--shadow-warm-sm)] transition-all relative">
                    <div className="absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full border-2 border-terra-400 bg-white" />
                    <p className="text-sm font-semibold text-ink-800">{e.title || '（無標題）'}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-ink-400">
                      <span>{fmtDate(e.date)}</span>
                      {e.company && <><span>·</span><span>{e.company}</span></>}
                    </div>
                    {(e.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(e.tags ?? []).slice(0, 3).map((t) => <span key={t} className="rounded-full border border-terra-200 bg-terra-50 px-2 py-0.5 text-[10px] text-terra-600">{t}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Top tags */}
          {achievementStats.topTags.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
              <p className="text-xs font-semibold text-ink-700">🏷 常用標籤</p>
              <div className="flex flex-wrap gap-2">
                {achievementStats.topTags.map(([tag, count]) => (
                  <button key={tag} onClick={() => { setMainTab('list'); setFilterTag(tag) }}
                    className="flex items-center gap-1.5 rounded-full border border-terra-200 bg-terra-50 px-3 py-1 text-xs text-terra-700 hover:bg-terra-100 transition-colors">
                    {tag}
                    <span className="font-bold text-terra-500">{count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top companies */}
          {achievementStats.topCompanies.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
              <p className="text-xs font-semibold text-ink-700">🏢 記錄最多的公司</p>
              <div className="space-y-2">
                {achievementStats.topCompanies.map(([company, count]) => (
                  <div key={company} className="flex items-center gap-3">
                    <span className="text-sm text-ink-700 flex-1">{company}</span>
                    <div className="flex-1 max-w-[100px] h-1.5 bg-warm-200 rounded-full overflow-hidden">
                      <div className="h-full bg-terra-400 rounded-full" style={{ width: `${(count / achievementStats.topCompanies[0][1]) * 100}%` }} />
                    </div>
                    <span className="text-xs text-ink-400 w-8 text-right">{count} 篇</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 待確認 ── */}
      {mainTab === 'pending' && (() => {
        const pendingAchievements = achievements.filter((a) => !a.isConfirmed)
        const pendingInsights = insights.filter((i) => !i.isConfirmed)
        const nothingPending = pendingAchievements.length === 0 && pendingSkills.length === 0 && pendingInsights.length === 0
          && !achievementsLoading && !insightsLoading
        return (
        <div className="space-y-5">
          {nothingPending && (
            <div className="py-16 text-center text-ink-400 text-sm leading-relaxed">
              目前沒有待確認的項目。新增日誌後，AI 擷取到的成就與技能會出現在這裡。
            </div>
          )}

          {/* AI 萃取成就 —— 只顯示待確認的 */}
          <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-ink-700">🏆 AI 萃取的成就</p>
              <button
                onClick={handleExtractAchievements}
                disabled={extracting || entries.length === 0}
                className="rounded-full bg-terra-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-terra-600 disabled:opacity-50 transition-colors"
              >
                {extracting ? '萃取中…' : '從日誌萃取成就'}
              </button>
            </div>

            {achievementsLoading ? (
              <p className="text-xs text-ink-400 py-4 text-center">載入中…</p>
            ) : pendingAchievements.length === 0 ? (
              <p className="text-xs text-ink-400 py-4 text-center">沒有待確認的成就，點右上角按鈕從日誌自動萃取。</p>
            ) : (
              <div className="space-y-2">
                {pendingAchievements.map((a) => (
                  <div key={a.id} className="rounded-lg border border-honey-200 bg-honey-50 p-3 space-y-1.5">
                    <button
                      onClick={() => { const e = entries.find((x) => x.id === a.journalId); if (e) { setDetailEntry(e); setInterviewMatches(null); setView('detail') } }}
                      disabled={!a.journalId}
                      className="text-left w-full"
                    >
                      <p className="text-sm text-ink-800">{a.text}{a.metric && <span className="ml-1 font-semibold text-terra-600">（{a.metric}）</span>}</p>
                      <p className="text-[11px] text-ink-400 mt-1">
                        📓 {a.journalTitle || '日誌'}{a.journalDate && ` · ${fmtDate(a.journalDate)}`}{a.company && ` · ${a.company}`}
                      </p>
                      {a.journalExcerpt && (
                        <p className="text-[11px] text-ink-500 mt-1 bg-white border border-warm-100 rounded-lg px-2.5 py-1.5 line-clamp-3">「{a.journalExcerpt}」</p>
                      )}
                    </button>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleAchievementAction(a.id, 'confirm')}
                        disabled={confirmingId === a.id}
                        className="rounded-full border border-terra-300 bg-white px-2.5 py-1 text-[11px] font-medium text-terra-600 hover:bg-terra-50 disabled:opacity-50 transition-colors"
                      >
                        {confirmingId === a.id ? '處理中…' : '✓ 確認正確'}
                      </button>
                      <button
                        onClick={() => handleAchievementAction(a.id, 'dismiss')}
                        disabled={confirmingId === a.id}
                        className="text-[11px] text-ink-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                      >
                        ✕ 刪除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 🎯 待確認技能 */}
          {pendingSkills.length > 0 && (
            <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
              <p className="text-xs font-semibold text-ink-700">🎯 AI 推論的技能</p>
              <div className="space-y-2">
                {pendingSkills.map((s) => (
                  <div key={s.id} className="rounded-lg border border-honey-200 bg-honey-50 p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm text-ink-800">{s.name} <span className="text-[11px] text-ink-400">（{s.category}）</span></p>
                      <p className="text-[11px] text-ink-400 mt-0.5">{s.evidenceCount} 篇日誌佐證</p>
                    </div>
                    <button
                      onClick={() => confirmPendingSkill(s.id)}
                      disabled={skillActionId === s.id}
                      className="shrink-0 rounded-full border border-terra-300 bg-white px-2.5 py-1 text-[11px] font-medium text-terra-600 hover:bg-terra-50 disabled:opacity-50 transition-colors"
                    >
                      {skillActionId === s.id ? '處理中…' : '✓ 確認正確'}
                    </button>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/skills" className="inline-block text-[11px] text-terra-500 hover:text-terra-700 transition-colors">在技能庫查看完整清單 →</Link>
            </div>
          )}

          {/* 💡 職涯洞察 —— 行為模式觀察，跟成就是完全獨立的兩套資料，不進技能庫、不參與履歷生成 */}
          <div className="rounded-xl border border-warm-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-ink-700">💡 觀察</p>
                <p className="text-[11px] text-ink-400 mt-0.5">AI 從多篇日誌歸納出的行為模式，僅供參考，不會用於履歷生成</p>
              </div>
              <button
                onClick={handleAnalyzeInsights}
                disabled={analyzingInsights}
                className="rounded-full bg-terra-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-terra-600 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                {analyzingInsights ? '分析中…' : '重新分析'}
              </button>
            </div>

            {insightStats && (
              <p className="text-xs text-terra-600 bg-terra-50 border border-terra-100 rounded-lg px-3 py-2">
                本次擷取 {insightStats.total} 條，通過驗證 {insightStats.passed} 條，{insightStats.rejected} 條因證據不足或無法比對原文而丟棄
              </p>
            )}
            {insightError && (
              <p className="text-xs text-ink-400 bg-cream-50 border border-warm-100 rounded-lg px-3 py-2">{insightError}</p>
            )}

            {insightsLoading ? (
              <p className="text-xs text-ink-400 py-4 text-center">載入中…</p>
            ) : pendingInsights.length === 0 ? (
              <p className="text-xs text-ink-400 py-6 text-center leading-relaxed">目前沒有待確認的觀察。日誌累積得再多一些，點「重新分析」看看有沒有新發現。</p>
            ) : (
              <div className="space-y-2">
                {pendingInsights.map((ins) => {
                  const isExpanded = expandedInsight === ins.id
                  return (
                    <div key={ins.id} className={`rounded-lg border p-3 space-y-1.5 ${ins.isConfirmed ? 'border-sage-200 bg-sage-50' : 'border-honey-200 bg-honey-50'}`}>
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] shrink-0 mt-0.5">{ins.isConfirmed ? '🟢' : '🟡'}</span>
                        <p className="text-sm text-ink-800 flex-1">{ins.text}</p>
                      </div>
                      <div className="flex items-center gap-3 pl-5">
                        <button
                          onClick={() => setExpandedInsight(isExpanded ? null : ins.id)}
                          className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          來自 {ins.evidenceCount} 篇日誌 {isExpanded ? '▲' : '▼'}
                        </button>
                        <button
                          onClick={() => copyInsight(ins.text)}
                          className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          複製文字
                        </button>
                        {!ins.isConfirmed && (
                          <>
                            <button
                              onClick={() => handleInsightAction(ins.id, 'confirm')}
                              disabled={insightActionId === ins.id}
                              className="text-[11px] font-medium text-terra-600 hover:text-terra-700 disabled:opacity-50 transition-colors"
                            >
                              ✓ 這確實是我
                            </button>
                            <button
                              onClick={() => handleInsightAction(ins.id, 'dismiss')}
                              disabled={insightActionId === ins.id}
                              className="text-[11px] text-ink-400 hover:text-red-400 disabled:opacity-50 transition-colors"
                            >
                              ✕ 不太準確
                            </button>
                          </>
                        )}
                      </div>
                      {isExpanded && (
                        <div className="pl-5 space-y-1.5 pt-1">
                          {ins.evidence.map((e) => (
                            <div key={e.journalId} className="text-xs bg-white border border-warm-100 rounded-lg px-3 py-2">
                              <p className="text-ink-400 mb-0.5">· {e.journalTitle || e.journalId}{e.journalDate && ` · ${fmtDate(e.journalDate)}`}</p>
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

        </div>
        )
      })()}

      {/* ── 職涯成就 ── */}
      {mainTab === 'career' && (() => {
        const confirmedAchievements = achievements.filter((a) => a.isConfirmed)
        const quantAchievements = confirmedAchievements.filter((a) => a.metric)
        const qualAchievements = confirmedAchievements.filter((a) => !a.metric)
        const confirmedInsights = insights.filter((i) => i.isConfirmed)
        const nothingConfirmed = confirmedAchievements.length === 0 && achievementStats.starEntries.length === 0 && confirmedInsights.length === 0

        const renderAchievementCard = (a: CareerAchievementItem) => (
          <div key={a.id} className="group relative rounded-lg border border-warm-200 bg-white p-3 space-y-1.5">
            <button
              onClick={() => { const e = entries.find((x) => x.id === a.journalId); if (e) { setDetailEntry(e); setInterviewMatches(null); setView('detail') } }}
              disabled={!a.journalId}
              className="text-left w-full pr-10"
            >
              <p className="text-sm text-ink-800">{a.text}{a.metric && <span className="ml-1 font-semibold text-terra-600">（{a.metric}）</span>}</p>
              <p className="text-[11px] text-ink-400 mt-1">
                📓 {a.journalTitle || '日誌'}{a.journalDate && ` · ${fmtDate(a.journalDate)}`}{a.company && ` · ${a.company}`}
              </p>
              {a.journalExcerpt && (
                <p className="text-[11px] text-ink-500 mt-1 bg-cream-50 border border-warm-100 rounded-lg px-2.5 py-1.5 line-clamp-3">「{a.journalExcerpt}」</p>
              )}
            </button>
            <button
              onClick={() => handleAchievementAction(a.id, 'dismiss')}
              disabled={confirmingId === a.id}
              className="absolute top-2 right-2 text-[11px] text-ink-300 opacity-0 group-hover:opacity-100 hover:text-red-400 disabled:opacity-50 transition-opacity"
            >
              ✕ 刪除
            </button>
          </div>
        )

        return (
        <div className="space-y-5">
          {nothingConfirmed && (
            <div className="py-16 text-center text-ink-400 text-sm leading-relaxed">
              還沒有已確認的成就。到「待確認」頁面審核 AI 擷取的結果，確認後會出現在這裡。
            </div>
          )}

          {/* 📊 量化成就 */}
          {quantAchievements.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-700">📊 量化成就</p>
              <div className="space-y-2">{quantAchievements.map(renderAchievementCard)}</div>
            </div>
          )}

          {/* 📝 質化成就 */}
          {qualAchievements.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-700">📝 質化成就</p>
              <div className="space-y-2">{qualAchievements.map(renderAchievementCard)}</div>
            </div>
          )}

          {/* ⭐ STAR 成就精選 */}
          {achievementStats.starEntries.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-700">⭐ STAR 成就精選</p>
              {achievementStats.starEntries.map((e) => (
                <div key={e.id}
                  onClick={() => { setDetailEntry(e); setInterviewMatches(null); setView('detail') }}
                  className="cursor-pointer rounded-xl border border-warm-200 bg-white p-4 hover:border-terra-200 hover:shadow-[var(--shadow-warm-sm)] transition-all">
                  <p className="text-sm font-semibold text-ink-800 mb-1">{e.title}</p>
                  {e.result && <p className="text-xs text-ink-500 line-clamp-2">R: {e.result}</p>}
                  <div className="flex items-center gap-2 mt-2 text-xs text-ink-400">
                    <span>{fmtDate(e.date)}</span>
                    {e.company && <><span>·</span><span>{e.company}</span></>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 💡 觀察（職涯洞察）—— 唯讀顯示，不提供動作 */}
          {confirmedInsights.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-ink-700">💡 觀察</p>
              <div className="space-y-2">
                {confirmedInsights.map((ins) => {
                  const isExpanded = expandedInsight === ins.id
                  return (
                    <div key={ins.id} className="rounded-lg border border-sage-200 bg-sage-50 p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-[10px] shrink-0 mt-0.5">🟢</span>
                        <p className="text-sm text-ink-800 flex-1">{ins.text}</p>
                      </div>
                      <div className="flex items-center gap-3 pl-5">
                        <button
                          onClick={() => setExpandedInsight(isExpanded ? null : ins.id)}
                          className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          來自 {ins.evidenceCount} 篇日誌 {isExpanded ? '▲' : '▼'}
                        </button>
                        <button
                          onClick={() => copyInsight(ins.text)}
                          className="text-[11px] text-ink-400 hover:text-ink-600 transition-colors"
                        >
                          複製文字
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="pl-5 space-y-1.5 pt-1">
                          {ins.evidence.map((e) => (
                            <div key={e.journalId} className="text-xs bg-white border border-warm-100 rounded-lg px-3 py-2">
                              <p className="text-ink-400 mb-0.5">· {e.journalTitle || e.journalId}{e.journalDate && ` · ${fmtDate(e.journalDate)}`}</p>
                              <p className="text-ink-600">「{e.excerpt}」</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">×</button>
        </div>
      )}
    </div>
  )
}
