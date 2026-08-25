'use client'

import { useState, useEffect, useRef } from 'react'
import { PageTooltip } from '@/components/onboarding/page-tooltip'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { RateLimitToast } from '@/components/ui/rate-limit-toast'
import Link from 'next/link'
import { SourceBadge } from '@/components/SourceBadge'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SalaryData { role: string; industry: string; experience: string; median: number; p25: number; p75: number; source: string; notes: string }
interface Trend { industry: string; trend: 'up' | 'stable' | 'down'; hotJobs: string[]; notes: string }

type SourceType = 'search_result' | 'jd_inference' | 'general_inference' | null

interface SourcedText {
  content: string | null
  source: SourceType
  sourceUrl?: string | null
}

interface DeepReport {
  basicInfo: SourcedText
  culture: SourcedText
  rolePosition: SourcedText
  interviewProcess: SourcedText
  salaryNegotiation: SourcedText
  competitors: { names: string[]; source: SourceType; sourceUrl?: string | null }
  roleTrend?: {
    recruitmentHeat: string | null
    topSkills: string[]
    threeMonthTrend: string | null
    source: SourceType
    sourceUrl?: string | null
  }
}

interface CompanyAnalysisRecord {
  id: string
  jobId: string | null
  company: string
  title: string
  industry: string
  salaryData: SalaryData | null
  deepReport: DeepReport | null
  analyzedAt: string
  createdAt: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const TREND_CFG = {
  up:     { icon: '↑', label: '需求上升', color: 'text-sage-600', badge: 'success' as const },
  stable: { icon: '→', label: '穩定',     color: 'text-ink-400',  badge: 'default' as const },
  down:   { icon: '↓', label: '需求下降', color: 'text-red-400',  badge: 'danger'  as const },
}

const INDUSTRIES = ['科技業', '金融業', '電商/零售業', '製造業', '醫療/生技', '媒體/廣告', '顧問/服務業', '教育', '政府/非營利', '其他']

const SALARY_VERIFY = [
  { label: '104 薪資情報',          url: 'https://www.104.com.tw/salary/' },
  { label: '主計處薪資查詢',         url: 'https://earnings.dgbas.gov.tw/' },
  { label: 'CakeResume 薪資透明化', url: 'https://www.cakeresume.com/resources/salary' },
]
const TREND_VERIFY = [
  { label: '104 人力銀行產業報告', url: 'https://www.104.com.tw/jobs/main/' },
  { label: '商周產業報告',         url: 'https://www.businessweekly.com.tw/' },
]
const COMPANY_VERIFY = [
  { label: '面試趣',      url: 'https://interviewing.tw/' },
  { label: 'Glassdoor',  url: 'https://www.glassdoor.com/' },
  { label: '公開資訊觀測站', url: 'https://mops.twse.com.tw/' },
]

const DEEP_CARDS: { icon: string; title: string; key: keyof Pick<DeepReport, 'basicInfo' | 'culture' | 'rolePosition' | 'interviewProcess' | 'salaryNegotiation'> }[] = [
  { icon: '🏢', title: '基本資訊', key: 'basicInfo'         },
  { icon: '🎭', title: '企業文化', key: 'culture'           },
  { icon: '🎯', title: '職位定位', key: 'rolePosition'      },
  { icon: '📝', title: '面試情報', key: 'interviewProcess'  },
  { icon: '💰', title: '談薪建議', key: 'salaryNegotiation' },
]

const CACHE_KEY = 'company-analyses'

// ── localStorage helpers ───────────────────────────────────────────────────────

function loadAllCached(): CompanyAnalysisRecord[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as CompanyAnalysisRecord[] : []
  } catch { return [] }
}

function saveToCache(record: CompanyAnalysisRecord): void {
  try {
    const all = loadAllCached()
    const idx = record.jobId
      ? all.findIndex((r) => r.jobId === record.jobId)
      : all.findIndex((r) => !r.jobId && r.company.toLowerCase() === record.company.toLowerCase())
    const next = idx >= 0 ? [...all.slice(0, idx), record, ...all.slice(idx + 1)] : [record, ...all]
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch { /* quota */ }
}

function getCachedByJobId(jobId: string): CompanyAnalysisRecord | null {
  if (!jobId) return null
  try { return loadAllCached().find((r) => r.jobId === jobId) ?? null } catch { return null }
}

function getCachedByCompany(company: string): CompanyAnalysisRecord | null {
  if (!company) return null
  try { return loadAllCached().find((r) => !r.jobId && r.company.toLowerCase() === company.toLowerCase()) ?? null } catch { return null }
}

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }

function relTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1)   return '剛剛'
  if (mins < 60)  return `${mins} 分鐘前`
  if (mins < 1440) return `${Math.floor(mins / 60)} 小時前`
  return `${Math.floor(mins / 1440)} 天前`
}

// ── Small UI helpers ───────────────────────────────────────────────────────────

function Skel({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={`h-3 bg-warm-200 rounded ${i === 0 ? 'w-full' : i % 2 === 0 ? 'w-4/5' : 'w-3/5'}`} />
      ))}
    </div>
  )
}

function VerifyLinks({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="pt-3 mt-3 border-t border-warm-100">
      <p className="text-xs text-ink-300 mb-1">建議自行驗證來源：</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {links.map(({ label, url }) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-ink-300 hover:text-ink-400 underline">
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}

function NullContent({ links }: { links: { label: string; url: string }[] }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-400">— 資料不足，建議查詢：</p>
      <div className="flex flex-wrap gap-2">
        {links.map(({ label, url }) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer"
            className="text-xs text-terra-400 hover:text-terra-500 underline">{label}</a>
        ))}
      </div>
    </div>
  )
}

// ── CompanyReportView — reusable report display ────────────────────────────────

function CompanyReportView({
  trackerSalary, trackerSalaryLoading,
  deepReport, deepReportLoading, deepReportError,
  trackerTitle, trackerIndustry, trackerCompany,
  fmt, onRetry, onCompetitorClick,
}: {
  trackerSalary: SalaryData | null; trackerSalaryLoading: boolean
  deepReport: DeepReport | null; deepReportLoading: boolean; deepReportError: string
  trackerTitle: string; trackerIndustry: string; trackerCompany: string
  fmt: (n: number) => string
  onRetry: () => void
  onCompetitorClick: (c: string) => void
}) {
  return (
    <>
      {/* Block A: 薪資行情 */}
      <Card>
        <CardHeader><CardTitle>💰 薪資行情</CardTitle></CardHeader>
        <CardContent>
          {trackerSalaryLoading && <Skel lines={5} />}
          {!trackerSalaryLoading && trackerSalary && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'P25 低標', val: trackerSalary.p25,    dim: true  },
                  { label: '中位數',   val: trackerSalary.median, dim: false },
                  { label: 'P75 高標', val: trackerSalary.p75,    dim: true  },
                ].map((tier) => (
                  <div key={tier.label} className={`rounded-2xl p-4 text-center ${tier.dim ? 'bg-cream-100' : 'bg-terra-50 border border-terra-400/30'}`}>
                    <p className={`text-xs mb-1 ${tier.dim ? 'text-ink-500' : 'text-terra-500 font-medium'}`}>{tier.label}</p>
                    <p className={`text-lg font-bold ${tier.dim ? 'text-ink-600' : 'text-terra-600'}`}>{fmt(tier.val)}</p>
                    <p className="text-xs text-ink-400 mt-0.5">NTD / 月</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-cream-100 px-3 py-2">
                  <p className="text-xs text-ink-400">年薪估算（月薪×14）</p>
                  <p className="text-sm font-semibold text-ink-700">{fmt(trackerSalary.median * 14)} NTD</p>
                </div>
                <div className="rounded-xl bg-cream-100 px-3 py-2">
                  <p className="text-xs text-ink-400">產業別</p>
                  <p className="text-sm font-medium text-ink-700">{trackerSalary.industry || trackerIndustry || '—'}</p>
                </div>
              </div>
              {trackerSalary.notes && <p className="text-xs text-ink-500 leading-relaxed">{trackerSalary.notes}</p>}
            </div>
          )}
          {!trackerSalaryLoading && !trackerSalary && (
            <p className="text-sm text-ink-400 mb-2">
              {trackerTitle ? '薪資查詢失敗，請稍後再試' : '未提供職位名稱，無法查詢薪資行情'}
            </p>
          )}
          <VerifyLinks links={SALARY_VERIFY} />
        </CardContent>
      </Card>

      {/* Block B: 產業趨勢 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>📊 產業趨勢</CardTitle>
            <span className="rounded-full border border-honey-200 bg-honey-50 px-2 py-0.5 text-xs text-honey-600">AI 分析，僅供參考</span>
          </div>
        </CardHeader>
        <CardContent>
          {deepReportLoading && <Skel lines={5} />}
          {!deepReportLoading && deepReport?.roleTrend && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                {deepReport.roleTrend.recruitmentHeat && (
                  <>
                    <span className="text-sm text-ink-500">招募熱度：</span>
                    <Badge variant={
                      deepReport.roleTrend.recruitmentHeat === '高' ? 'success' :
                      deepReport.roleTrend.recruitmentHeat === '低' ? 'danger' : 'default'
                    }>
                      {deepReport.roleTrend.recruitmentHeat}
                    </Badge>
                  </>
                )}
                <SourceBadge source={deepReport.roleTrend.source} sourceUrl={deepReport.roleTrend.sourceUrl} />
              </div>
              {(deepReport.roleTrend.topSkills?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-ink-400 mb-1.5">熱門技能（Top 5）</p>
                  <div className="flex flex-wrap gap-1.5">
                    {deepReport.roleTrend.topSkills.map((s) => <Badge key={s} variant="terra">{s}</Badge>)}
                  </div>
                </div>
              )}
              {deepReport.roleTrend.threeMonthTrend ? (
                <div>
                  <p className="text-xs text-ink-400 mb-1">近 3 個月趨勢</p>
                  <p className="text-sm text-ink-600 leading-relaxed">{deepReport.roleTrend.threeMonthTrend}</p>
                </div>
              ) : (
                <NullContent links={TREND_VERIFY} />
              )}
            </div>
          )}
          {!deepReportLoading && deepReport && !deepReport.roleTrend && <NullContent links={TREND_VERIFY} />}
          <VerifyLinks links={TREND_VERIFY} />
        </CardContent>
      </Card>

      {/* Block C: 公司深度分析 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-ink-800">🏢 公司深度分析</h3>
          {!deepReportLoading && deepReport && <span className="text-xs text-ink-400">各欄位標示資料來源類型</span>}
        </div>

        {deepReportLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}><CardContent className="pt-5"><Skel lines={4} /></CardContent></Card>
            ))}
          </div>
        )}

        {deepReportError && (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <p className="text-sm text-red-500">{deepReportError}</p>
            <button onClick={onRetry} className="ml-auto shrink-0 text-xs text-terra-500 hover:underline">重試</button>
          </div>
        )}

        {deepReport && !deepReportLoading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {DEEP_CARDS.map(({ icon, title, key }) => {
              const field = deepReport[key] as SourcedText
              return (
                <Card key={key}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle>{icon} {title}</CardTitle>
                      <SourceBadge source={field?.source ?? null} sourceUrl={field?.sourceUrl} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {field?.content ? (
                      <p className="text-sm text-ink-600 leading-relaxed whitespace-pre-line">{field.content}</p>
                    ) : (
                      <NullContent links={COMPANY_VERIFY} />
                    )}
                    <VerifyLinks links={COMPANY_VERIFY} />
                  </CardContent>
                </Card>
              )
            })}

            {(deepReport.competitors?.names?.length ?? 0) > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>🏆 主要競爭對手</CardTitle>
                    <SourceBadge source={deepReport.competitors?.source ?? null} sourceUrl={deepReport.competitors?.sourceUrl} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {deepReport.competitors.names.map((c) => (
                      <button key={c} onClick={() => onCompetitorClick(c)}
                        className="rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-sm text-ink-700 hover:border-terra-300 hover:bg-terra-50 transition-all">
                        {c} →
                      </button>
                    ))}
                  </div>
                  <VerifyLinks links={COMPANY_VERIFY} />
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CareerIntelligencePage() {
  const [tab, setTab] = useState<'salary' | 'trends' | 'company'>('salary')

  // Salary tab
  const [salaryRole, setSalaryRole] = useState('')
  const [experience, setExperience] = useState('')
  const [salaryData, setSalaryData] = useState<SalaryData | null>(null)
  const [loadingSalary, setLoadingSalary] = useState(false)

  // Trends tab
  const [trends, setTrends] = useState<Trend[]>([])
  const [loadingTrends, setLoadingTrends] = useState(false)

  // Company tab — tracker origin
  const [trackerJobId, setTrackerJobId] = useState('')
  const [trackerCompany, setTrackerCompany] = useState('')
  const [trackerTitle, setTrackerTitle] = useState('')
  const [trackerIndustry, setTrackerIndustry] = useState('')

  // Company tab — analysis results
  const [trackerSalary, setTrackerSalary] = useState<SalaryData | null>(null)
  const [trackerSalaryLoading, setTrackerSalaryLoading] = useState(false)
  const [deepReport, setDeepReport] = useState<DeepReport | null>(null)
  const [deepReportLoading, setDeepReportLoading] = useState(false)
  const [deepReportError, setDeepReportError] = useState('')
  const [rateLimitToast, setRateLimitToast] = useState(false)

  // Company tab — cache & history
  const [allAnalyses, setAllAnalyses] = useState<CompanyAnalysisRecord[]>([])
  const [cachedRecord, setCachedRecord] = useState<CompanyAnalysisRecord | null>(null)
  const [viewingRecord, setViewingRecord] = useState<CompanyAnalysisRecord | null>(null)

  // Company tab — manual entry form
  const [formCompany, setFormCompany] = useState('')
  const [formTitle, setFormTitle] = useState('')
  const [formIndustry, setFormIndustry] = useState('')

  const analysisRunRef = useRef(false)

  const fmt = (n: number) => new Intl.NumberFormat('zh-TW').format(n)

  // ── Functions ────────────────────────────────────────────────────────────────

  async function querySalary() {
    if (!salaryRole.trim()) return
    setLoadingSalary(true); setSalaryData(null)
    try {
      const res = await fetch(`/api/salary?${new URLSearchParams({ role: salaryRole, experience: experience || '3年' })}`)
      setSalaryData(await res.json())
    } catch { /* silent */ }
    finally { setLoadingSalary(false) }
  }

  async function loadTrends() {
    setLoadingTrends(true); setTrends([])
    try {
      const res = await fetch('/api/trends')
      const data = await res.json(); setTrends(data.trends ?? [])
    } catch { /* silent */ }
    finally { setLoadingTrends(false) }
  }

  async function fetchSalary(role: string): Promise<SalaryData | null> {
    if (!role.trim()) return null
    setTrackerSalaryLoading(true); setTrackerSalary(null)
    try {
      const res = await fetch(`/api/salary?${new URLSearchParams({ role, experience: '不限' })}`)
      const data: SalaryData = await res.json()
      setTrackerSalary(data); return data
    } catch { return null }
    finally { setTrackerSalaryLoading(false) }
  }

  async function fetchDeepReport(company: string, title: string, jdContent: string): Promise<DeepReport | null> {
    setDeepReportLoading(true); setDeepReport(null); setDeepReportError('')
    try {
      const res = await fetch('/api/analytics/company-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, title, jd_content: jdContent }),
      })
      const data = await res.json()
      if (data.error === 'rate_limit') { setRateLimitToast(true); return null }
      if (!res.ok) throw new Error(data.error ?? '分析失敗')
      setDeepReport(data); return data as DeepReport
    } catch (e) { setDeepReportError((e as Error).message); return null }
    finally { setDeepReportLoading(false) }
  }

  async function runAndSave(company: string, title: string, industry: string, jobId: string, jdContent = '') {
    const [salaryResult, deepResult] = await Promise.all([
      title ? fetchSalary(title) : Promise.resolve(null),
      fetchDeepReport(company, title, jdContent),
    ])
    const record: CompanyAnalysisRecord = {
      id: genId(), jobId: jobId || null,
      company, title, industry,
      salaryData: salaryResult,
      deepReport: deepResult,
      analyzedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    saveToCache(record)
    setCachedRecord(record)
    setAllAnalyses(loadAllCached())
  }

  function restoreFromRecord(record: CompanyAnalysisRecord) {
    setTrackerCompany(record.company)
    setTrackerTitle(record.title)
    setTrackerIndustry(record.industry)
    setTrackerJobId(record.jobId ?? '')
    setTrackerSalary(record.salaryData)
    setDeepReport(record.deepReport)
    setDeepReportError('')
    setCachedRecord(record)
  }

  function clearTrackerLink() {
    setTrackerCompany(''); setTrackerJobId(''); setTrackerTitle(''); setTrackerIndustry('')
    setTrackerSalary(null); setDeepReport(null); setDeepReportError('')
    setCachedRecord(null); setViewingRecord(null)
    if (typeof window !== 'undefined') window.history.replaceState({}, '', '/analytics')
  }

  function startManualAnalysis() {
    if (!formCompany.trim()) return
    setTrackerCompany(formCompany); setTrackerTitle(formTitle)
    setTrackerIndustry(formIndustry); setTrackerJobId('')
    setTrackerSalary(null); setDeepReport(null); setCachedRecord(null)

    const existingCache = getCachedByCompany(formCompany)
    if (existingCache) {
      restoreFromRecord(existingCache)
      return
    }
    runAndSave(formCompany, formTitle, formIndustry, '', '')
  }

  useEffect(() => {
    // Load history on mount
    setAllAnalyses(loadAllCached())

    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const company = p.get('company') ?? ''
    if (!company) return
    const jobId   = p.get('jobId')   ?? ''
    const title   = p.get('title')   ?? ''
    const industry = p.get('industry') ?? ''

    setTrackerCompany(company); setTrackerJobId(jobId); setTrackerTitle(title); setTrackerIndustry(industry)
    setTab('company')

    // Check cache first
    const cached = jobId ? getCachedByJobId(jobId) : getCachedByCompany(company)
    if (cached) {
      restoreFromRecord(cached)
      return
    }

    // No cache — run fresh analysis
    if (!analysisRunRef.current) {
      analysisRunRef.current = true
      runAndSave(company, title, industry, jobId, '')
    }
  }, []) // eslint-disable-line

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 space-y-5">
      <PageTooltip pageKey="analytics" />
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-ink-900">◉ Analytics</h1>
        <p className="mt-1 text-sm text-ink-500">薪資行情 · 產業趨勢 · 公司分析</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl border border-warm-200 bg-white p-1 w-full sm:w-fit shadow-[var(--shadow-warm-xs)] overflow-x-auto">
        {([
          ['salary',  '💰 薪資查詢'],
          ['trends',  '📈 產業趨勢'],
          ['company', '🏢 公司分析'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${tab === t ? 'bg-cream-200 text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Salary ─────────────────────────────────────────────────────────── */}
      {tab === 'salary' && (
        <div className="space-y-5 max-w-2xl">
          {/* If came from tracker and have cached salary, show it automatically */}
          {trackerJobId && cachedRecord?.salaryData && (
            <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 flex items-center gap-3">
              <span className="text-xs text-sage-700">
                📋 顯示「{cachedRecord.company}{cachedRecord.title ? ` — ${cachedRecord.title}` : ''}」的已快取薪資行情
              </span>
              <button onClick={() => setTab('company')} className="ml-auto text-xs text-sage-600 hover:underline shrink-0">查看完整報告 →</button>
            </div>
          )}
          {trackerJobId && cachedRecord?.salaryData ? (
            <Card className="border-terra-100">
              <CardHeader><CardTitle>{cachedRecord.salaryData.role} · {cachedRecord.salaryData.experience}</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'P25 低標', val: cachedRecord.salaryData.p25,    dim: true  },
                    { label: '中位數',   val: cachedRecord.salaryData.median, dim: false },
                    { label: 'P75 高標', val: cachedRecord.salaryData.p75,    dim: true  },
                  ].map((tier) => (
                    <div key={tier.label} className={`rounded-2xl p-4 text-center ${tier.dim ? 'bg-cream-100' : 'bg-terra-50 border border-terra-400/30'}`}>
                      <p className={`text-xs mb-1 ${tier.dim ? 'text-ink-500' : 'text-terra-500 font-medium'}`}>{tier.label}</p>
                      <p className={`font-bold ${tier.dim ? 'text-lg text-ink-600' : 'text-2xl text-terra-600'}`}>{fmt(tier.val)}</p>
                      <p className="text-xs text-ink-400 mt-0.5">NTD / 月</p>
                    </div>
                  ))}
                </div>
                {cachedRecord.salaryData.notes && (
                  <div className="rounded-xl border border-amber-500/20 bg-honey-500/5 p-4">
                    <p className="text-xs font-semibold text-honey-500 mb-1">🤖 AI 說明</p>
                    <p className="text-sm text-ink-600">{cachedRecord.salaryData.notes}</p>
                  </div>
                )}
                <VerifyLinks links={SALARY_VERIFY} />
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle>薪資行情查詢</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input label="職位" placeholder="例如：軟體工程師" value={salaryRole} onChange={(e) => setSalaryRole(e.target.value)} className="flex-1" />
                    <Input label="年資" placeholder="例如：3年、應屆" value={experience} onChange={(e) => setExperience(e.target.value)} className="sm:w-32" />
                  </div>
                  <Button variant="primary" onClick={querySalary} loading={loadingSalary} disabled={!salaryRole.trim()}>🔍 查詢薪資</Button>
                </CardContent>
              </Card>

              {salaryData && (
                <Card className="border-terra-100">
                  <CardHeader><CardTitle>{salaryData.role} · {salaryData.experience}</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'P25 低標', val: salaryData.p25,    dim: true  },
                        { label: '中位數',   val: salaryData.median, dim: false },
                        { label: 'P75 高標', val: salaryData.p75,    dim: true  },
                      ].map((tier) => (
                        <div key={tier.label} className={`rounded-2xl p-4 text-center ${tier.dim ? 'bg-cream-100' : 'bg-terra-50 border border-terra-400/30'}`}>
                          <p className={`text-xs mb-1 ${tier.dim ? 'text-ink-500' : 'text-terra-500 font-medium'}`}>{tier.label}</p>
                          <p className={`text-lg font-bold ${tier.dim ? 'text-ink-600' : 'text-terra-600'}`}>{fmt(tier.val)}</p>
                          <p className="text-xs text-ink-400 mt-0.5">NTD / 月</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-honey-500/5 p-4">
                      <p className="text-xs font-semibold text-honey-500 mb-1">🤖 AI 說明</p>
                      <p className="text-sm text-ink-600">{salaryData.notes}</p>
                    </div>
                    <p className="text-xs text-ink-400">資料來源：{salaryData.source}</p>
                    <VerifyLinks links={SALARY_VERIFY} />
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Trends ─────────────────────────────────────────────────────────── */}
      {tab === 'trends' && (
        <div className="space-y-5">
          {/* If came from tracker and have cached trend data, show it automatically */}
          {trackerJobId && cachedRecord?.deepReport?.roleTrend && (
            <div className="rounded-xl border border-sage-200 bg-sage-50 px-4 py-2.5 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs text-sage-700">
                  📋 已快取：{cachedRecord.company}{cachedRecord.title ? ` — ${cachedRecord.title}` : ''} 的職缺趨勢
                </span>
                <button onClick={() => setTab('company')} className="ml-auto text-xs text-sage-600 hover:underline shrink-0">查看完整報告 →</button>
              </div>
              {cachedRecord.deepReport.roleTrend.recruitmentHeat && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink-600">招募熱度：</span>
                  <Badge variant={
                    cachedRecord.deepReport.roleTrend.recruitmentHeat === '高' ? 'success' :
                    cachedRecord.deepReport.roleTrend.recruitmentHeat === '低' ? 'danger' : 'default'
                  }>{cachedRecord.deepReport.roleTrend.recruitmentHeat}</Badge>
                </div>
              )}
              {(cachedRecord.deepReport.roleTrend.topSkills?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cachedRecord.deepReport.roleTrend.topSkills.map((s) => <Badge key={s} variant="terra">{s}</Badge>)}
                </div>
              )}
            </div>
          )}
          <Button variant="outline" onClick={loadTrends} loading={loadingTrends}>🔄 載入最新產業趨勢</Button>
          {trends.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {trends.map((t, i) => {
                const cfg = TREND_CFG[t.trend]
                return (
                  <Card key={i}>
                    <CardContent className="pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-ink-700">{t.industry}</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${cfg.color}`}>{cfg.icon}</span>
                          <Badge variant={cfg.badge}>{cfg.label}</Badge>
                        </div>
                      </div>
                      <div className="mb-3">
                        <p className="text-xs text-ink-400 mb-1.5">熱門職缺</p>
                        <div className="flex flex-wrap gap-1">{t.hotJobs.map((j) => <Badge key={j} variant="terra">{j}</Badge>)}</div>
                      </div>
                      <p className="text-xs text-ink-500 leading-relaxed">{t.notes}</p>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          ) : !loadingTrends && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-4xl mb-3">📊</p>
              <p className="text-sm text-ink-500">點擊上方按鈕載入最新台灣產業趨勢</p>
            </div>
          )}
        </div>
      )}

      {/* ── Company Analysis ────────────────────────────────────────────────── */}
      {tab === 'company' && (
        <div className="space-y-4">

          {/* ── Viewing a history record ── */}
          {viewingRecord && !trackerCompany && (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setViewingRecord(null)}
                  className="text-sm text-ink-400 hover:text-ink-700 transition-colors">
                  ← 返回列表
                </button>
                <div className="flex-1" />
                <span className="text-xs text-ink-400">分析於 {relTime(viewingRecord.analyzedAt)}</span>
                <button
                  onClick={() => {
                    setTrackerCompany(viewingRecord.company); setTrackerTitle(viewingRecord.title)
                    setTrackerIndustry(viewingRecord.industry); setTrackerJobId(viewingRecord.jobId ?? '')
                    setTrackerSalary(null); setDeepReport(null); setDeepReportError(''); setCachedRecord(null)
                    setViewingRecord(null)
                    runAndSave(viewingRecord.company, viewingRecord.title, viewingRecord.industry, viewingRecord.jobId ?? '', '')
                  }}
                  className="rounded-lg border border-warm-200 px-3 py-1 text-xs text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all">
                  🔄 重新分析
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="rounded-xl bg-terra-50 border border-terra-100 px-4 py-2">
                  <p className="text-xs text-ink-400">公司</p>
                  <p className="font-semibold text-ink-800">{viewingRecord.company}</p>
                </div>
                {viewingRecord.title && (
                  <div className="rounded-xl bg-cream-100 border border-warm-200 px-4 py-2">
                    <p className="text-xs text-ink-400">職位</p>
                    <p className="font-medium text-ink-700">{viewingRecord.title}</p>
                  </div>
                )}
              </div>
              <CompanyReportView
                trackerSalary={viewingRecord.salaryData}
                trackerSalaryLoading={false}
                deepReport={viewingRecord.deepReport}
                deepReportLoading={false}
                deepReportError=""
                trackerTitle={viewingRecord.title}
                trackerIndustry={viewingRecord.industry}
                trackerCompany={viewingRecord.company}
                fmt={fmt}
                onRetry={() => {}}
                onCompetitorClick={(c) => {
                  setViewingRecord(null)
                  setTrackerCompany(c); setTrackerTitle(''); setTrackerIndustry(''); setTrackerJobId('')
                  setTrackerSalary(null); setDeepReport(null); setCachedRecord(null)
                  runAndSave(c, '', '', '', '')
                }}
              />
            </>
          )}

          {/* ── Active analysis (from tracker or manual) ── */}
          {trackerCompany && !viewingRecord && (
            <>
              {/* Tracker origin banner */}
              {trackerJobId && (
                <div className="flex items-center gap-3 rounded-xl border border-sage-200 bg-sage-50 px-4 py-3">
                  <span className="text-sm text-sage-700">
                    📋 來自 Application Tracker：<strong>{trackerCompany}</strong>
                    {trackerTitle && ` — ${trackerTitle}`}
                  </span>
                  <button onClick={clearTrackerLink}
                    className="ml-auto shrink-0 text-xs text-ink-400 hover:text-ink-600 transition-colors">
                    ✕ 清除
                  </button>
                </div>
              )}

              {/* Company header with cache metadata */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <div className="rounded-xl bg-terra-50 border border-terra-100 px-4 py-2">
                    <p className="text-xs text-ink-400">公司</p>
                    <p className="font-semibold text-ink-800">{trackerCompany}</p>
                  </div>
                  {trackerTitle && (
                    <div className="rounded-xl bg-cream-100 border border-warm-200 px-4 py-2">
                      <p className="text-xs text-ink-400">職位</p>
                      <p className="font-medium text-ink-700">{trackerTitle}</p>
                    </div>
                  )}
                  {trackerIndustry && (
                    <div className="rounded-xl bg-cream-100 border border-warm-200 px-4 py-2">
                      <p className="text-xs text-ink-400">產業</p>
                      <p className="font-medium text-ink-700">{trackerIndustry}</p>
                    </div>
                  )}
                  {cachedRecord && (
                    <span className="text-xs text-ink-400">分析時間：{relTime(cachedRecord.analyzedAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {cachedRecord && (
                    <button
                      onClick={() => {
                        setCachedRecord(null); setTrackerSalary(null); setDeepReport(null); setDeepReportError('')
                        runAndSave(trackerCompany, trackerTitle, trackerIndustry, trackerJobId, '')
                      }}
                      className="rounded-lg border border-warm-200 px-3 py-1 text-xs text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all">
                      🔄 重新分析
                    </button>
                  )}
                  <button onClick={clearTrackerLink}
                    className="text-xs text-ink-400 hover:text-terra-500 transition-colors">
                    重新搜尋
                  </button>
                </div>
              </div>

              <CompanyReportView
                trackerSalary={trackerSalary}
                trackerSalaryLoading={trackerSalaryLoading}
                deepReport={deepReport}
                deepReportLoading={deepReportLoading}
                deepReportError={deepReportError}
                trackerTitle={trackerTitle}
                trackerIndustry={trackerIndustry}
                trackerCompany={trackerCompany}
                fmt={fmt}
                onRetry={() => fetchDeepReport(trackerCompany, trackerTitle, '')}
                onCompetitorClick={(c) => {
                  setTrackerSalary(null); setDeepReport(null); setDeepReportError(''); setCachedRecord(null)
                  setTrackerCompany(c); setTrackerTitle(''); setTrackerIndustry(''); setTrackerJobId('')
                  runAndSave(c, '', '', '', '')
                }}
              />
            </>
          )}

          {/* ── No active company: history list or form ── */}
          {!trackerCompany && !viewingRecord && (
            <>
              {/* Manual entry form */}
              <div className="max-w-lg space-y-3">
                <Card>
                  <CardHeader><CardTitle>開始分析目標公司</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      label="公司名稱 *"
                      placeholder="例如：台積電、LINE Taiwan、Shopee"
                      value={formCompany}
                      onChange={(e) => setFormCompany(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && startManualAnalysis()}
                    />
                    <Input
                      label="應徵職位（選填）"
                      placeholder="例如：軟體工程師、產品經理"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                    />
                    <div>
                      <label className="block text-xs font-medium text-ink-500 mb-1.5">產業別（選填）</label>
                      <select
                        className="w-full rounded-xl border border-warm-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-terra-400 focus:outline-none"
                        value={formIndustry}
                        onChange={(e) => setFormIndustry(e.target.value)}>
                        <option value="">請選擇（可略）</option>
                        {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
                      </select>
                    </div>
                    <Button variant="primary" onClick={startManualAnalysis} loading={deepReportLoading} disabled={!formCompany.trim()}>
                      🔍 開始分析
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* History list */}
              {allAnalyses.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-ink-800 text-sm">📋 已分析的職缺報告</h3>
                  <div className="divide-y divide-warm-100 rounded-xl border border-warm-200 bg-white overflow-hidden">
                    {allAnalyses.map((rec) => (
                      <div key={rec.id} className="flex items-center gap-3 px-4 py-3 hover:bg-cream-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-ink-800 truncate">{rec.company}</p>
                          <p className="text-xs text-ink-500 truncate">
                            {rec.title && <span>{rec.title}</span>}
                            {rec.title && rec.industry && <span className="mx-1 text-warm-300">·</span>}
                            {rec.industry && <span>{rec.industry}</span>}
                          </p>
                        </div>
                        <span className="text-xs text-ink-400 shrink-0">{relTime(rec.analyzedAt)}</span>
                        <button
                          onClick={() => setViewingRecord(rec)}
                          className="shrink-0 rounded-lg border border-warm-200 bg-white px-3 py-1.5 text-xs font-medium text-ink-600 hover:border-terra-300 hover:text-terra-600 transition-all whitespace-nowrap">
                          查看報告 →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <p className="text-4xl mb-3">🏢</p>
                  <p className="text-sm text-ink-500">AI 提供薪資行情、產業趨勢、企業文化、面試情報、談薪建議</p>
                  <p className="text-xs text-ink-400 mt-1">也可從 Application Tracker「面試準備」Tab 直接連動</p>
                  <Link href="/jobs"
                    className="mt-3 text-sm text-terra-500 hover:text-terra-700 transition-colors">
                    前往 Application Tracker →
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <RateLimitToast visible={rateLimitToast} onDismiss={() => setRateLimitToast(false)} />
    </div>
  )
}
