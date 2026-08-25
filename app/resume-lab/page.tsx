'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ResumeEditor, type SavedResumeData } from '@/components/resume/resume-editor'
import { PageTooltip } from '@/components/onboarding/page-tooltip'

// ── Types ──────────────────────────────────────────────────────────────────────

// Extended for WYSIWYG editor — all new fields are optional for backward compat
interface Education {
  school: string; degree: string; major: string; year: string
  startDate?: string; endDate?: string
}
interface Experience {
  company: string; title: string; description: string
  startDate?: string; endDate?: string; current?: boolean
}
interface ParsedResume {
  name: string; email: string; phone: string
  jobTitle?: string; location?: string; linkedin?: string; website?: string; summary?: string
  skills: string[]
  experiences: Experience[]
  education: Education[]
  languages?: { name: string; level: string }[]
  rawText: string
}
interface ResumeEntry {
  id: string
  name: string
  language: 'zh' | 'en'
  score: number | null
  atsScore: number | null
  scoredAt: string | null
  isPrimary: boolean
  source: 'upload' | 'template' | 'linkedin' | 'manual'
  createdAt: string
  updatedAt: string
  data: ParsedResume
  resumeType?: 'profile' | 'jd'
  linkedJobCompany?: string
  linkedJobTitle?: string
  jdMatchHighlights?: string[]
}
// ── Constants ──────────────────────────────────────────────────────────────────

const TABS = ['resume'] as const
type Tab = typeof TABS[number]
const TAB_LABELS: Record<Tab, string> = { resume: '◈ Resume Lab' }

const RESUME_TEMPLATES = [
  { id: 'freshman',     emoji: '🎓', label: '新鮮人', desc: '剛畢業，強調學習能力',    data: { name: '王小明', email: 'example@gmail.com',    phone: '0912-345-678', skills: ['Python', 'Microsoft Office', '數據分析', '快速學習', '英文溝通'],              experiences: [{ company: '某科技公司', title: '暑期實習生',     description: '協助開發內部工具，參與敏捷開發流程' }],                                                                        education: [{ school: '國立台灣大學', degree: '學士', major: '資訊管理學系', year: '2024' }], rawText: '' } },
  { id: 'engineer',     emoji: '⚙️', label: '工程師', desc: '3–5 年，強調技術深度',    data: { name: '李工程', email: 'engineer@gmail.com',   phone: '0923-456-789', skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker'],                         experiences: [{ company: '某新創公司', title: '資深前端工程師', description: '主導前端架構重構，導入 React + TypeScript，開發效率提升 40%' }, { company: '某傳產公司', title: '軟體工程師', description: '維護 ERP 系統，開發客製化報表模組' }], education: [{ school: '國立成功大學', degree: '學士', major: '資訊工程學系', year: '2021' }], rawText: '' } },
  { id: 'marketing',    emoji: '📢', label: '行銷',   desc: '數位行銷，數據驅動',      data: { name: '陳行銷', email: 'marketing@gmail.com',  phone: '0934-567-890', skills: ['Google Analytics', 'SEO/SEM', 'Meta Ads', '內容行銷', 'KOL 合作'],               experiences: [{ company: '某電商平台', title: '數位行銷專員',   description: '管理月預算 200 萬廣告投放，ROI 提升 35%' }],                                                                   education: [{ school: '輔仁大學',     degree: '學士', major: '廣告傳播學系',   year: '2022' }], rawText: '' } },
  { id: 'management',   emoji: '👔', label: '管理職', desc: '帶領 5 人以上團隊',        data: { name: '張主管', email: 'manager@gmail.com',    phone: '0945-678-901', skills: ['團隊管理', '跨部門協作', 'OKR', '敏捷開發', '人才培育'],                           experiences: [{ company: '某科技集團', title: '產品開發主管',   description: '帶領 8 人團隊，管理 3 個產品線，年營收 2,000 萬' }],                                                              education: [{ school: '政治大學',     degree: '碩士', major: 'MBA',           year: '2019' }], rawText: '' } },
  { id: 'career_change',emoji: '🔄', label: '轉職用', desc: '強調可轉移技能',          data: { name: '林轉職', email: 'change@gmail.com',     phone: '0956-789-012', skills: ['溝通協調', '問題分析', 'Excel 進階', '客戶服務', '自學能力'],                       experiences: [{ company: '某金融機構', title: '業務專員',       description: '管理 200+ 客戶，業績達成率 120%' }],                                                                            education: [{ school: '淡江大學',     degree: '學士', major: '財務金融學系', year: '2020' }],  rawText: '' } },
]

const EMPTY_RESUME: ParsedResume = { name: '', email: '', phone: '', skills: [], experiences: [], education: [], rawText: '' }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }
function todayStr() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string) { try { return new Date(d).toLocaleDateString('zh-TW') } catch { return d } }
function detectLang(text: string): 'zh' | 'en' { return /[一-鿿]/.test(text) ? 'zh' : 'en' }

// ── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CareerProfilePage() {
  const [tab, setTab] = useState<Tab>('resume')

  // Auto-save indicator
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const autoSave = useCallback((key: string, data: unknown) => {
    setSaveStatus('saving')
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* quota */ }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    }, 1000)
  }, [])

  // ── Resume state ──────────────────────────────────────────────────────────────
  const [resumeView, setResumeView] = useState<'list' | 'create' | 'edit'>('list')
  const [resumes, setResumes] = useState<ResumeEntry[]>([])
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null)
  const [resumeName, setResumeName] = useState('')
  const [editedResume, setEditedResume] = useState<ParsedResume>(EMPTY_RESUME)
  const [resumeError, setResumeError] = useState('')
  const [parsing, setParsing] = useState(false)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Create-flow state
  const [createMode, setCreateMode] = useState<'none' | 'upload' | 'linkedin' | 'template' | 'chooser' | 'loading'>('none')
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [linkedinText, setLinkedinText] = useState('')
  const [linkedinStep, setLinkedinStep] = useState<1 | 2>(1)
  const [linkedinParsing, setLinkedinParsing] = useState(false)
  const [chooserOpt, setChooserOpt] = useState<'profile' | 'jd' | null>(null)
  const [resumeLang, setResumeLang] = useState<'zh' | 'en' | 'both'>('zh')
  const [jdText, setJdText] = useState('')
  const [editBanner, setEditBanner] = useState('')

  // Profile data awareness (Steps 2, 3, 4)
  const [hasProfileData, setHasProfileData] = useState(true)
  const [profileCompleteness, setProfileCompleteness] = useState(0)
  const [jdSubMode, setJdSubMode] = useState<'paste' | 'tracker' | null>(null)
  const [trackerApps, setTrackerApps] = useState<{ id: string; company?: string; title?: string; jdFullText?: string }[]>([])
  const [selectedTrackerAppId, setSelectedTrackerAppId] = useState('')

  // Tracker linkage (Steps 2, 3)
  const [trackerJobId, setTrackerJobId] = useState('')
  const [trackerJobCompany, setTrackerJobCompany] = useState('')
  const [trackerJobTitle, setTrackerJobTitle] = useState('')

  // Task 3: completeness modal + language modal + review fields + JD highlights
  const [showCompletenessModal, setShowCompletenessModal] = useState(false)
  const [completenessIssues, setCompletenessIssues] = useState<string[]>([])
  const [showLangModal, setShowLangModal] = useState(false)
  const [resumeListFilter, setResumeListFilter] = useState<'all' | 'profile' | 'jd'>('all')
  const [reviewFields, setReviewFields] = useState<string[]>([])
  const [pendingJdHighlights, setPendingJdHighlights] = useState<string[]>([])
  const [pendingResumeType, setPendingResumeType] = useState<ResumeEntry['resumeType']>(undefined)
  const [pendingLinkedJobCompany, setPendingLinkedJobCompany] = useState('')
  const [pendingLinkedJobTitle, setPendingLinkedJobTitle] = useState('')
  const [profileSkillsList, setProfileSkillsList] = useState<string[]>([])
  const [profileExpList, setProfileExpList] = useState<{ company: string; title: string }[]>([])

  // Skills are managed in /dashboard/skills — only needed here for localStorage merge on resume import


  // Init from URL params + tracker apps (now persisted server-side)
  useEffect(() => {
    // Read URL params for Tracker → Resume Lab deep-link (Step 2)
    const params = new URLSearchParams(window.location.search)
    const jobId = params.get('jobId')
    const company = params.get('company') ?? ''
    const title = params.get('title') ?? ''
    if (jobId) {
      setTrackerJobId(jobId)
      setTrackerJobCompany(company)
      setTrackerJobTitle(title)
      // Auto-open JD paste mode
      setTab('resume')
      setResumeView('create')
      setChooserOpt('jd')
      setJdSubMode('paste')
    }
    fetch('/api/tracker').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const apps = res.applications as { id: string; jdFullText?: string; company?: string; title?: string }[]
      setTrackerApps(apps)
      if (jobId) {
        const trackerApp = apps.find((a) => a.id === jobId)
        if (trackerApp?.jdFullText) setJdText(trackerApp.jdFullText)
      }
    }).catch(() => { /* ignore */ })
  }, [])

  // Resumes now persist server-side. On first load with no DB rows yet, migrate
  // whatever was sitting in localStorage from the old client-only version once.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/resumes')
        if (!res.ok) return
        const { resumes: dbResumes } = await res.json() as { resumes: ResumeEntry[] }
        if (dbResumes.length > 0) { setResumes(dbResumes); return }

        let legacy: ResumeEntry[] = []
        const rawResumes = localStorage.getItem('career-resumes')
        if (rawResumes) {
          legacy = JSON.parse(rawResumes)
        } else {
          const rawResume = localStorage.getItem('career-resume')
          if (rawResume) {
            const r: ParsedResume = JSON.parse(rawResume)
            legacy = [{
              id: genId(), name: r.name || '我的履歷',
              language: detectLang(r.rawText), score: null, atsScore: null, scoredAt: null,
              isPrimary: true, source: 'manual',
              createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
              data: r,
            }]
          }
        }
        if (legacy.length > 0) {
          const putRes = await fetch('/api/resumes', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resumes: legacy }),
          })
          if (putRes.ok) {
            const { resumes: migrated } = await putRes.json()
            setResumes(migrated)
          }
        }
      } catch { /* ignore */ }
    })()
  }, [])

  // Profile completeness + JD-panel summary — now sourced from the database (/api/profile)
  // instead of localStorage, since 個人檔案庫 persists server-side.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) return
        const data = await res.json()

        const basic = data.basic as Record<string, string> | null
        const hasAny = !!(basic && Object.values(basic).some((v) => v))
        setHasProfileData(hasAny)

        let f = 0; const t = 20
        if (basic) ['nameZh', 'nameEn', 'email', 'phone', 'address', 'linkedinUrl', 'portfolioUrl', 'websiteUrl'].forEach((k) => { if (basic[k]) f++ })
        ;[data.educations, data.experiences, data.internships, data.projects, data.certificates, data.activities, data.conferences].forEach((list: unknown[]) => {
          if (Array.isArray(list) && list.length > 0) f++
        })
        const sm = (data.skillMap ?? {}) as Record<string, string[]>
        if (Object.values(sm).some((a) => a.length > 0)) f++
        if (Array.isArray(data.languages) && data.languages.length > 0) f++
        if (data.summaryZh) f++
        if (data.summaryEn) f++
        setProfileCompleteness(Math.round((f / t) * 100))

        setProfileSkillsList(Object.values(sm).flat().slice(0, 20))
        const exps = (data.experiences ?? []) as { company?: string; title?: string }[]
        const interns = (data.internships ?? []) as { company?: string; title?: string }[]
        setProfileExpList(
          [...exps, ...interns].filter((e) => e.company || e.title).slice(0, 5)
            .map((e) => ({ company: e.company ?? '', title: e.title ?? '' }))
        )
      } catch { /* ignore */ }
    })()
  }, [])

  // ── Resume handlers ──────────────────────────────────────────────────────────

  async function collectProfile(): Promise<Record<string, unknown>> {
    const profile: Record<string, unknown> = {}
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) return profile
      const data = await res.json()
      if (data.basic) profile['profile-basic'] = data.basic
      if (data.educations?.length) profile['profile-education'] = data.educations
      if (data.experiences?.length) profile['profile-experience'] = data.experiences
      if (data.internships?.length) profile['profile-internship'] = data.internships
      if (data.projects?.length) profile['profile-project'] = data.projects
      if (data.languages?.length) profile['profile-language'] = data.languages
      if (data.skillMap && Object.values(data.skillMap as Record<string, unknown[]>).some((a) => Array.isArray(a) && a.length)) profile['profile-skillmap'] = data.skillMap
      if (data.certificates?.length) profile['profile-certificate'] = data.certificates
      if (data.activities?.length) profile['profile-activity'] = data.activities
      if (data.conferences?.length) profile['profile-conference'] = data.conferences
      if (data.summaryZh) profile['profile-summary-zh'] = data.summaryZh
      if (data.summaryEn) profile['profile-summary-en'] = data.summaryEn
      if (data.customBlocks?.length) profile['profile-custom'] = data.customBlocks
    } catch { /* ignore */ }
    return profile
  }

  function linkResumeToTrackerApp(jobId: string, resumeId: string) {
    if (!jobId) return
    fetch('/api/tracker').then((r) => (r.ok ? r.json() : null)).then((res) => {
      if (!res) return
      const apps = res.applications as Record<string, unknown>[]
      const updated = apps.map((a) => a.id === jobId ? { ...a, linked_resume_id: resumeId } : a)
      return fetch('/api/tracker', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applications: updated }),
      })
    }).catch(() => { /* ignore */ })
  }

  async function checkCompletenessLocal(): Promise<string[]> {
    const issues: string[] = []
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        const basic = data.basic as Record<string, string> | null
        if (!basic?.nameZh && !basic?.nameEn) issues.push('尚未填寫姓名（基本資料）')
        const exp = (data.experiences ?? []) as unknown[]
        const intern = (data.internships ?? []) as unknown[]
        const edu = (data.educations ?? []) as unknown[]
        if (!exp.length && !intern.length && !edu.length) issues.push('尚未填寫工作經驗、實習或學歷')
        const sm = (data.skillMap ?? {}) as Record<string, string[]>
        const totalSkills = Object.values(sm).flat().length
        if (totalSkills < 3) issues.push(`技能項目不足（目前 ${totalSkills} 項，建議至少 3 項）`)
      }
    } catch { /* ignore */ }
    return issues
  }

  async function handleStartProfileBuild() {
    setResumeError('')
    const issues = await checkCompletenessLocal()
    if (issues.length > 0) {
      setCompletenessIssues(issues)
      setShowCompletenessModal(true)
    } else {
      setShowLangModal(true)
    }
  }

  async function loadProfileSummaryForJD() {
    try {
      const res = await fetch('/api/profile')
      if (!res.ok) return
      const data = await res.json()
      const sm = (data.skillMap ?? {}) as Record<string, string[]>
      setProfileSkillsList(Object.values(sm).flat().slice(0, 20))
      const exps = (data.experiences ?? []) as { company?: string; title?: string }[]
      const interns = (data.internships ?? []) as { company?: string; title?: string }[]
      setProfileExpList(
        [...exps, ...interns]
          .filter((e) => e.company || e.title)
          .slice(0, 5)
          .map((e) => ({ company: e.company ?? '', title: e.title ?? '' }))
      )
    } catch { /* ignore */ }
  }

  async function buildFromProfile(lang: 'zh' | 'en' | 'both') {
    setShowLangModal(false)
    setCreateMode('loading')
    setResumeError('')
    try {
      const profile = await collectProfile()
      if (lang === 'both') {
        const [zhRes, enRes] = await Promise.all([
          fetch('/api/resume/build-from-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, language: 'zh' }) }),
          fetch('/api/resume/build-from-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, language: 'en' }) }),
        ])
        const [zhData, enData] = await Promise.all([zhRes.json(), enRes.json()])
        const now = new Date().toISOString()
        const zhEntry: ResumeEntry = { id: genId(), name: 'ZH 履歷（檔案庫）', language: 'zh', score: null, atsScore: null, scoredAt: null, isPrimary: false, source: 'manual', createdAt: now, updatedAt: now, data: { ...EMPTY_RESUME, ...zhData.resume }, resumeType: 'profile' }
        const enEntry: ResumeEntry = { id: genId(), name: 'EN Resume (Library)', language: 'en', score: null, atsScore: null, scoredAt: null, isPrimary: false, source: 'manual', createdAt: now, updatedAt: now, data: { ...EMPTY_RESUME, ...enData.resume }, resumeType: 'profile' }
        persistResumes([...resumes, zhEntry, enEntry])
        setResumeView('list'); setCreateMode('none')
      } else {
        const res = await fetch('/api/resume/build-from-profile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, language: lang }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '生成失敗')
        const nrFields = (data.needs_review ?? []) as string[]
        const invalidated = (data._validation?.invalidatedFields ?? []) as string[]
        const allReview = [...nrFields, ...invalidated]
        setReviewFields(allReview)
        setPendingJdHighlights([])
        const warnCount = invalidated.length
        setEditBanner(
          warnCount > 0
            ? `此履歷由個人檔案庫自動生成，偵測到 ${warnCount} 個欄位可能與原始資料不符，請確認後再使用`
            : '此履歷由個人檔案庫自動生成，請確認資訊正確性後再使用'
        )
        goToEditor({ ...EMPTY_RESUME, ...data.resume }, `${lang === 'en' ? 'EN Resume' : '履歷'}（檔案庫）`, 'manual', 'profile')
      }
    } catch (err) {
      setResumeError((err as Error).message)
      setCreateMode('none')
    }
  }

  async function customizeForJD(lang: 'zh' | 'en' | 'both') {
    if (!jdText.trim()) return
    setCreateMode('loading')
    setResumeError('')
    try {
      const profile = await collectProfile()
      const selectedApp = trackerApps.find((a) => a.id === selectedTrackerAppId)
      if (lang === 'both') {
        const [zhRes, enRes] = await Promise.all([
          fetch('/api/resume/customize-for-jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, jd: jdText, language: 'zh' }) }),
          fetch('/api/resume/customize-for-jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, jd: jdText, language: 'en' }) }),
        ])
        const [zhData, enData] = await Promise.all([zhRes.json(), enRes.json()])
        const jobTitle = zhData.jobTitle || enData.jobTitle || '客製化'
        const highlights = (zhData.jd_match_highlights ?? enData.jd_match_highlights ?? []) as string[]
        const now = new Date().toISOString()
        const zhId = genId(); const enId = genId()
        const zhEntry: ResumeEntry = { id: zhId, name: `${jobTitle} ZH 履歷`, language: 'zh', score: null, atsScore: null, scoredAt: null, isPrimary: false, source: 'manual', createdAt: now, updatedAt: now, data: { ...EMPTY_RESUME, ...zhData.resume }, resumeType: 'jd', linkedJobCompany: selectedApp?.company, linkedJobTitle: jobTitle, jdMatchHighlights: highlights }
        const enEntry: ResumeEntry = { id: enId, name: `${jobTitle} EN Resume`, language: 'en', score: null, atsScore: null, scoredAt: null, isPrimary: false, source: 'manual', createdAt: now, updatedAt: now, data: { ...EMPTY_RESUME, ...enData.resume }, resumeType: 'jd', linkedJobCompany: selectedApp?.company, linkedJobTitle: jobTitle, jdMatchHighlights: highlights }
        persistResumes([...resumes, zhEntry, enEntry])
        if (trackerJobId) linkResumeToTrackerApp(trackerJobId, zhId)
        setResumeView('list'); setCreateMode('none')
      } else {
        const res = await fetch('/api/resume/customize-for-jd', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile, jd: jdText, language: lang }) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? '生成失敗')
        const jobTitle = data.jobTitle || '客製化'
        const highlights = (data.jd_match_highlights ?? []) as string[]
        const invalidatedJd = (data._validation?.invalidatedFields ?? []) as string[]
        setReviewFields(invalidatedJd)
        setPendingJdHighlights(highlights)
        setPendingResumeType('jd')
        setPendingLinkedJobCompany(selectedApp?.company ?? '')
        setPendingLinkedJobTitle(jobTitle)
        const warnCountJd = invalidatedJd.length
        setEditBanner(
          warnCountJd > 0
            ? `此履歷針對「${jobTitle}」客製化，偵測到 ${warnCountJd} 個欄位可能與原始資料不符，請確認後再使用`
            : `此履歷針對「${jobTitle}」客製化，來源：個人檔案庫`
        )
        goToEditor({ ...EMPTY_RESUME, ...data.resume }, `${jobTitle} 履歷`, 'manual', 'jd', selectedApp?.company, jobTitle, highlights)
      }
    } catch (err) {
      setResumeError((err as Error).message)
      setCreateMode('none')
    }
  }

  function persistResumes(next: ResumeEntry[]) {
    setResumes(next)
    fetch('/api/resumes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resumes: next }),
    }).then(async (res) => {
      if (res.ok) {
        const { resumes: fresh } = await res.json() as { resumes: ResumeEntry[] }
        setResumes(fresh)
      }
    }).catch(() => { /* keep optimistic local state on network failure */ })
  }

  function goToEditor(
    data: ParsedResume, name: string, source: ResumeEntry['source'],
    resumeType?: ResumeEntry['resumeType'],
    linkedJobCompany?: string, linkedJobTitle?: string, jdMatchHighlights?: string[]
  ) {
    setEditedResume(data); setEditingResumeId(null); setResumeName(name)
    setResumeError('')
    setResumeView('edit'); setCreateMode('none')
    setPendingResumeType(resumeType)
    setPendingLinkedJobCompany(linkedJobCompany ?? '')
    setPendingLinkedJobTitle(linkedJobTitle ?? '')
    setPendingJdHighlights(jdMatchHighlights ?? [])
    // Merge parsed resume skills into the shared skill library (persisted server-side)
    if (data.skills.length > 0) {
      fetch('/api/skills').then((r) => (r.ok ? r.json() : null)).then((res) => {
        if (!res) return
        const existing = res.skills as { name: string; category: string }[]
        const existingNames = new Set(existing.map((t) => t.name))
        const toAdd = data.skills.filter((s) => !existingNames.has(s)).map((s) => ({ name: s, category: '專業技能' }))
        if (toAdd.length) {
          fetch('/api/skills', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skills: [...existing, ...toAdd] }),
          }).catch(() => { /* ignore */ })
        }
      }).catch(() => { /* ignore */ })
    }
    void source
  }

  function startEdit(entry: ResumeEntry) {
    setEditedResume(entry.data); setEditingResumeId(entry.id); setResumeName(entry.name)
    setEditBanner(''); setReviewFields([]); setPendingJdHighlights(entry.jdMatchHighlights ?? [])
    setPendingResumeType(entry.resumeType); setPendingLinkedJobCompany(entry.linkedJobCompany ?? ''); setPendingLinkedJobTitle(entry.linkedJobTitle ?? '')
    setResumeView('edit')
  }

  function deleteResume(id: string) {
    if (!confirm('確定要刪除這份履歷？')) return
    let next = resumes.filter((r) => r.id !== id)
    if (next.length > 0 && !next.some((r) => r.isPrimary)) next = [{ ...next[0], isPrimary: true }, ...next.slice(1)]
    persistResumes(next)
  }

  function setPrimaryResume(id: string) {
    persistResumes(resumes.map((r) => ({ ...r, isPrimary: r.id === id })))
  }

  async function handleFile(f: File) {
    setResumeError(''); setParsing(true)
    const form = new FormData(); form.append('file', f)
    try {
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      goToEditor({ ...EMPTY_RESUME, ...data }, data.name || '上傳履歷', 'upload')
    } catch (err) { setResumeError((err as Error).message) }
    finally { setParsing(false) }
  }

  async function handleLinkedinImport() {
    const text = linkedinText.trim(); if (!text) return
    setLinkedinParsing(true); setResumeError('')
    const form = new FormData()
    form.append('file', new Blob([text], { type: 'text/plain' }), 'linkedin.txt')
    try {
      const res = await fetch('/api/resume/parse', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '解析失敗')
      goToEditor({ ...EMPTY_RESUME, ...data }, data.name || 'LinkedIn 履歷', 'linkedin')
      setLinkedinUrl(''); setLinkedinText(''); setLinkedinStep(1)
    } catch (err) { setResumeError((err as Error).message) }
    finally { setLinkedinParsing(false) }
  }

  function applyTemplate() {
    const t = RESUME_TEMPLATES.find((x) => x.id === selectedTemplateId)
    if (!t) return
    goToEditor({ ...EMPTY_RESUME, ...t.data }, `${t.emoji} ${t.label}`, 'template')
    setSelectedTemplateId('')
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-5">
      <PageTooltip pageKey="resume_lab" />
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ink-900">◈ Resume Lab</h1>
          <p className="mt-1 text-xs md:text-sm text-ink-500">履歷管理 · 技能標籤</p>
        </div>
        {saveStatus !== 'idle' && (
          <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${saveStatus === 'saved' ? 'bg-sage-500/10 text-sage-600' : 'bg-cream-200 text-ink-400'}`}>
            {saveStatus === 'saving' ? <><Spinner className="h-3 w-3" />儲存中</> : '✓ 已儲存'}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 w-full sm:w-fit shadow-[var(--shadow-warm-xs)] overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium transition-all ${tab === t ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          RESUME TAB
      ══════════════════════════════════════════════════════════════════════════ */}
      {tab === 'resume' && (
        <div className="space-y-5">

          {/* ── Profile completeness status bar (Step 4) ── */}
          {profileCompleteness < 60 ? (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-honey-50 border border-honey-200 px-4 py-3">
              <p className="text-sm text-honey-700">
                ⚠️ 個人檔案庫完整度 <span className="font-bold">{profileCompleteness}%</span>，建議補充更多資料以產出更完整的履歷
              </p>
              <Link href="/profile-library"
                className="shrink-0 text-sm font-medium text-honey-700 underline-offset-2 hover:underline whitespace-nowrap transition-colors">
                前往補充 →
              </Link>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 rounded-xl bg-sage-50 border border-sage-200 px-4 py-3">
              <p className="text-sm text-sage-700">
                ✓ 個人檔案庫已就緒（完整度 <span className="font-bold">{profileCompleteness}%</span>）
              </p>
              <Link href="/profile-library"
                className="shrink-0 text-sm font-medium text-sage-600 underline-offset-2 hover:underline whitespace-nowrap transition-colors">
                查看/編輯 →
              </Link>
            </div>
          )}

          {/* ── LEVEL 1: Resume List ──────────────────────────────────────────── */}
          {resumeView === 'list' && (
            <div className="space-y-5">
              {/* Level-1 header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink-800">我的履歷</h2>
                <Button variant="primary" size="sm" onClick={() => { setCreateMode('none'); setResumeView('create') }}>
                  ＋ 新增履歷
                </Button>
              </div>

              {/* Filter tabs */}
              {resumes.length > 0 && (
                <div className="flex gap-1 p-1 bg-warm-100 rounded-lg w-fit">
                  {([['all', '全部'], ['profile', '📄 通用'], ['jd', '🎯 客製化']] as const).map(([v, label]) => (
                    <button key={v} onClick={() => setResumeListFilter(v)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${resumeListFilter === v ? 'bg-white text-ink-800 shadow-sm' : 'text-ink-500 hover:text-ink-700'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {resumes.length === 0 && (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-warm-200 bg-white py-20 space-y-4">
                  <span className="text-5xl">📄</span>
                  <p className="font-medium text-ink-600">尚未建立任何履歷</p>
                  <p className="text-sm text-ink-400">建立你的第一份履歷，開始職涯旅程</p>
                  <Button variant="primary" onClick={() => { setCreateMode('none'); setResumeView('create') }}>＋ 新增履歷</Button>
                </div>
              )}

              {/* Resume cards */}
              <div className="space-y-3">
                {resumes.filter((r) => resumeListFilter === 'all' || r.resumeType === resumeListFilter || (resumeListFilter === 'profile' && !r.resumeType)).map((r) => {
                  const scoreColor =
                    r.score === null ? '' :
                    r.score >= 90 ? 'text-sage-600' :
                    r.score >= 75 ? 'text-honey-500' :
                    r.score >= 60 ? 'text-terra-400' : 'text-red-500'
                  const scoreDot =
                    r.score === null ? '' :
                    r.score >= 90 ? '🟢' :
                    r.score >= 75 ? '🟡' :
                    r.score >= 60 ? '🟠' : '🔴'

                  return (
                    <Card key={r.id}>
                      <CardContent className="pt-4 pb-4">
                        <div className="flex items-start justify-between gap-4">
                          {/* ── Left: name + badges ── */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center flex-wrap gap-2 mb-1.5">
                              <p className="font-semibold text-ink-700 text-sm">{r.name}</p>
                              {r.isPrimary && <Badge variant="success">主要履歷</Badge>}
                              {r.resumeType === 'jd' ? (
                                <span className="rounded-full bg-honey-100 border border-honey-300 px-2 py-0.5 text-[11px] font-medium text-honey-700">🎯 客製化</span>
                              ) : (
                                <span className="rounded-full bg-sage-50 border border-sage-200 px-2 py-0.5 text-[11px] font-medium text-sage-600">📄 通用</span>
                              )}
                              <Badge variant="outline">{r.language === 'zh' ? '中文' : 'English'}</Badge>
                            </div>
                            {r.resumeType === 'jd' && (r.linkedJobCompany || r.linkedJobTitle) && (
                              <p className="text-xs text-ink-500 mb-1">
                                {r.linkedJobCompany && <span>{r.linkedJobCompany}</span>}
                                {r.linkedJobCompany && r.linkedJobTitle && <span className="mx-1 text-warm-300">·</span>}
                                {r.linkedJobTitle && <span>{r.linkedJobTitle}</span>}
                              </p>
                            )}
                            {/* ── Second row: date · score ── */}
                            <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-ink-400">
                              <span>更新於 {fmtDate(r.updatedAt)}</span>
                              {r.score !== null ? (
                                <>
                                  <span className="text-warm-300">·</span>
                                  <span className={`font-medium ${scoreColor}`}>
                                    {scoreDot} AI 評分：{r.score} 分
                                  </span>
                                  {r.scoredAt && (
                                    <span className="text-ink-300">（{fmtDate(r.scoredAt)} 評分）</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-warm-300">·</span>
                                  <span className="text-ink-300">尚未評分</span>
                                  <button
                                    onClick={() => startEdit(r)}
                                    className="rounded-md border border-warm-200 bg-cream-100 px-2 py-0.5 text-[11px] text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all">
                                    立即評分
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* ── Right: action buttons ── */}
                          <div className="flex flex-col sm:flex-row gap-1.5 shrink-0">
                            {!r.isPrimary && (
                              <button onClick={() => setPrimaryResume(r.id)}
                                className="rounded-lg border border-warm-200 bg-white px-2.5 py-1 text-xs text-ink-400 hover:border-sage-300 hover:text-sage-600 transition-all whitespace-nowrap">
                                設為主要
                              </button>
                            )}
                            <button onClick={() => startEdit(r)}
                              className="rounded-lg border border-warm-200 bg-white px-2.5 py-1 text-xs text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">
                              編輯
                            </button>
                            <button onClick={() => deleteResume(r.id)}
                              className="rounded-lg border border-warm-200 bg-white px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">
                              刪除
                            </button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── LEVEL 2: Create New Resume ────────────────────────────────────── */}
          {resumeView === 'create' && (
            <div className="space-y-6">
              {/* Back + title */}
              <button onClick={() => { setResumeView('list'); setCreateMode('none'); setChooserOpt(null); setJdSubMode(null); setResumeError('') }}
                className="flex items-center gap-1 text-sm text-ink-400 hover:text-ink-700 transition-colors">
                ← 返回
              </button>
              <div>
                <h2 className="text-xl font-bold text-ink-900">{trackerJobId ? '建立客製化履歷' : '建立新履歷'}</h2>
                <p className="text-sm text-ink-500 mt-1">
                  {trackerJobId
                    ? `為「${trackerJobCompany}${trackerJobTitle ? ` — ${trackerJobTitle}` : ''}」量身打造履歷`
                    : '選擇履歷類型，AI 從個人檔案庫取得資料自動生成'}
                </p>
              </div>

              {/* Step 2: No-profile-data notice */}
              {!hasProfileData && (
                <div className="bg-cream-50 border border-warm-200 border-dashed rounded-xl p-6 text-center space-y-3">
                  <p className="text-2xl">📁</p>
                  <p className="font-semibold text-ink-700">還沒有個人檔案庫資料？</p>
                  <p className="text-sm text-ink-500">先前往個人檔案庫上傳履歷或填寫資料，<br/>Resume Lab 將自動引用你的資料建立履歷</p>
                  <Link href="/profile-library"
                    className="inline-block mt-1 rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                    前往個人檔案庫 →
                  </Link>
                </div>
              )}

              {/* Step 3: Two large cards (hidden when coming from Tracker) */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-5 ${trackerJobId ? 'hidden' : ''}`}>
                {/* Card 1: 通用履歷 */}
                <div className={`bg-white border border-warm-200 rounded-xl p-8 space-y-4 flex flex-col ${!hasProfileData ? 'opacity-60 pointer-events-none' : ''}`}>
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-ink-900">📄 通用履歷</p>
                    <p className="text-sm text-ink-500">從個人檔案庫建立完整版本，適合主動投遞或人脈推薦</p>
                  </div>
                  <div className="flex-1" />
                  <button
                    onClick={handleStartProfileBuild}
                    className="w-full h-11 rounded-xl bg-terra-500 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                    建立通用履歷 →
                  </button>
                </div>

                {/* Card 2: 客製化履歷 */}
                <div className="bg-terra-50 border border-terra-200 rounded-xl p-8 space-y-4 flex flex-col">
                  <div className="space-y-2">
                    <p className="text-xl font-bold text-ink-900">🎯 客製化履歷</p>
                    <p className="text-sm text-ink-500">針對特定職缺 JD 優化，提高 ATS 通過率</p>
                  </div>
                  <div className="flex-1" />
                  {chooserOpt !== 'jd' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setChooserOpt('jd'); setJdSubMode('paste'); setResumeError(''); loadProfileSummaryForJD() }}
                        className="flex-1 rounded-xl border-2 border-terra-300 bg-white py-2.5 text-sm font-medium text-terra-700 hover:bg-terra-100 transition-colors">
                        貼上 JD 開始
                      </button>
                      <button
                        onClick={() => { setChooserOpt('jd'); setJdSubMode('tracker'); setResumeError(''); setSelectedTrackerAppId('') }}
                        className="flex-1 rounded-xl border-2 border-terra-300 bg-white py-2.5 text-sm font-medium text-terra-700 hover:bg-terra-100 transition-colors">
                        從 Tracker 選擇
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Expanded: JD paste — split-column layout */}
              {chooserOpt === 'jd' && jdSubMode === 'paste' && (
                <div className="rounded-xl border border-terra-200 bg-white p-5 space-y-4">
                  <p className="text-sm font-semibold text-ink-700">貼上職位描述（JD）並對照個人檔案庫</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left: JD textarea */}
                    <div className="space-y-2">
                      {trackerJobId ? (
                        <div className="rounded-lg bg-sage-50 border border-sage-200 px-3 py-2 flex items-start gap-2">
                          <span className="text-sage-500 shrink-0 mt-0.5">📋</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-sage-700">來自 Application Tracker</p>
                            <p className="text-xs text-sage-600 truncate">{trackerJobCompany}{trackerJobTitle ? ` — ${trackerJobTitle}` : ''}</p>
                          </div>
                          <button
                            onClick={() => { setTrackerJobId(''); setTrackerJobCompany(''); setTrackerJobTitle(''); setJdText('') }}
                            className="shrink-0 text-xs text-sage-400 hover:text-sage-700 transition-colors">✕ 清除</button>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-ink-500">職位描述（JD）</p>
                      )}
                      <Textarea
                        value={jdText}
                        onChange={(e) => setJdText(e.target.value)}
                        placeholder="貼上職位描述（JD）..."
                        rows={10}
                        className="resize-none text-sm"
                      />
                    </div>
                    {/* Right: Profile summary */}
                    <div className="space-y-3 rounded-xl bg-cream-50 border border-warm-200 p-4">
                      <p className="text-xs font-medium text-ink-500">個人檔案庫摘要（AI 將從此取材）</p>
                      {profileSkillsList.length > 0 ? (
                        <div>
                          <p className="text-xs text-ink-400 mb-1.5">技能</p>
                          <div className="flex flex-wrap gap-1.5">
                            {profileSkillsList.map((s, i) => (
                              <span key={i} className="rounded-full bg-white border border-warm-200 px-2 py-0.5 text-xs text-ink-600">{s}</span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-ink-400">尚未填寫技能</p>
                      )}
                      {profileExpList.length > 0 && (
                        <div>
                          <p className="text-xs text-ink-400 mb-1.5">經驗</p>
                          <div className="space-y-1">
                            {profileExpList.map((e, i) => (
                              <div key={i} className="text-xs text-ink-600">
                                <span className="font-medium">{e.company}</span>
                                {e.title && <span className="text-ink-400"> · {e.title}</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {profileSkillsList.length === 0 && profileExpList.length === 0 && (
                        <p className="text-xs text-ink-400">個人檔案庫尚無資料，建議先前往填寫</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-ink-500 shrink-0">語言：</span>
                    {(['zh', 'en', 'both'] as const).map((l) => (
                      <button key={l} onClick={() => setResumeLang(l)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${resumeLang === l ? 'bg-terra-500 text-white' : 'border border-warm-200 bg-white text-ink-600 hover:border-terra-300'}`}>
                        {l === 'zh' ? '繁體中文' : l === 'en' ? 'English' : '兩份都要'}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => customizeForJD(resumeLang)}
                      disabled={!jdText.trim()}
                      className="flex-1 h-10 rounded-xl bg-terra-500 text-sm font-semibold text-white hover:bg-terra-700 transition-colors disabled:opacity-50 shadow-[var(--shadow-warm-sm)]">
                      開始客製化 →
                    </button>
                    <button onClick={() => { setChooserOpt(null); setJdSubMode(null); if (trackerJobId) { setTrackerJobId(''); setTrackerJobCompany(''); setTrackerJobTitle(''); setJdText('') } }}
                      className="h-10 px-3 rounded-xl border border-warm-200 text-sm text-ink-400 hover:text-ink-700 transition-colors">
                      取消
                    </button>
                  </div>
                  {resumeError && <p className="text-sm text-red-400">{resumeError}</p>}
                </div>
              )}

              {/* Expanded: Application Tracker picker */}
              {chooserOpt === 'jd' && jdSubMode === 'tracker' && (
                <div className="rounded-xl border border-terra-200 bg-white p-5 space-y-3">
                  <p className="text-sm font-semibold text-ink-700">從 Application Tracker 選擇職缺</p>
                  {trackerApps.length === 0 ? (
                    <div className="py-6 text-center space-y-2">
                      <p className="text-sm text-ink-400">Application Tracker 尚無紀錄</p>
                      <Link href="/jobs"
                        className="text-sm text-terra-600 hover:text-terra-700 underline underline-offset-2 transition-colors">
                        前往 Application Tracker →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {trackerApps.map((app) => (
                        <button key={app.id}
                          onClick={() => {
                            setSelectedTrackerAppId(app.id)
                            setJdText(app.jdFullText ?? '')
                          }}
                          className={`w-full flex items-start gap-3 rounded-xl border-2 p-3 text-left transition-all ${selectedTrackerAppId === app.id ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-terra-200'}`}>
                          <span className="text-base mt-0.5">🏢</span>
                          <div>
                            <p className="text-sm font-semibold text-ink-800">{app.company || '（無公司名稱）'}</p>
                            {app.title && <p className="text-xs text-ink-400">{app.title}</p>}
                            {!app.jdFullText && <p className="text-xs text-terra-400 mt-0.5">⚠️ 此職缺尚未填寫 JD</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedTrackerAppId && jdText && (
                    <div className="space-y-2 pt-2 border-t border-warm-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-ink-500 shrink-0">語言：</span>
                        {(['zh', 'en', 'both'] as const).map((l) => (
                          <button key={l} onClick={() => setResumeLang(l)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${resumeLang === l ? 'bg-terra-500 text-white' : 'border border-warm-200 bg-white text-ink-600 hover:border-terra-300'}`}>
                            {l === 'zh' ? '繁體中文' : l === 'en' ? 'English' : '兩份都要'}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => customizeForJD(resumeLang)}
                        className="w-full h-10 rounded-xl bg-terra-500 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                        開始客製化 →
                      </button>
                    </div>
                  )}
                  <button onClick={() => { setChooserOpt(null); setJdSubMode(null); setSelectedTrackerAppId('') }}
                    className="text-sm text-ink-400 hover:text-ink-600 transition-colors">
                    ← 取消
                  </button>
                  {resumeError && <p className="text-sm text-red-400">{resumeError}</p>}
                </div>
              )}

              {/* ── Loading ── */}
              {createMode === 'loading' && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Spinner className="h-8 w-8 text-terra-500" />
                  <p className="text-sm font-medium text-ink-600">
                    {chooserOpt === 'jd' ? '正在針對 JD 客製化履歷...' : '正在從個人檔案庫組裝履歷...'}
                  </p>
                  <p className="text-xs text-ink-400">AI 正在嚴格依照你的個人資料生成，請稍候</p>
                </div>
              )}

            </div>
          )}

          {/* ── LEVEL 3: WYSIWYG Editor ──────────────────────────────────────── */}
          {resumeView === 'edit' && (
            <>
              {editBanner && (
                <div className="border-b border-orange-200 bg-orange-50 px-5 py-2.5 text-sm text-orange-700">
                  <div className="flex items-center gap-2">
                    <span>⚠️</span>
                    <span className="flex-1">{editBanner}</span>
                    <button onClick={() => { setEditBanner(''); setReviewFields([]) }} className="text-orange-400 hover:text-orange-600 transition-colors text-lg leading-none ml-2">✕</button>
                  </div>
                  {reviewFields.length > 0 && (
                    <ul className="mt-2 ml-6 space-y-0.5 list-disc text-xs text-orange-600">
                      {reviewFields.map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {trackerJobId && (pendingResumeType === 'jd' || !editBanner) && (
                <div className="flex items-center gap-2 rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 text-sm text-sage-700">
                  <span>🔗</span>
                  <span className="flex-1">此履歷與 <strong>{trackerJobCompany}</strong>{trackerJobTitle ? ` ${trackerJobTitle}` : ''} 綁定</span>
                  <Link href="/jobs"
                    className="shrink-0 text-xs font-medium text-sage-600 hover:text-sage-800 underline-offset-2 hover:underline transition-colors whitespace-nowrap">
                    查看職缺 →
                  </Link>
                </div>
              )}
              {pendingJdHighlights.length > 0 && (
                <div className="rounded-xl border border-honey-200 bg-honey-50 px-4 py-3">
                  <p className="text-xs font-semibold text-honey-700 mb-2">🎯 JD 關鍵詞（已在此履歷中優先排列）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pendingJdHighlights.map((kw, i) => (
                      <span key={i} className="rounded-full bg-honey-100 border border-honey-300 px-2.5 py-0.5 text-xs text-honey-800">{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            <ResumeEditor
              initialData={editedResume as SavedResumeData}
              initialName={resumeName}
              onSave={(data, name) => {
                const now = new Date().toISOString()
                const existing = resumes.find((r) => r.id === editingResumeId)
                const newId = editingResumeId ?? genId()
                const entry: ResumeEntry = {
                  id: newId,
                  name: name.trim() || data.name || '我的履歷',
                  language: detectLang(data.rawText),
                  score: existing?.score ?? null,
                  atsScore: existing?.atsScore ?? null,
                  scoredAt: existing?.scoredAt ?? null,
                  isPrimary: existing?.isPrimary ?? resumes.length === 0,
                  source: existing?.source ?? 'manual',
                  createdAt: existing?.createdAt ?? now,
                  updatedAt: now,
                  data: data as ParsedResume,
                  resumeType: existing?.resumeType ?? pendingResumeType,
                  linkedJobCompany: existing?.linkedJobCompany ?? (pendingLinkedJobCompany || undefined),
                  linkedJobTitle: existing?.linkedJobTitle ?? (pendingLinkedJobTitle || undefined),
                  jdMatchHighlights: existing?.jdMatchHighlights ?? (pendingJdHighlights.length ? pendingJdHighlights : undefined),
                }
                const next = editingResumeId
                  ? resumes.map((r) => r.id === editingResumeId ? entry : r)
                  : [...resumes, entry]
                persistResumes(next)
                if (!editingResumeId) {
                  setEditingResumeId(newId)
                  if (trackerJobId) linkResumeToTrackerApp(trackerJobId, newId)
                }
              }}
              onBack={() => { setResumeView('list'); setResumeError(''); setEditBanner(''); setReviewFields([]); setPendingJdHighlights([]) }}
              onScoreUpdate={(score, atsScore, scoredAt) => {
                const id = editingResumeId ?? resumes[resumes.length - 1]?.id
                if (!id) return
                const next = resumes.map((r) =>
                  r.id === id ? { ...r, score, atsScore, scoredAt } : r
                )
                persistResumes(next)
              }}
            />
            </>
          )}
        </div>
      )}

      {/* ── Completeness Modal ── */}
      {showCompletenessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 space-y-5">
            <div>
              <p className="text-lg font-bold text-ink-900">個人檔案庫資料不完整</p>
              <p className="text-sm text-ink-500 mt-1">以下項目尚未填寫，補充後可生成更完整的履歷：</p>
            </div>
            <ul className="space-y-2">
              {completenessIssues.map((issue, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-600">
                  <span className="text-honey-500 mt-0.5">⚠️</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Link href="/profile-library"
                className="block w-full text-center rounded-xl bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]"
                onClick={() => setShowCompletenessModal(false)}>
                前往個人檔案庫填寫 →
              </Link>
              <button
                onClick={() => { setShowCompletenessModal(false); setShowLangModal(true) }}
                className="w-full rounded-xl border border-warm-200 px-5 py-2.5 text-sm text-ink-500 hover:text-ink-700 hover:border-warm-300 transition-colors">
                仍要繼續建立
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Language Modal ── */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl p-6 space-y-5">
            <div>
              <p className="text-lg font-bold text-ink-900">選擇履歷語言</p>
              <p className="text-sm text-ink-500 mt-1">AI 將以所選語言生成履歷內容</p>
            </div>
            <div className="space-y-2">
              {([['zh', '繁體中文', '生成一份繁體中文履歷'], ['en', 'English', 'Generate one English resume'], ['both', '兩份都要', '同時生成中英文各一份']] as const).map(([l, label, desc]) => (
                <button key={l} onClick={() => setResumeLang(l)}
                  className={`w-full flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all ${resumeLang === l ? 'border-terra-400 bg-terra-50' : 'border-warm-200 bg-white hover:border-terra-200'}`}>
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${resumeLang === l ? 'border-terra-500' : 'border-warm-300'}`}>
                    {resumeLang === l && <div className="h-2 w-2 rounded-full bg-terra-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ink-800">{label}</p>
                    <p className="text-xs text-ink-400">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => buildFromProfile(resumeLang)}
                className="flex-1 rounded-xl bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                開始建立 →
              </button>
              <button
                onClick={() => setShowLangModal(false)}
                className="rounded-xl border border-warm-200 px-4 py-2.5 text-sm text-ink-400 hover:text-ink-700 transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
