'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { PageTooltip } from '@/components/onboarding/page-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ProgressRing } from '@/components/ui/progress-ring'
import { RateLimitToast } from '@/components/ui/rate-limit-toast'

// ── Types ─────────────────────────────────────────────────────────────────────

type AppStatus =
  | 'saved'
  | 'applied'
  | 'hr_screen'
  | 'manager_interview'
  | 'gm_interview'
  | 'offer'
  | 'rejected'

interface InterviewNote { id: string; date: string; interviewer: string; notes: string }
interface Attachment { name: string; url: string }

interface MatchImprovement {
  skill: string
  priority: 'high' | 'medium' | 'low'
  suggestion: string
  resources: string[]
}

interface MatchAnalysis {
  matchScore: number
  jdRequiredSkills: string[]
  matchedSkills: { skill: string; userSkill: string }[]
  partialSkills: { skill: string; userSkill: string; gap: string }[]
  missingSkills: string[]
  fullReport: {
    summary: string
    strengths: string[]
    improvements: MatchImprovement[]
  }
  analyzedAt: string
}

interface Application {
  id: string
  jobTitle: string
  company: string
  industry?: string
  location?: string
  status: AppStatus
  sourcePlatform?: string
  sourceUrl?: string
  salaryMin?: number
  salaryMax?: number
  matchScore?: number
  matchedSkills?: string[]
  missingSkills?: string[]
  matchAnalysis?: MatchAnalysis
  jdFullText?: string
  deadline?: string
  appliedAt?: string
  hrScreenAt?: string
  managerInterviewAt?: string
  gmInterviewAt?: string
  offerAt?: string
  interviewNotes?: InterviewNote[]
  attachments?: Attachment[]
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  notes?: string
  createdAt: string
  linked_resume_id?: string
}

interface ExtractedJob {
  company_zh?: string | null
  company_en?: string | null
  title_zh?: string | null
  title_en?: string | null
  location?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_text?: string | null
  industry?: string | null
  job_type?: string | null
  deadline?: string | null
  source_platform?: string | null
  jd_content?: string | null
  required_skills?: string[] | null
  experience_required?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const KANBAN_COLS: { status: AppStatus; label: string; colBg: string; dot: string }[] = [
  { status: 'saved',             label: '已儲存',     colBg: 'bg-warm-100',  dot: 'bg-zinc-400' },
  { status: 'applied',           label: '已投遞',     colBg: 'bg-honey-50',  dot: 'bg-honey-500' },
  { status: 'hr_screen',         label: '人資初篩',   colBg: 'bg-terra-50',  dot: 'bg-terra-300' },
  { status: 'manager_interview', label: '主管面試',   colBg: 'bg-terra-50',  dot: 'bg-terra-500' },
  { status: 'gm_interview',      label: '總經理面試', colBg: 'bg-terra-50',  dot: 'bg-terra-600' },
  { status: 'offer',             label: 'Offer',      colBg: 'bg-sage-50',   dot: 'bg-sage-500' },
  { status: 'rejected',          label: '未錄取',     colBg: 'bg-cream-200', dot: 'bg-red-400' },
]

const STATUS_MAP = Object.fromEntries(
  KANBAN_COLS.map((c) => [c.status, c])
) as Record<AppStatus, typeof KANBAN_COLS[0]>

const LOCATIONS = ['台北市', '新北市', '桃園市', '台中市', '台南市', '高雄市', '遠端', '海外']
const PLATFORMS = ['104', 'LinkedIn', 'Cake.me', 'Yourator', '公司官網', '獵頭介紹', '其他']
const APPS_KEY = 'job-tracker-apps'

const INDUSTRIES = [
  '科技/軟體', '半導體', '電子製造', '金融/銀行', '保險', '電商', '零售',
  '醫療/生技', '製造業', '物流/供應鏈', '顧問/管理顧問', '廣告/行銷',
  '媒體/出版', '教育', '政府/非營利', '新創', '外商',
] as const

const URL_LOAD_STEPS = ['正在讀取職缺頁面...', 'AI 正在擷取職缺資訊...', '整理完成，請確認資料'] as const

const DATE_STAGES = [
  { key: 'createdAt',          label: '建立',        readonly: true,  warn: false },
  { key: 'appliedAt',          label: '投遞日期',    readonly: false, warn: false },
  { key: 'deadline',           label: '截止日期',    readonly: false, warn: true  },
  { key: 'hrScreenAt',         label: '人資初篩',    readonly: false, warn: false },
  { key: 'managerInterviewAt', label: '主管面試',    readonly: false, warn: false },
  { key: 'gmInterviewAt',      label: '總經理面試',  readonly: false, warn: false },
  { key: 'offerAt',            label: 'Offer 收到',  readonly: false, warn: false },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function fmtDate(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

function fmtSalary(min?: number, max?: number) {
  if (!min) return ''
  const fmt = (n: number) => n >= 10000 ? `${(n / 10000).toFixed(0)}萬` : n.toLocaleString()
  return max ? `${fmt(min)}~${fmt(max)}` : `${fmt(min)}+`
}

function scoreColor(s?: number) {
  if (s === undefined) return ''
  return s >= 70 ? 'text-sage-600' : s >= 50 ? 'text-honey-500' : 'text-red-400'
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(0, mins)} 分鐘前`
  if (mins < 1440) return `${Math.floor(mins / 60)} 小時前`
  return `${Math.floor(mins / 1440)} 天前`
}

function getMatchLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: '高度匹配，強烈建議投遞', color: 'text-sage-600' }
  if (score >= 70) return { text: '良好匹配，值得投遞', color: 'text-sage-500' }
  if (score >= 50) return { text: '部分匹配，可投遞但需補強', color: 'text-honey-600' }
  return { text: '匹配度偏低，建議先補強技能', color: 'text-terra-500' }
}

function deadlineDays(deadline?: string): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
}

async function loadProfileSkills(): Promise<string[]> {
  const skills = new Set<string>()

  // Source 1: career-skills (Dashboard Skills page) → [{name, category}]
  try {
    const res = await fetch('/api/skills')
    if (res.ok) {
      const { skills: arr } = await res.json() as { skills: { name: string }[] }
      arr.forEach((s) => { if (s?.name) skills.add(s.name) })
    }
  } catch { /* ignore */ }

  // Source 2: profile skillmap (Profile Library, now DB-backed)
  try {
    const res = await fetch('/api/profile')
    if (res.ok) {
      const { skillMap } = await res.json() as { skillMap: Record<string, string[]> }
      Object.values(skillMap ?? {}).forEach((arr) => {
        if (Array.isArray(arr)) arr.forEach((s) => { if (s) skills.add(s) })
      })
    }
  } catch { /* ignore */ }

  // Source 3: career-journal-skills (AI-analyzed from journals — still a local cache)
  try {
    const js = localStorage.getItem('career-journal-skills')
    if (js) {
      const arr = JSON.parse(js)
      if (Array.isArray(arr)) arr.forEach((s: string | { name?: string }) => {
        if (typeof s === 'string') skills.add(s)
        else if (s?.name) skills.add(s.name)
      })
    }
  } catch { /* ignore */ }

  // Source 4: resumes (parsed resume skill lists, now DB-backed)
  try {
    const res = await fetch('/api/resumes')
    if (res.ok) {
      const { resumes } = await res.json() as { resumes: { data?: { skills?: string[] } }[] }
      resumes.forEach((r) => {
        if (Array.isArray(r.data?.skills)) r.data!.skills!.forEach((s) => { if (s) skills.add(s) })
      })
    }
  } catch { /* ignore */ }

  return [...skills].filter(Boolean)
}

function emptyDraft(): Omit<Application, 'id' | 'createdAt'> {
  return {
    jobTitle: '', company: '', industry: '', location: '', status: 'saved',
    sourcePlatform: '', sourceUrl: '',
    salaryMin: undefined, salaryMax: undefined,
    deadline: '', notes: '', jdFullText: '',
    interviewNotes: [], attachments: [],
    contactName: '', contactEmail: '', contactPhone: '',
  }
}


function hasInterviewRecordsForJob(company: string, jobTitle: string): boolean {
  try {
    const rr = localStorage.getItem('interview-records')
    if (!rr) return false
    const records = JSON.parse(rr) as { company?: string; title?: string }[]
    const q = (s: string) => s.toLowerCase()
    return records.some(
      (r) => (r.company && q(r.company).includes(q(company))) ||
             (r.title && q(r.title).includes(q(jobTitle)))
    )
  } catch { return false }
}

interface CachedAnalysis { id: string; jobId: string | null; company: string; analyzedAt: string }

function loadCachedAnalyses(): CachedAnalysis[] {
  try {
    const raw = localStorage.getItem('company-analyses')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as CachedAnalysis[] : []
  } catch { return [] }
}

function hasCompanyAnalysisForJob(company: string): boolean {
  try {
    return loadCachedAnalyses().some((r) => r.company.toLowerCase().includes(company.toLowerCase()))
  } catch { return false }
}

function getAnalysisStatusForApp(app: { id: string; company: string; jdFullText?: string; createdAt: string }): 'done' | 'pending' | 'none' {
  if (!app.jdFullText) return 'none'
  const cached = loadCachedAnalyses()
  if (cached.some((r) => r.jobId === app.id)) return 'done'
  const ageMin = (Date.now() - new Date(app.createdAt).getTime()) / 60000
  if (ageMin > 5) return 'pending'
  return 'none'
}

async function triggerBackgroundAnalysis(app: { id: string; company: string; jobTitle?: string; industry?: string; jdFullText?: string }) {
  if (!app.jdFullText || !app.company) return
  try {
    await Promise.all([
      fetch(`/api/salary?${new URLSearchParams({ role: app.jobTitle || '', experience: '不限' })}`).then(r => r.json()).catch(() => null),
      fetch('/api/analytics/company-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: app.company, title: app.jobTitle || '', jd_content: app.jdFullText }),
      }).then(r => r.json()).catch(() => null),
    ]).then(([salaryData, deepReport]) => {
      try {
        const existing = loadCachedAnalyses() as unknown as Record<string, unknown>[]
        const idx = existing.findIndex((r) => r.jobId === app.id)
        const record = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          jobId: app.id, company: app.company,
          title: app.jobTitle || '', industry: app.industry || '',
          salaryData, deepReport,
          analyzedAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        }
        const next = idx >= 0 ? [...existing.slice(0, idx), record, ...existing.slice(idx + 1)] : [record, ...existing]
        localStorage.setItem('company-analyses', JSON.stringify(next))
      } catch { /* quota */ }
    })
  } catch { /* silent */ }
}

type SortKey = 'company' | 'jobTitle' | 'status' | 'matchScore' | 'appliedAt' | 'salaryMin' | 'createdAt'

// ── Spinner ───────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ApplicationTrackerPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [mainView, setMainView] = useState<'main' | 'add' | 'detail'>('main')
  const [selectedApp, setSelectedApp] = useState<Application | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'jd' | 'interview' | 'notes'>('overview')
  const [addTab, setAddTab] = useState<'url' | 'paste' | 'manual'>('url')
  const [showFilter, setShowFilter] = useState(false)

  // Filter
  const [filterStatus, setFilterStatus] = useState<AppStatus[]>([])
  const [filterCompany, setFilterCompany] = useState('')
  const [filterScoreMin, setFilterScoreMin] = useState(0)

  // Drag
  const dragAppId = useRef<string | null>(null)

  // Add form
  const [draft, setDraft] = useState(emptyDraft())
  const [jdPasteText, setJdPasteText] = useState('')
  const [jdParsing, setJdParsing] = useState(false)
  const [jdParsed, setJdParsed] = useState(false)
  const [industryShowCustom, setIndustryShowCustom] = useState(false)
  const jdTextareaRef = useRef<HTMLTextAreaElement>(null)

  // URL extraction
  const [urlInput, setUrlInput] = useState('')
  const [urlExtracting, setUrlExtracting] = useState(false)
  const [urlLoadStep, setUrlLoadStep] = useState(0)
  const [urlExtracted, setUrlExtracted] = useState<ExtractedJob | null>(null)
  const [urlError, setUrlError] = useState('')
  const [urlConfirmDraft, setUrlConfirmDraft] = useState<Partial<Application>>({})

  // List sort
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortAsc, setSortAsc] = useState(false)

  // Detail - interview note
  const [newNote, setNewNote] = useState({ date: '', interviewer: '', notes: '' })
  const [addingNote, setAddingNote] = useState(false)

  // Match score analysis
  const [analyzingMatch, setAnalyzingMatch] = useState(false)
  const [bgAnalyzing, setBgAnalyzing] = useState(false)
  const [profileSkills, setProfileSkills] = useState<string[]>([])
  const [linkedResume, setLinkedResume] = useState<{ id: string; name: string; score: number | null; createdAt: string } | null>(null)
  const [rateLimitToast, setRateLimitToast] = useState(false)
  const autoAnalyzed = useRef<Set<string>>(new Set())
  const autoCompanyAnalyzed = useRef<Set<string>>(new Set())

  // ── Load ──────────────────────────────────────────────────────────────────
  // Applications now persist server-side. On first load with no DB rows yet,
  // migrate whatever was sitting in localStorage from the old client-only version once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/tracker')
        if (!res.ok) return
        const { applications: dbApps } = await res.json() as { applications: Application[] }
        if (dbApps.length > 0) { setApps(dbApps); return }

        const raw = localStorage.getItem(APPS_KEY)
        if (!raw) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parsed: any[] = JSON.parse(raw)
        if (parsed.length === 0) return
        // Migrate removed statuses: written_test → hr_screen, bg_check → offer
        const migrated = parsed.map((a) => ({
          ...a,
          status: a.status === 'written_test' ? 'hr_screen'
                : a.status === 'bg_check'     ? 'offer'
                : a.status,
        })) as Application[]
        const putRes = await fetch('/api/tracker', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applications: migrated }),
        })
        if (putRes.ok) {
          const { applications: fresh } = await putRes.json()
          setApps(fresh)
        }
      } catch { /* ignore */ }
    })()
    loadProfileSkills().then(setProfileSkills)
  }, [])

  useEffect(() => {
    const id = selectedApp?.linked_resume_id
    if (!id) { setLinkedResume(null); return }
    fetch('/api/resumes').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const found = (res.resumes as { id: string; name: string; score: number | null; createdAt: string }[])
        .find((r) => r.id === id)
      setLinkedResume(found ?? null)
    }).catch(() => { /* ignore */ })
  }, [selectedApp?.linked_resume_id])

  // Background auto-analyze skill match when entering detail view
  useEffect(() => {
    if (mainView !== 'detail' || !selectedApp?.jdFullText) return
    if (selectedApp.matchAnalysis) return
    if (autoAnalyzed.current.has(selectedApp.id)) return
    if (profileSkills.length === 0) return
    autoAnalyzed.current.add(selectedApp.id)
    setBgAnalyzing(true)
    doAnalyzeMatch(selectedApp, false).finally(() => setBgAnalyzing(false))
  }, [mainView, selectedApp?.id, profileSkills.length]) // eslint-disable-line

  // Background auto company analysis when entering detail view (fire-and-forget)
  useEffect(() => {
    if (mainView !== 'detail' || !selectedApp?.jdFullText || !selectedApp?.company) return
    if (autoCompanyAnalyzed.current.has(selectedApp.id)) return
    const already = loadCachedAnalyses().some((r) => r.jobId === selectedApp.id)
    if (already) return
    autoCompanyAnalyzed.current.add(selectedApp.id)
    triggerBackgroundAnalysis(selectedApp).catch(() => {})
  }, [mainView, selectedApp?.id]) // eslint-disable-line

  function persist(next: Application[]) {
    setApps(next)
    fetch('/api/tracker', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applications: next }),
    }).then(async (res) => {
      if (res.ok) {
        const { applications: fresh } = await res.json() as { applications: Application[] }
        setApps(fresh)
      }
    }).catch(() => { /* keep optimistic local state on network failure */ })
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const interviewingCount = apps.filter((a) =>
    ['hr_screen', 'manager_interview', 'gm_interview'].includes(a.status)
  ).length
  const offerCount = apps.filter((a) => a.status === 'offer').length
  const thisMonthCount = useMemo(() => {
    const now = new Date()
    return apps.filter((a) => {
      const d = new Date(a.createdAt)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
  }, [apps])

  // ── Filtered & sorted ─────────────────────────────────────────────────────
  const filteredApps = useMemo(() => {
    let result = [...apps]
    if (filterStatus.length > 0) result = result.filter((a) => filterStatus.includes(a.status))
    if (filterCompany.trim()) {
      const q = filterCompany.toLowerCase()
      result = result.filter((a) =>
        a.company.toLowerCase().includes(q) || a.jobTitle.toLowerCase().includes(q)
      )
    }
    if (filterScoreMin > 0) result = result.filter((a) => (a.matchScore ?? 0) >= filterScoreMin)
    result.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortKey]
      const bv = (b as unknown as Record<string, unknown>)[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return sortAsc ? av - bv : bv - av
      return sortAsc
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
    return result
  }, [apps, filterStatus, filterCompany, filterScoreMin, sortKey, sortAsc])

  const activeFiltersCount = filterStatus.length + (filterCompany ? 1 : 0) + (filterScoreMin > 0 ? 1 : 0)

  // ── Handlers ──────────────────────────────────────────────────────────────

  function updateStatus(id: string, status: AppStatus) {
    persist(apps.map((a) => a.id === id ? { ...a, status } : a))
    setSelectedApp((p) => p?.id === id ? { ...p, status } : p)
  }

  function deleteApp(id: string) {
    if (!confirm('確定刪除此職缺記錄？')) return
    persist(apps.filter((a) => a.id !== id))
    if (selectedApp?.id === id) { setMainView('main'); setSelectedApp(null) }
  }

  function onDragStart(appId: string) { dragAppId.current = appId }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent, status: AppStatus) {
    e.preventDefault()
    if (dragAppId.current) { updateStatus(dragAppId.current, status); dragAppId.current = null }
  }

  async function parseJD(text: string) {
    if (!text.trim() || jdParsing) return
    setJdParsing(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: `請從以下 JD 中擷取資訊，以 JSON 格式回傳，僅包含這些欄位：jobTitle, company, location, salaryMin（月薪數字）, salaryMax（月薪數字）, industry（產業別，從以下選擇：${INDUSTRIES.join('、')}、其他）。找不到的欄位省略不填。\n\n${text}`,
          }],
          context: 'jd_parse',
        }),
      })
      const data = await res.json()
      const match = data.reply?.match(/\{[\s\S]*?\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        setDraft((prev) => ({
          ...prev,
          jobTitle:  parsed.jobTitle  ?? prev.jobTitle,
          company:   parsed.company   ?? prev.company,
          location:  parsed.location  ?? prev.location,
          salaryMin: parsed.salaryMin ?? prev.salaryMin,
          salaryMax: parsed.salaryMax ?? prev.salaryMax,
          industry:  parsed.industry  ?? prev.industry,
          jdFullText: text,
        }))
        if (parsed.industry && !(INDUSTRIES as readonly string[]).includes(parsed.industry)) {
          setIndustryShowCustom(true)
        } else {
          setIndustryShowCustom(false)
        }
        setJdParsed(true)
        setAddTab('manual')
      }
    } catch { /* ignore */ }
    finally { setJdParsing(false) }
  }

  async function extractFromUrl() {
    if (!urlInput.trim() || urlExtracting) return
    setUrlExtracting(true)
    setUrlError('')
    setUrlLoadStep(1)

    const step2Timer = setTimeout(() => setUrlLoadStep(2), 4000)
    try {
      const res = await fetch('/api/jobs/extract-from-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      })
      clearTimeout(step2Timer)
      const data = await res.json()

      if (!data.success) {
        setUrlError(data.error || 'fetch_failed')
        setUrlLoadStep(0)
        return
      }

      setUrlLoadStep(3)
      await new Promise(r => setTimeout(r, 500))

      const job: ExtractedJob = data.job || {}
      setUrlConfirmDraft({
        company:        job.company_zh || job.company_en || '',
        jobTitle:       job.title_zh   || job.title_en   || '',
        industry:       job.industry   || '',
        location:       job.location   || '',
        salaryMin:      job.salary_min ? Number(job.salary_min) : undefined,
        salaryMax:      job.salary_max ? Number(job.salary_max) : undefined,
        sourcePlatform: job.source_platform || '',
        sourceUrl:      urlInput.trim(),
        jdFullText:     job.jd_content || '',
        deadline:       job.deadline   || '',
      })
      setUrlExtracted(job)
    } catch {
      clearTimeout(step2Timer)
      setUrlError('fetch_failed')
      setUrlLoadStep(0)
    } finally {
      setUrlExtracting(false)
    }
  }

  function confirmUrlExtracted() {
    const newApp: Application = {
      ...urlConfirmDraft,
      id: genId(),
      createdAt: new Date().toISOString(),
      status: 'saved',
      jobTitle: urlConfirmDraft.jobTitle || '',
      company:  urlConfirmDraft.company  || '',
      interviewNotes: [],
      attachments: [],
    }
    persist([newApp, ...apps])
    setUrlExtracted(null)
    setUrlInput('')
    setUrlLoadStep(0)
    setSelectedApp(newApp)
    setDetailTab('overview')
    setMainView('detail')
  }

  async function doAnalyzeMatch(app: Application, force: boolean) {
    if (!app.jdFullText) return
    if (app.matchAnalysis && !force) return
    if (profileSkills.length === 0) return
    try {
      const res = await fetch(`/api/jobs/${app.id}/analyze-match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdContent: app.jdFullText, userSkills: profileSkills }),
      })
      const data = await res.json()
      if (data.error === 'rate_limit') { setRateLimitToast(true); return }
      if (data.error) return
      const analysis: MatchAnalysis = {
        matchScore: data.matchScore,
        jdRequiredSkills: data.jdRequiredSkills ?? [],
        matchedSkills: data.matchedSkills ?? [],
        partialSkills: data.partialSkills ?? [],
        missingSkills: data.missingSkills ?? [],
        fullReport: data.fullReport ?? { summary: '', strengths: [], improvements: [] },
        analyzedAt: data.analyzedAt,
      }
      const updated: Application = {
        ...app,
        matchAnalysis: analysis,
        matchScore: analysis.matchScore,
        matchedSkills: analysis.matchedSkills.map(m => m.skill),
        missingSkills: analysis.missingSkills,
      }
      persist(apps.map(a => a.id === updated.id ? updated : a))
      setSelectedApp(updated)
    } catch { /* silent */ }
  }

  function saveApp() {
    if (!draft.company.trim() || !draft.jobTitle.trim()) return
    const newApp: Application = {
      ...draft,
      id: genId(),
      createdAt: new Date().toISOString(),
      interviewNotes: [],
      attachments: [],
    }
    persist([newApp, ...apps])
    setDraft(emptyDraft()); setJdPasteText(''); setJdParsed(false)
    setSelectedApp(newApp); setDetailTab('overview'); setMainView('detail')
  }

  function resetAdd() {
    setDraft(emptyDraft()); setJdPasteText(''); setJdParsed(false); setAddTab('url')
    setUrlInput(''); setUrlError(''); setUrlLoadStep(0); setUrlExtracted(null)
    setIndustryShowCustom(false)
  }

  function addInterviewNote() {
    if (!selectedApp || !newNote.date || !newNote.notes) return
    const note: InterviewNote = { id: genId(), ...newNote }
    const updated = { ...selectedApp, interviewNotes: [...(selectedApp.interviewNotes ?? []), note] }
    persist(apps.map((a) => a.id === updated.id ? updated : a))
    setSelectedApp(updated)
    setNewNote({ date: '', interviewer: '', notes: '' }); setAddingNote(false)
  }

  function updateSelectedApp(patch: Partial<Application>) {
    if (!selectedApp) return
    const updated = { ...selectedApp, ...patch }
    persist(apps.map((a) => a.id === updated.id ? updated : a))
    setSelectedApp(updated)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((p) => !p)
    else { setSortKey(key); setSortAsc(true) }
  }
  const si = (key: SortKey) => sortKey === key ? (sortAsc ? ' ↑' : ' ↓') : ''

  // ─────────────────────────────────────────────────────────────────────────
  // ADD VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (mainView === 'add') {
    return (
      <div className="p-4 md:p-8 space-y-5 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => { setMainView('main'); resetAdd() }}
            className="text-sm text-ink-500 hover:text-ink-700 transition-colors">← 返回</button>
          <h1 className="text-lg font-bold text-ink-900">新增職缺</h1>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 shadow-[var(--shadow-warm-xs)]">
          {(['url', 'paste', 'manual'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setAddTab(t)}
              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-150 ${addTab === t ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}>
              {t === 'url' ? '🔗 貼上連結（最快）' : t === 'paste' ? '📋 貼上 JD' : '✏️ 手動填寫'}
            </button>
          ))}
        </div>

        {/* ── URL tab ── */}
        {addTab === 'url' && (
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">職缺頁面網址</label>
                <p className="text-xs text-ink-400 mb-3">支援 104、LinkedIn、Cake.me、Yourator、1111 等平台</p>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-xl border border-warm-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none"
                    placeholder="貼上職缺頁面的網址..."
                    value={urlInput}
                    onChange={(e) => { setUrlInput(e.target.value); setUrlError('') }}
                    disabled={urlExtracting}
                  />
                  <button type="button" onClick={extractFromUrl}
                    disabled={!urlInput.trim() || urlExtracting}
                    className="shrink-0 rounded-xl bg-terra-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-terra-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2">
                    {urlExtracting ? <Spinner /> : null}
                    {urlExtracting ? URL_LOAD_STEPS[Math.max(0, urlLoadStep - 1)] : '自動擷取 →'}
                  </button>
                </div>
              </div>

              {/* Loading steps */}
              {urlExtracting && (
                <div className="space-y-1.5">
                  {URL_LOAD_STEPS.map((step, i) => {
                    const stepNum = i + 1
                    const done   = urlLoadStep > stepNum
                    const active = urlLoadStep === stepNum
                    return (
                      <div key={i} className={`flex items-center gap-2 text-xs transition-colors ${done ? 'text-sage-600' : active ? 'text-terra-500 animate-pulse' : 'text-ink-300'}`}>
                        <span>{done ? '✓' : '○'}</span>
                        <span>{step}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Error state */}
              {urlError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
                  <p className="text-sm text-red-600">
                    {urlError === 'login_required'      && '此職缺頁面需要登入才能查看，請改用「貼上 JD」方式'}
                    {urlError === 'insufficient_content' && '擷取到的內容不足，請改用「貼上 JD」方式手動貼上職缺說明'}
                    {urlError === 'invalid_url'          && '請輸入有效的 http/https 網址'}
                    {urlError === 'rate_limit'           && 'AI 服務目前使用量較高，請稍後再試'}
                    {!['login_required', 'insufficient_content', 'invalid_url', 'rate_limit'].includes(urlError) && '無法自動擷取此連結，請改用「貼上 JD」方式'}
                  </p>
                  {urlError !== 'rate_limit' && urlError !== 'invalid_url' && (
                    <button type="button"
                      onClick={() => { setUrlError(''); setAddTab('paste'); setTimeout(() => jdTextareaRef.current?.focus(), 100) }}
                      className="text-sm font-medium text-terra-500 hover:text-terra-600 transition-colors">
                      → 切換至「貼上 JD」
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Paste JD tab ── */}
        {addTab === 'paste' && (
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1.5">貼上職務說明（JD）</label>
                <textarea ref={jdTextareaRef}
                  className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2.5 text-sm text-ink-900 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none resize-none"
                  style={{ minHeight: '300px' }}
                  placeholder="將 104、LinkedIn 或公司官網的職務說明全文貼於此處，AI 將自動擷取所有資訊..."
                  value={jdPasteText}
                  onChange={(e) => setJdPasteText(e.target.value)}
                  disabled={jdParsing}
                />
              </div>
              {jdParsed && (
                <div className="flex items-center gap-2 rounded-xl border border-sage-500/20 bg-sage-500/8 px-3 py-2">
                  <span className="text-sage-600">✓</span>
                  <p className="text-xs text-sage-700">AI 已擷取完成，請確認並修改資訊</p>
                  <button type="button" onClick={() => setAddTab('manual')}
                    className="ml-auto text-xs font-medium text-terra-500 hover:text-terra-600">查看預覽 →</button>
                </div>
              )}
              <button type="button" onClick={() => parseJD(jdPasteText)}
                disabled={!jdPasteText.trim() || jdParsing}
                className="w-full rounded-xl bg-terra-500 py-2.5 text-sm font-semibold text-white hover:bg-terra-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {jdParsing ? <><Spinner /> 🤖 AI 解析中...</> : '🤖 AI 自動解析'}
              </button>
            </CardContent>
          </Card>
        )}

        {/* ── Manual tab ── */}
        {addTab === 'manual' && (
          <Card>
            <CardContent className="pt-5 space-y-4">
              {jdParsed && (
                <div className="flex items-center gap-2 rounded-xl border border-sage-500/20 bg-sage-500/8 px-3 py-2">
                  <p className="text-xs text-sage-700">🤖 AI 已自動填入，請確認並修改以下資訊</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-ink-500 mb-1">公司名稱 <span className="text-terra-500">*</span></label>
                  <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="例：台積電" value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-medium text-ink-500 mb-1">職位名稱 <span className="text-terra-500">*</span></label>
                  <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="例：資深前端工程師" value={draft.jobTitle} onChange={(e) => setDraft({ ...draft, jobTitle: e.target.value })} />
                </div>

                {/* Industry */}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ink-500 mb-1">產業別</label>
                  <select
                    className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    value={industryShowCustom ? '其他' : (draft.industry ?? '')}
                    onChange={(e) => {
                      if (e.target.value === '其他') {
                        setIndustryShowCustom(true)
                        setDraft({ ...draft, industry: '' })
                      } else {
                        setIndustryShowCustom(false)
                        setDraft({ ...draft, industry: e.target.value || undefined })
                      }
                    }}>
                    <option value="">請選擇</option>
                    {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                    <option value="其他">其他（自訂）</option>
                  </select>
                  {industryShowCustom && (
                    <input
                      className="mt-2 w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      placeholder="請輸入產業別"
                      value={draft.industry ?? ''}
                      onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">工作地點</label>
                  <select className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    value={draft.location ?? ''} onChange={(e) => setDraft({ ...draft, location: e.target.value })}>
                    <option value="">請選擇</option>
                    {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">職缺來源</label>
                  <select className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    value={draft.sourcePlatform ?? ''} onChange={(e) => setDraft({ ...draft, sourcePlatform: e.target.value })}>
                    <option value="">請選擇</option>
                    {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">月薪下限（NTD）</label>
                  <input type="number" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="40000" value={draft.salaryMin ?? ''} onChange={(e) => setDraft({ ...draft, salaryMin: Number(e.target.value) || undefined })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">月薪上限（NTD）</label>
                  <input type="number" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="60000" value={draft.salaryMax ?? ''} onChange={(e) => setDraft({ ...draft, salaryMax: Number(e.target.value) || undefined })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ink-500 mb-1">職缺連結（選填）</label>
                  <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="https://..." value={draft.sourceUrl ?? ''} onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-ink-500 mb-1">JD 全文（選填）</label>
                  <textarea className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none resize-none"
                    rows={4} placeholder="貼上備存..." value={draft.jdFullText ?? ''}
                    onChange={(e) => setDraft({ ...draft, jdFullText: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">截止日期（選填）</label>
                  <input type="date" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    value={draft.deadline ?? ''} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">備注（選填）</label>
                  <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                    placeholder="其他備注..." value={draft.notes ?? ''} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bottom actions (paste / manual only) */}
        {addTab !== 'url' && (
          <div className="flex gap-3">
            <button type="button" onClick={() => { setMainView('main'); resetAdd() }}
              className="flex-1 rounded-xl border border-warm-300 py-2.5 text-sm text-ink-500 hover:border-terra-300 hover:text-terra-500 transition-all">
              ← 取消
            </button>
            <button type="button" onClick={saveApp} disabled={!draft.company.trim() || !draft.jobTitle.trim()}
              className="flex-1 rounded-xl bg-terra-500 py-2.5 text-sm font-semibold text-white hover:bg-terra-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              儲存並分析匹配度
            </button>
          </div>
        )}

        {/* ── URL confirm modal ── */}
        {urlExtracted !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-[var(--shadow-warm-xl)]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-warm-100">
                <div>
                  <h2 className="text-base font-bold text-ink-900">✓ 自動擷取完成，請確認資訊</h2>
                  <p className="text-xs text-ink-400 mt-0.5">以下欄位可直接修改</p>
                </div>
                <button type="button" onClick={() => { setUrlExtracted(null); setUrlLoadStep(0) }}
                  className="text-ink-400 hover:text-ink-600 text-xl leading-none transition-colors">×</button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-ink-500 mb-1">公司名稱 <span className="text-terra-500">*</span></label>
                    <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      value={urlConfirmDraft.company ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, company: e.target.value }))} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-medium text-ink-500 mb-1">職位名稱 <span className="text-terra-500">*</span></label>
                    <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      value={urlConfirmDraft.jobTitle ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, jobTitle: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-ink-500 mb-1">產業別</label>
                    <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      placeholder="例：科技/軟體"
                      value={urlConfirmDraft.industry ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, industry: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">工作地點</label>
                    <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      value={urlConfirmDraft.location ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, location: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">來源平台</label>
                    <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      value={urlConfirmDraft.sourcePlatform ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, sourcePlatform: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">月薪下限（NTD）</label>
                    <input type="number" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      placeholder="40000"
                      value={urlConfirmDraft.salaryMin ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, salaryMin: Number(e.target.value) || undefined }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">月薪上限（NTD）</label>
                    <input type="number" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      placeholder="60000"
                      value={urlConfirmDraft.salaryMax ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, salaryMax: Number(e.target.value) || undefined }))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-500 mb-1">截止日期</label>
                    <input type="date" className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      value={urlConfirmDraft.deadline ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, deadline: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-ink-500 mb-1">JD 全文</label>
                    <textarea className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none resize-none"
                      rows={5}
                      value={urlConfirmDraft.jdFullText ?? ''}
                      onChange={(e) => setUrlConfirmDraft(p => ({ ...p, jdFullText: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-ink-500 mb-1">職缺連結</label>
                    <input readOnly className="w-full rounded-xl border border-warm-100 bg-cream-50 px-3 py-2 text-sm text-ink-500 focus:outline-none"
                      value={urlInput} />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-warm-100 px-5 py-4 flex gap-2">
                <button type="button" onClick={() => { setUrlExtracted(null); setUrlLoadStep(0) }}
                  className="flex-1 rounded-xl border border-warm-300 py-2.5 text-sm text-ink-500 hover:border-terra-300 hover:text-terra-500 transition-all">
                  ✕ 取消
                </button>
                <button type="button"
                  disabled={!urlConfirmDraft.company?.trim() || !urlConfirmDraft.jobTitle?.trim()}
                  onClick={confirmUrlExtracted}
                  className="flex-1 rounded-xl bg-terra-500 py-2.5 text-sm font-semibold text-white hover:bg-terra-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                  ✓ 確認並儲存職缺
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DETAIL VIEW
  // ─────────────────────────────────────────────────────────────────────────
  if (mainView === 'detail' && selectedApp) {
    const app = selectedApp
    return (
      <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button type="button" onClick={() => { setMainView('main'); setSelectedApp(null) }}
              className="shrink-0 text-sm text-ink-500 hover:text-ink-700 transition-colors">← 返回</button>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-ink-900 truncate">{app.company}</h1>
              <p className="text-sm text-ink-500 truncate">{app.jobTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <select value={app.status} onChange={(e) => updateStatus(app.id, e.target.value as AppStatus)}
              className="rounded-xl border border-warm-300 bg-white px-3 py-1.5 text-sm text-ink-700 focus:border-terra-400 focus:outline-none">
              {KANBAN_COLS.map((c) => <option key={c.status} value={c.status}>{c.label}</option>)}
            </select>
            <button type="button" onClick={() => deleteApp(app.id)}
              className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-400 hover:bg-red-50 transition-colors">
              刪除
            </button>
          </div>
        </div>

        {/* Detail tabs */}
        <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 w-full sm:w-fit shadow-[var(--shadow-warm-xs)] overflow-x-auto">
          {([
            { key: 'overview',   label: '① 概覽', mobileLabel: '① 概覽' },
            { key: 'jd',        label: '② JD 分析', mobileLabel: '② JD' },
            { key: 'interview', label: '③ 面試準備', mobileLabel: '③ 面試' },
            { key: 'notes',     label: '④ 備注', mobileLabel: '④ 備注' },
          ] as const).map(({ key, label, mobileLabel }) => (
            <button key={key} type="button" onClick={() => setDetailTab(key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-150 ${detailTab === key ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}>
              <span className="sm:hidden">{mobileLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ① Overview */}
        {detailTab === 'overview' && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>基本資訊</CardTitle></CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                  {([
                    { label: '公司',   value: app.company },
                    { label: '職位',   value: app.jobTitle },
                    { label: '產業',   value: app.industry  || '—' },
                    { label: '地點',   value: app.location  || '—' },
                    { label: '薪資',   value: fmtSalary(app.salaryMin, app.salaryMax) || '—' },
                    { label: '來源',   value: app.sourcePlatform || '—' },
                    { label: '截止日', value: fmtDate(app.deadline) },
                  ]).map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-xs text-ink-400">{label}</dt>
                      <dd className="font-medium text-ink-700 mt-0.5">{value}</dd>
                    </div>
                  ))}
                </dl>
                {app.sourceUrl && (
                  <a href={app.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-4 inline-flex text-xs text-terra-500 hover:text-terra-600">
                    查看原始職缺 →
                  </a>
                )}
              </CardContent>
            </Card>

            {/* AI Match Analysis */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>AI 匹配分析</CardTitle>
                  {app.matchAnalysis && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-ink-300">分析時間：{relativeTime(app.matchAnalysis.analyzedAt)}</span>
                      <button type="button"
                        onClick={() => { setBgAnalyzing(true); doAnalyzeMatch(app, true).finally(() => setBgAnalyzing(false)) }}
                        disabled={bgAnalyzing}
                        className="text-[10px] text-ink-300 hover:text-terra-500 transition-colors disabled:opacity-40">
                        🔄 重新分析
                      </button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!app.jdFullText ? (
                  <div className="py-6 text-center">
                    <p className="text-sm text-ink-400 mb-2">請先在 JD 分析 Tab 填寫職務說明，才能進行匹配分析</p>
                    <button type="button" onClick={() => setDetailTab('jd')}
                      className="text-sm text-terra-500 hover:text-terra-700 transition-colors">前往填寫 JD →</button>
                  </div>
                ) : app.matchAnalysis ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col items-center justify-center rounded-2xl bg-cream-100 p-5">
                        <ProgressRing score={app.matchAnalysis.matchScore} size={90} strokeWidth={7} animate />
                        <p className="text-xs text-ink-500 mt-1">匹配度</p>
                        <p className={`text-xs mt-1 font-medium text-center leading-tight ${getMatchLabel(app.matchAnalysis.matchScore).color}`}>
                          {getMatchLabel(app.matchAnalysis.matchScore).text}
                        </p>
                      </div>
                      <div className="space-y-2.5 overflow-y-auto max-h-52">
                        {app.matchAnalysis.matchedSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-sage-600 mb-1">✓ 已具備</p>
                            <div className="flex flex-wrap gap-1">
                              {app.matchAnalysis.matchedSkills.map(m => (
                                <span key={m.skill} className="rounded-full border border-sage-200 bg-sage-50 px-2 py-0.5 text-xs text-sage-700">{m.skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {app.matchAnalysis.partialSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-honey-600 mb-1">🔶 部分具備</p>
                            <div className="flex flex-wrap gap-1">
                              {app.matchAnalysis.partialSkills.map(m => (
                                <span key={m.skill} title={`差距：${m.gap}`}
                                  className="cursor-help rounded-full border border-honey-200 bg-honey-50 px-2 py-0.5 text-xs text-honey-700">{m.skill}</span>
                              ))}
                            </div>
                          </div>
                        )}
                        {app.matchAnalysis.missingSkills.length > 0 && (
                          <div>
                            <p className="text-xs text-red-400 mb-1">✗ 待補強</p>
                            <div className="flex flex-wrap gap-1">
                              {app.matchAnalysis.missingSkills.map(s => {
                                const imp = app.matchAnalysis!.fullReport.improvements.find(i => i.skill === s)
                                return (
                                  <span key={s} title={imp ? `建議：${imp.suggestion}` : undefined}
                                    className="cursor-help rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600">{s}</span>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => setDetailTab('jd')}
                      className="mt-4 flex items-center gap-1 text-sm text-terra-500 hover:text-terra-700 transition-colors">
                      📋 查看完整技能落差報告 →
                    </button>
                  </>
                ) : bgAnalyzing ? (
                  <div className="grid grid-cols-2 gap-4 animate-pulse">
                    <div className="flex flex-col items-center justify-center rounded-2xl bg-cream-100 p-5 gap-2">
                      <div className="w-[90px] h-[90px] rounded-full bg-warm-200" />
                      <div className="h-3 w-16 bg-warm-200 rounded" />
                    </div>
                    <div className="space-y-3 pt-3">
                      {[70, 90, 55].map(w => <div key={w} className="h-3 bg-warm-200 rounded" style={{ width: `${w}%` }} />)}
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <p className="text-xs text-ink-400 mb-3">
                      {profileSkills.length === 0
                        ? '前往個人資料庫設定技能後，即可自動分析匹配度'
                        : '點擊開始 AI 匹配分析'}
                    </p>
                    {profileSkills.length > 0 && (
                      <button type="button"
                        onClick={() => { setBgAnalyzing(true); doAnalyzeMatch(app, false).finally(() => setBgAnalyzing(false)) }}
                        disabled={bgAnalyzing}
                        className="rounded-xl border-2 border-dashed border-terra-300 px-6 py-3 text-sm text-terra-500 hover:bg-terra-50 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto">
                        <Spinner /> 🤖 分析 AI 匹配分數
                      </button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 📄 此職缺的履歷 (Step 1) ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>📄 此職缺的履歷</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {app.linked_resume_id ? (() => {
                  const res = linkedResume
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sage-500">✓</span>
                        <span className="text-sm font-medium text-ink-700">已有客製化履歷</span>
                      </div>
                      {res && (
                        <div className="rounded-xl border border-warm-200 bg-cream-50 px-4 py-3 space-y-1">
                          <p className="text-sm font-medium text-ink-700">{res.name}</p>
                          <div className="flex items-center gap-3 text-xs text-ink-400">
                            <span>建立於 {relativeTime(res.createdAt)}</span>
                            {res.score !== null && <span className={`font-medium ${res.score >= 80 ? 'text-sage-600' : res.score >= 60 ? 'text-honey-600' : 'text-terra-500'}`}>AI 評分：{res.score} 分</span>}
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <a href={`/resume-lab`}
                          className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-terra-300 hover:text-terra-600 transition-all">
                          編輯履歷
                        </a>
                        <a href={`/resume-lab?jobId=${app.id}&company=${encodeURIComponent(app.company)}&title=${encodeURIComponent(app.jobTitle)}`}
                          className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-terra-300 hover:text-terra-600 transition-all">
                          重新生成
                        </a>
                      </div>
                    </div>
                  )
                })() : (
                  <div className="space-y-3">
                    <p className="text-sm text-ink-400">尚未為此職缺建立客製化履歷</p>
                    <a href={`/resume-lab?jobId=${app.id}&company=${encodeURIComponent(app.company)}&title=${encodeURIComponent(app.jobTitle)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-terra-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                      🎯 針對此職缺建立客製化履歷 →
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Important Dates */}
            <Card>
              <CardHeader><CardTitle>重要日期</CardTitle></CardHeader>
              <CardContent className="space-y-0 px-4 pb-4">
                {DATE_STAGES.map(({ key, label, readonly: ro, warn }) => {
                  const val = (app as unknown as Record<string, string | undefined>)[key]
                  const days = warn ? deadlineDays(val) : null
                  return (
                    <div key={key} className="flex items-center gap-2 py-2 border-b border-warm-100 last:border-0">
                      <span className="text-xs text-ink-400 w-20 shrink-0">{label}</span>
                      {ro ? (
                        <span className="flex-1 text-sm text-ink-700">{fmtDate(val)}</span>
                      ) : (
                        <input
                          type="date"
                          value={val ? val.slice(0, 10) : ''}
                          onChange={e => updateSelectedApp({ [key]: e.target.value || undefined })}
                          className="flex-1 rounded-lg border border-warm-200 bg-white px-2 py-1 text-sm text-ink-700 focus:border-terra-400 focus:outline-none"
                        />
                      )}
                      {warn && days !== null && (
                        <span className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${
                          days < 0 ? 'text-ink-400 bg-warm-100' :
                          days <= 7 ? 'text-red-600 bg-red-50 border border-red-200' :
                          days <= 14 ? 'text-honey-700 bg-honey-50 border border-honey-200' : ''
                        }`}>
                          {days < 0 ? '已截止' : days <= 7 ? `⚠️ 還有 ${days} 天` : days <= 14 ? `還有 ${days} 天` : ''}
                        </span>
                      )}
                    </div>
                  )
                })}
                {/* Timeline visualization */}
                <div className="mt-4 pt-3 border-t border-warm-100">
                  <p className="text-[10px] text-ink-300 mb-3 uppercase tracking-wide">求職時間軸</p>
                  <div className="flex items-center gap-0 overflow-x-auto pb-1">
                    {DATE_STAGES.filter(s => s.key !== 'createdAt').map(({ key, label }, i, arr) => {
                      const val = (app as unknown as Record<string, string | undefined>)[key]
                      const filled = !!val
                      return (
                        <div key={key} className="flex items-center shrink-0">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                              filled ? 'bg-terra-400 border-terra-400' : 'bg-white border-warm-300'
                            }`} />
                            <p className={`text-[9px] mt-1 text-center whitespace-nowrap max-w-[36px] leading-tight ${
                              filled ? 'text-ink-500' : 'text-ink-300'
                            }`}>{label.slice(0, 4)}</p>
                          </div>
                          {i < arr.length - 1 && (
                            <div className={`h-0.5 w-5 ${filled ? 'bg-terra-200' : 'bg-warm-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── 求職準備清單 (Step 5) ── */}
            {(() => {
              const hasResume     = !!app.linked_resume_id
              const hasSkillGap   = !!app.matchAnalysis
              const hasInterview  = hasInterviewRecordsForJob(app.company, app.jobTitle)
              const hasCompanyAna = hasCompanyAnalysisForJob(app.company)
              const allDone       = hasResume && hasSkillGap && hasInterview && hasCompanyAna
              const items = [
                { done: hasResume,     label: '建立客製化履歷',   action: !hasResume ? { label: '建立 →', href: `/resume-lab?jobId=${app.id}&company=${encodeURIComponent(app.company)}&title=${encodeURIComponent(app.jobTitle)}` } : null },
                { done: hasSkillGap,   label: '分析技能落差',     action: !hasSkillGap ? { label: '查看 JD 分析', onClick: () => setDetailTab('jd') } : null },
                { done: hasInterview,  label: '面試題目準備',     action: !hasInterview ? { label: '開始練習 →', href: '/interviews' } : null },
                { done: hasCompanyAna, label: '公司深度分析',     action: !hasCompanyAna ? { label: '查看分析 →', href: '/analytics' } : null },
              ]
              return allDone ? (
                <div className="rounded-xl bg-sage-50 border border-sage-200 px-4 py-4 text-center">
                  <p className="text-sm font-semibold text-sage-700">🎉 此職缺的準備已完成，祝面試順利！</p>
                </div>
              ) : (
                <Card>
                  <CardHeader><CardTitle>✅ 求職準備進度</CardTitle></CardHeader>
                  <CardContent className="space-y-2 pb-4">
                    {items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-1.5 border-b border-warm-100 last:border-0">
                        <span className={`shrink-0 text-base ${item.done ? 'text-sage-500' : 'text-ink-300'}`}>
                          {item.done ? '✅' : '☐'}
                        </span>
                        <span className={`flex-1 text-sm ${item.done ? 'text-sage-700 line-through opacity-60' : 'text-ink-700'}`}>
                          {item.label}
                        </span>
                        {!item.done && item.action && (
                          item.action.href ? (
                            <a href={item.action.href}
                              className="shrink-0 rounded-lg bg-terra-50 border border-terra-200 px-2.5 py-1 text-xs font-medium text-terra-600 hover:bg-terra-100 transition-colors whitespace-nowrap">
                              {item.action.label}
                            </a>
                          ) : (
                            <button type="button"
                              onClick={item.action.onClick}
                              className="shrink-0 rounded-lg bg-terra-50 border border-terra-200 px-2.5 py-1 text-xs font-medium text-terra-600 hover:bg-terra-100 transition-colors whitespace-nowrap">
                              {item.action.label}
                            </button>
                          )
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })()}
          </div>
        )}

        {/* ② JD Analysis */}
        {detailTab === 'jd' && (
          <div className="space-y-4">
            {app.jdFullText ? (
              <Card>
                <CardHeader><CardTitle>JD 全文</CardTitle></CardHeader>
                <CardContent>
                  <textarea
                    className="w-full rounded-xl border border-warm-100 bg-cream-50 px-3 py-2.5 text-sm text-ink-600 leading-relaxed resize-none focus:border-terra-400 focus:outline-none"
                    rows={8}
                    value={app.jdFullText}
                    onChange={e => updateSelectedApp({ jdFullText: e.target.value })}
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-3xl mb-3">📄</p>
                <p className="text-sm text-ink-500">尚未儲存 JD 全文</p>
                <button type="button" onClick={() => { setMainView('add'); setAddTab('paste') }}
                  className="mt-3 text-sm text-terra-500 hover:text-terra-600">新增 JD →</button>
              </div>
            )}

            {/* Skill gap full report */}
            {app.jdFullText && (
              <div id="skill-gap-report" className="space-y-4">
                {app.matchAnalysis ? (
                  <>
                    <p className="text-xs text-ink-300">以下報告與概覽匹配分析共用同一份數據</p>

                    {/* A: Summary stats */}
                    <Card>
                      <CardHeader><CardTitle>技能比對總覽</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl border border-sage-200 bg-sage-50 p-3 text-center">
                            <p className="text-2xl font-bold text-sage-600">{app.matchAnalysis.matchedSkills.length}</p>
                            <p className="text-xs text-sage-600 mt-1">✅ 已具備</p>
                          </div>
                          <div className="rounded-xl border border-honey-200 bg-honey-50 p-3 text-center">
                            <p className="text-2xl font-bold text-honey-600">{app.matchAnalysis.partialSkills.length}</p>
                            <p className="text-xs text-honey-600 mt-1">🔶 部分具備</p>
                          </div>
                          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                            <p className="text-2xl font-bold text-red-500">{app.matchAnalysis.missingSkills.length}</p>
                            <p className="text-xs text-red-500 mt-1">❌ 待補強</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* B: JD skill list */}
                    {app.matchAnalysis.jdRequiredSkills.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>JD 要求技能完整清單</CardTitle></CardHeader>
                        <CardContent>
                          <div className="space-y-0">
                            {app.matchAnalysis.jdRequiredSkills.map(skill => {
                              const isMatched = app.matchAnalysis!.matchedSkills.some(m => m.skill === skill)
                              const isPartial = app.matchAnalysis!.partialSkills.some(m => m.skill === skill)
                              return (
                                <div key={skill} className="flex items-center gap-2.5 py-2 border-b border-warm-100 last:border-0">
                                  <span>{isMatched ? '✅' : isPartial ? '🔶' : '❌'}</span>
                                  <span className="flex-1 text-sm text-ink-700">{skill}</span>
                                  {isPartial && (
                                    <span className="text-xs text-honey-600 bg-honey-50 border border-honey-200 rounded-full px-2 py-0.5">部分具備</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* C: Improvement cards */}
                    {app.matchAnalysis.fullReport.improvements.length > 0 && (
                      <Card>
                        <CardHeader><CardTitle>待補強技能詳細建議</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {app.matchAnalysis.fullReport.improvements.map(imp => (
                            <div key={imp.skill} className="rounded-xl border border-warm-200 bg-white p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-semibold text-ink-800">{imp.skill}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${
                                  imp.priority === 'high' ? 'text-red-600 bg-red-50 border-red-200' :
                                  imp.priority === 'medium' ? 'text-honey-700 bg-honey-50 border-honey-200' :
                                  'text-sage-600 bg-sage-50 border-sage-200'
                                }`}>
                                  {imp.priority === 'high' ? '高優先' : imp.priority === 'medium' ? '中優先' : '低優先'}
                                </span>
                              </div>
                              <p className="text-xs text-ink-600 mb-2.5">{imp.suggestion}</p>
                              {imp.resources.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {imp.resources.map((r, ri) => (
                                    <span key={ri} className="text-[11px] text-terra-600 border border-terra-200 bg-terra-50 rounded-full px-2 py-0.5">{r}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    )}

                    {/* D: Overall recommendations */}
                    {(app.matchAnalysis.fullReport.strengths.length > 0 || app.matchAnalysis.fullReport.summary) && (
                      <Card>
                        <CardHeader><CardTitle>整體建議</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                          {app.matchAnalysis.fullReport.summary && (
                            <p className="text-sm text-ink-600 leading-relaxed">{app.matchAnalysis.fullReport.summary}</p>
                          )}
                          {app.matchAnalysis.fullReport.strengths.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-ink-500 mb-2">✨ 優勢</p>
                              <ul className="space-y-1">
                                {app.matchAnalysis.fullReport.strengths.map((s, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                                    <span className="text-sage-500 shrink-0 mt-0.5">•</span>{s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="rounded-xl border border-terra-200 bg-terra-50 p-3">
                            <p className="text-xs font-semibold text-terra-700 mb-1">投遞建議</p>
                            <p className={`text-sm ${getMatchLabel(app.matchAnalysis.matchScore).color}`}>
                              {getMatchLabel(app.matchAnalysis.matchScore).text}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : bgAnalyzing ? (
                  <Card>
                    <CardHeader><CardTitle>技能落差報告</CardTitle></CardHeader>
                    <CardContent className="space-y-3 animate-pulse">
                      <div className="grid grid-cols-3 gap-3">
                        {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-warm-200" />)}
                      </div>
                      {[75, 50, 65].map(w => <div key={w} className="h-3 bg-warm-200 rounded" style={{ width: `${w}%` }} />)}
                      <p className="text-xs text-ink-400 text-center pt-2">正在分析中…</p>
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )}
          </div>
        )}

        {/* ③ Interview Prep */}
        {detailTab === 'interview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href={`/interviews?jobId=${encodeURIComponent(app.id)}&title=${encodeURIComponent(app.jobTitle)}&company=${encodeURIComponent(app.company)}`}
                className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 hover:border-terra-300 hover:bg-terra-50 transition-all">
                🎤 針對此職缺生成面試題目 →
              </Link>
              <Link
                href={`/analytics?jobId=${encodeURIComponent(app.id)}&company=${encodeURIComponent(app.company)}&title=${encodeURIComponent(app.jobTitle)}&industry=`}
                className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-4 py-3 text-sm font-medium text-ink-700 hover:border-terra-300 hover:bg-terra-50 transition-all">
                🏢 分析此公司 →
              </Link>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>面試記錄</CardTitle>
                  <button type="button" onClick={() => setAddingNote(true)}
                    className="rounded-lg bg-terra-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-terra-600 transition-colors">
                    + 新增記錄
                  </button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {addingNote && (
                  <div className="rounded-xl border border-terra-200 bg-terra-50/30 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-ink-400 mb-1">日期</label>
                        <input type="date" className="w-full rounded-lg border border-warm-300 bg-white px-2 py-1.5 text-sm focus:border-terra-400 focus:outline-none"
                          value={newNote.date} onChange={(e) => setNewNote({ ...newNote, date: e.target.value })} />
                      </div>
                      <div>
                        <label className="block text-xs text-ink-400 mb-1">面試官（選填）</label>
                        <input className="w-full rounded-lg border border-warm-300 bg-white px-2 py-1.5 text-sm focus:border-terra-400 focus:outline-none"
                          placeholder="姓名或職稱" value={newNote.interviewer}
                          onChange={(e) => setNewNote({ ...newNote, interviewer: e.target.value })} />
                      </div>
                    </div>
                    <textarea className="w-full rounded-lg border border-warm-300 bg-white px-2 py-1.5 text-sm focus:border-terra-400 focus:outline-none resize-none"
                      rows={3} placeholder="題目、觀察、心得..."
                      value={newNote.notes} onChange={(e) => setNewNote({ ...newNote, notes: e.target.value })} />
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAddingNote(false)}
                        className="px-3 py-1.5 text-xs text-ink-400 hover:text-ink-600">取消</button>
                      <button type="button" onClick={addInterviewNote}
                        disabled={!newNote.date || !newNote.notes}
                        className="rounded-lg bg-terra-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-terra-600 disabled:opacity-40 transition-colors">
                        儲存
                      </button>
                    </div>
                  </div>
                )}
                {(app.interviewNotes ?? []).length === 0 && !addingNote && (
                  <p className="py-6 text-center text-sm text-ink-400">尚無面試記錄</p>
                )}
                {(app.interviewNotes ?? []).map((note, i) => (
                  <div key={note.id} className="rounded-xl border border-warm-200 bg-cream-50 px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-600">
                        面試 {i + 1}{note.interviewer ? ` · ${note.interviewer}` : ''}
                      </span>
                      <span className="text-xs text-ink-400">{fmtDate(note.date)}</span>
                    </div>
                    <p className="text-sm text-ink-700 whitespace-pre-line">{note.notes}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ④ Notes */}
        {detailTab === 'notes' && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>備注</CardTitle></CardHeader>
              <CardContent>
                <textarea
                  className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2.5 text-sm text-ink-900 focus:border-terra-400 focus:outline-none resize-none"
                  rows={6} placeholder="自由填寫備注、觀察、感想..."
                  value={app.notes ?? ''}
                  onChange={(e) => updateSelectedApp({ notes: e.target.value })}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>聯絡窗口</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {([
                  { label: '姓名', key: 'contactName', type: 'text', placeholder: '聯絡人姓名' },
                  { label: 'Email', key: 'contactEmail', type: 'email', placeholder: 'hr@company.com' },
                  { label: '電話', key: 'contactPhone', type: 'tel', placeholder: '0912-345-678' },
                ] as const).map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="block text-xs text-ink-400 mb-1">{label}</label>
                    <input type={type}
                      className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                      placeholder={placeholder}
                      value={(app as unknown as Record<string, string | undefined>)[key] ?? ''}
                      onChange={(e) => updateSelectedApp({ [key]: e.target.value })}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
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
      <PageTooltip pageKey="application_tracker" />
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-ink-900">◎ Application Tracker</h1>
        <p className="mt-1 text-sm text-ink-500">管理你的求職進度，AI 分析職缺匹配度</p>
      </div>

      {/* Top action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button type="button"
          onClick={() => { resetAdd(); setMainView('add') }}
          className="flex items-center gap-2 rounded-xl bg-terra-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-600 transition-colors shadow-[var(--shadow-warm-xs)]">
          <span className="text-base leading-none">＋</span> 新增職缺
        </button>
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5 rounded-lg border border-warm-200 bg-white p-0.5">
            {(['kanban', 'list'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setViewMode(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${viewMode === v ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-400 hover:text-ink-600'}`}>
                {v === 'kanban' ? '⊞ 看板' : '≡ 列表'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setShowFilter((p) => !p)}
            className={`rounded-xl border px-3 py-2 text-xs font-medium transition-all ${showFilter || activeFiltersCount > 0 ? 'border-terra-400 bg-terra-50 text-terra-600' : 'border-warm-200 bg-white text-ink-500 hover:border-terra-300 hover:text-terra-500'}`}>
            ⚙ 篩選{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '總投遞數',   value: apps.length,       color: 'text-ink-700 bg-white border-warm-200' },
          { label: '面試中',     value: interviewingCount,  color: 'text-terra-600 bg-terra-50 border-terra-200' },
          { label: '收到 Offer', value: offerCount,         color: 'text-sage-600 bg-sage-50 border-sage-200' },
          { label: '本月新增',   value: thisMonthCount,     color: 'text-honey-600 bg-honey-50 border-honey-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-2xl border px-4 py-3 shadow-[var(--shadow-warm-xs)] ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter panel */}
      {showFilter && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-2">公司 / 職位搜尋</label>
                <input className="w-full rounded-xl border border-warm-300 bg-white px-3 py-1.5 text-sm focus:border-terra-400 focus:outline-none"
                  placeholder="搜尋..." value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-2">
                  最低匹配分數：{filterScoreMin > 0 ? `${filterScoreMin}+` : '不限'}
                </label>
                <input type="range" min={0} max={90} step={10} value={filterScoreMin}
                  onChange={(e) => setFilterScoreMin(Number(e.target.value))}
                  className="w-full accent-terra-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-2">狀態篩選</label>
                <div className="flex flex-wrap gap-1">
                  {KANBAN_COLS.map((c) => (
                    <button key={c.status} type="button"
                      onClick={() => setFilterStatus((prev) =>
                        prev.includes(c.status) ? prev.filter((s) => s !== c.status) : [...prev, c.status]
                      )}
                      className={`rounded-full border px-2 py-0.5 text-xs transition-all ${filterStatus.includes(c.status) ? 'border-terra-400 bg-terra-50 text-terra-600' : 'border-warm-300 text-ink-400 hover:border-terra-300'}`}>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {activeFiltersCount > 0 && (
              <button type="button"
                onClick={() => { setFilterStatus([]); setFilterCompany(''); setFilterScoreMin(0) }}
                className="mt-3 text-xs text-red-400 hover:text-red-500">清除所有篩選</button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── KANBAN VIEW ── */}
      {viewMode === 'kanban' && (
        <>
          {/* Scroll hint (mobile only) */}
          <p className="text-xs text-ink-400 text-center md:hidden -mb-2">← 左右滑動查看所有欄位 →</p>
        <div className="overflow-x-auto pb-4 -mx-4 px-4">
          <div className="flex gap-3" style={{ minWidth: `${KANBAN_COLS.length * 288}px` }}>
            {KANBAN_COLS.map((col) => {
              const colApps = filteredApps.filter((a) => a.status === col.status)
              return (
                <div key={col.status}
                  className={`w-[280px] shrink-0 rounded-2xl p-3 ${col.colBg}`}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, col.status)}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${col.dot}`} />
                    <span className="text-xs font-semibold text-ink-600 truncate">{col.label}</span>
                    <span className="ml-auto text-xs font-medium text-ink-400">{colApps.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colApps.map((app) => (
                      <div key={app.id}
                        draggable
                        onDragStart={() => onDragStart(app.id)}
                        onClick={() => { setSelectedApp(app); setDetailTab('overview'); setMainView('detail') }}
                        className="cursor-pointer rounded-xl border border-warm-200 bg-white p-3 shadow-[var(--shadow-warm-xs)] hover:shadow-[var(--shadow-warm-sm)] hover:border-terra-200 transition-all">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-ink-800 truncate flex-1">{app.company}</p>
                          {app.linked_resume_id && (
                            <span title="已有客製化履歷" className="shrink-0 text-[11px]">📄</span>
                          )}
                          {(() => {
                            const st = getAnalysisStatusForApp(app)
                            if (st === 'done') return <span title="公司分析已完成" className="shrink-0 text-[11px]">📊</span>
                            if (st === 'pending') return <span title="公司分析進行中" className="shrink-0 text-[11px]">⏳</span>
                            return null
                          })()}
                        </div>
                        <p className="text-xs text-ink-500 truncate mt-0.5">{app.jobTitle}</p>
                        {app.matchScore !== undefined && (
                          <p className={`mt-2 text-xs font-bold ${scoreColor(app.matchScore)}`}>
                            {app.matchScore}% 匹配
                          </p>
                        )}
                        <div className="mt-2 flex items-center justify-between">
                          {fmtSalary(app.salaryMin, app.salaryMax)
                            ? <span className="text-[10px] text-sage-600">{fmtSalary(app.salaryMin, app.salaryMax)}</span>
                            : <span />}
                          <span className="text-[10px] text-ink-300">{fmtDate(app.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                    {colApps.length === 0 && (
                      <div className="rounded-xl border border-dashed border-warm-300 py-6 text-center">
                        <p className="text-xs text-ink-300">拖曳至此</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-2xl border border-warm-200 bg-white shadow-[var(--shadow-warm-xs)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-200 bg-cream-100">
                {([
                  { key: 'company',    label: '公司' },
                  { key: 'jobTitle',   label: '職位' },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th key={key}
                    className="px-4 py-3 text-left text-xs font-semibold text-ink-400 cursor-pointer hover:text-ink-600 whitespace-nowrap"
                    onClick={() => toggleSort(key)}>
                    {label}{si(key)}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-400 whitespace-nowrap">產業</th>
                {([
                  { key: 'status',     label: '狀態' },
                  { key: 'matchScore', label: '匹配分' },
                  { key: 'appliedAt',  label: '投遞日' },
                  { key: 'salaryMin',  label: '薪資' },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th key={key}
                    className="px-4 py-3 text-left text-xs font-semibold text-ink-400 cursor-pointer hover:text-ink-600 whitespace-nowrap"
                    onClick={() => toggleSort(key)}>
                    {label}{si(key)}
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-ink-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredApps.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-sm text-ink-400">
                    尚無職缺，點擊「＋ 新增職缺」開始追蹤
                  </td>
                </tr>
              )}
              {filteredApps.map((app) => {
                const col = STATUS_MAP[app.status]
                return (
                  <tr key={app.id} className="border-b border-warm-100 hover:bg-cream-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-ink-800">
                      <span className="flex items-center gap-1.5">
                        {app.company}
                        {app.linked_resume_id && <span title="已有客製化履歷" className="text-sm">📄</span>}
                        {(() => {
                          const st = getAnalysisStatusForApp(app)
                          if (st === 'done') return <span title="公司分析已完成" className="text-sm">📊</span>
                          if (st === 'pending') return <span title="公司分析進行中" className="text-sm">⏳</span>
                          return null
                        })()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">{app.jobTitle}</td>
                    <td className="px-4 py-3 text-xs text-ink-500">{app.industry || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${col.dot}`} />
                        <span className="text-xs text-ink-600">{col.label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {app.matchScore !== undefined
                        ? <span className={`text-sm font-bold ${scoreColor(app.matchScore)}`}>{app.matchScore}%</span>
                        : <span className="text-ink-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                      {fmtDate(app.appliedAt !== '—' ? app.appliedAt : undefined) !== '—'
                        ? fmtDate(app.appliedAt)
                        : fmtDate(app.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs text-sage-600">{fmtSalary(app.salaryMin, app.salaryMax) || '—'}</td>
                    <td className="px-4 py-3">
                      <button type="button"
                        onClick={() => { setSelectedApp(app); setDetailTab('overview'); setMainView('detail') }}
                        className="text-xs font-medium text-terra-500 hover:text-terra-600">
                        查看
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state (kanban only) */}
      {apps.length === 0 && viewMode === 'kanban' && (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="mb-4 text-5xl">◎</div>
          <p className="text-sm font-medium text-ink-600">還沒有追蹤任何職缺</p>
          <p className="mt-1 text-xs text-ink-400">點擊「＋ 新增職缺」開始管理你的求職進度</p>
        </div>
      )}
      <RateLimitToast visible={rateLimitToast} onDismiss={() => setRateLimitToast(false)} />
    </div>
  )
}
