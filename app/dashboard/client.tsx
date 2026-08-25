'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { WelcomeModal } from '@/components/onboarding/welcome-modal'

// ── Types ──────────────────────────────────────────────────────────────────────

interface MoodEntry { date: string; mood: string }
interface DayPoint  { mood: string | null; dayLabel: string }

interface TaskDef {
  id: string
  label: string
  time: string
  desc: string
  href: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MOODS = [
  { key: 'energetic',  emoji: '😊', label: '充滿幹勁', score: 5 },
  { key: 'neutral',    emoji: '😐', label: '普通',     score: 3 },
  { key: 'sad',        emoji: '😔', label: '有點沮喪', score: 2 },
  { key: 'frustrated', emoji: '😤', label: '很挫折',   score: 2 },
  { key: 'tired',      emoji: '😴', label: '疲憊',     score: 1 },
]
const MOOD_SCORE: Record<string, number> = Object.fromEntries(MOODS.map(m => [m.key, m.score]))
const NEGATIVE_MOODS = new Set(['sad', 'frustrated', 'tired'])

const STATUS_CFG: Record<string, { label: string; dot: string; textColor: string }> = {
  saved:        { label: '已儲存',   dot: 'bg-warm-300',  textColor: 'text-ink-400' },
  applied:      { label: '已投遞',   dot: 'bg-sage-400',  textColor: 'text-sage-600' },
  hr_screen:    { label: '人資初篩', dot: 'bg-honey-400', textColor: 'text-honey-500' },
  phone_screen: { label: '電話面試', dot: 'bg-honey-400', textColor: 'text-honey-500' },
  interview:    { label: '面試中',   dot: 'bg-terra-400', textColor: 'text-terra-600' },
  offer:        { label: 'Offer ✓', dot: 'bg-sage-500',  textColor: 'text-sage-700' },
}

const PIPELINE_ITEMS = [
  { company: 'LINE Taiwan', role: '前端工程師',    status: 'interview',   daysAgo: 0 },
  { company: '台積電',       role: '軟體工程師',    status: 'applied',     daysAgo: 3 },
  { company: 'Shopee',      role: 'Frontend Lead', status: 'saved',       daysAgo: 1 },
]

const SCORE_BREAKDOWN = [
  { label: '履歷',     value: 0,  max: 30, color: '#C97941', note: '尚未上傳',   href: '/resume-lab' },
  { label: '技能庫',   value: 10, max: 20, color: '#7FA887', note: '10 項技能',  href: '/dashboard/skills' },
  { label: '職缺追蹤', value: 15, max: 25, color: '#D4A25A', note: '4 筆記錄',   href: '/jobs' },
  { label: '面試練習', value: 0,  max: 25, color: '#B8A090', note: '0 道練習',   href: '/interviews' },
]

const QUICK_LINKS = [
  { label: '上傳履歷', href: '/resume-lab',  symbol: '↑',  bg: '#FBF2EA', border: '#EDD9C8', color: '#C97941' },
  { label: '技能落差', href: '/skill-map',   symbol: '⚡', bg: '#FBF7ED', border: '#EDE3C8', color: '#B8922A' },
  { label: '面試練習', href: '/interviews',  symbol: '🎤', bg: '#F2F7F3', border: '#D0E3D2', color: '#5E8F68' },
  { label: '新增職缺', href: '/jobs',    symbol: '＋', bg: '#F3ECE4', border: '#E6DDD2', color: '#8B7B70' },
]

// ── Personalized task presets ──────────────────────────────────────────────────

const DEFAULT_TASKS: TaskDef[] = [
  { id: 'resume',   label: '上傳或完善履歷',  time: '5 分鐘',  desc: 'AI 評分，找出改善方向', href: '/resume-lab' },
  { id: 'skills',   label: '更新技能庫',      time: '3 分鐘',  desc: '比對職缺，找出技能落差', href: '/dashboard/skills' },
  { id: 'practice', label: '練習一道面試題',  time: '10 分鐘', desc: 'AI 即時回饋，提升表達力', href: '/interviews' },
]

const TASK_PRESETS: Record<string, TaskDef[]> = {
  'active_search+resume': [
    { id: 'upload',  label: '上傳履歷 AI 評分', time: '5 分鐘', desc: 'AI 立即評分，找出改善方向', href: '/resume-lab' },
    { id: 'skills',  label: '更新技能庫',        time: '3 分鐘', desc: '確保資料是最新的',         href: '/dashboard/skills' },
    { id: 'ats',     label: '查看 ATS 報告',     time: '2 分鐘', desc: '了解履歷是否會被過濾',     href: '/resume-lab' },
  ],
  'active_search+jobs': [
    { id: 'add_job', label: '新增目標職缺',   time: '5 分鐘', desc: '追蹤求職進度',         href: '/jobs' },
    { id: 'gap',     label: '技能落差分析',   time: '5 分鐘', desc: '找出需要補強的技能',   href: '/skill-map' },
    { id: 'skills',  label: '更新技能庫',     time: '3 分鐘', desc: '確保資料是最新的',     href: '/dashboard/skills' },
  ],
  'active_search+interview': [
    { id: 'practice', label: '練習一道面試題',   time: '10 分鐘', desc: 'AI 即時回饋，提升表達力', href: '/interviews' },
    { id: 'gap',      label: '技能落差分析',     time: '5 分鐘',  desc: '找出需要補強的技能',     href: '/skill-map' },
    { id: 'add_job',  label: '新增目標職缺',     time: '3 分鐘',  desc: '追蹤求職進度',           href: '/jobs' },
  ],
  'active_search+skills': [
    { id: 'gap',      label: '技能落差分析', time: '5 分鐘', desc: '找出需要補強的技能', href: '/skill-map' },
    { id: 'skills',   label: '更新技能庫',   time: '3 分鐘', desc: '確保資料是最新的',   href: '/dashboard/skills' },
    { id: 'practice', label: '練習一道面試題', time: '10 分鐘', desc: 'AI 即時回饋', href: '/interviews' },
  ],
  'passive+resume': [
    { id: 'resume', label: '更新履歷',       time: '5 分鐘', desc: '保持履歷最新狀態',   href: '/resume-lab' },
    { id: 'gap',    label: '技能落差分析', time: '5 分鐘', desc: '找出市場需要什麼', href: '/skill-map' },
    { id: 'intel',  label: '查看產業趨勢', time: '3 分鐘', desc: '了解當前就業市場', href: '/analytics' },
  ],
  'passive+jobs': [
    { id: 'intel',   label: '查看產業趨勢', time: '3 分鐘', desc: '了解當前就業市場',   href: '/analytics' },
    { id: 'gap',     label: '技能落差分析', time: '5 分鐘', desc: '找出市場需要什麼',   href: '/skill-map' },
    { id: 'add_job', label: '新增目標職缺', time: '5 分鐘', desc: '看看有哪些機會',     href: '/jobs' },
  ],
  'passive+interview': [
    { id: 'practice', label: '練習一道面試題', time: '10 分鐘', desc: 'AI 即時回饋', href: '/interviews' },
    { id: 'gap',      label: '技能落差分析',   time: '5 分鐘',  desc: '找出需要補強的技能', href: '/skill-map' },
    { id: 'resume',   label: '更新履歷',       time: '5 分鐘',  desc: '保持履歷最新狀態', href: '/resume-lab' },
  ],
  'passive+skills': [
    { id: 'gap',    label: '技能落差分析', time: '5 分鐘', desc: '找出市場需要什麼',   href: '/skill-map' },
    { id: 'skills', label: '更新技能庫',   time: '3 分鐘', desc: '確保資料是最新的',   href: '/dashboard/skills' },
    { id: 'intel',  label: '查看產業趨勢', time: '3 分鐘', desc: '了解當前就業市場',   href: '/analytics' },
  ],
  'just_started': [
    { id: 'exp',    label: '更新工作經歷', time: '5 分鐘', desc: '記錄新工作的詳細資訊',    href: '/resume-lab' },
    { id: 'gap',    label: '技能落差分析', time: '5 分鐘', desc: '找出需要學習的技能',      href: '/skill-map' },
    { id: 'journal',label: '記錄工作成果', time: '3 分鐘', desc: '用 STAR 法則記錄亮點',    href: '/analytics' },
  ],
  'fresh_grad': [
    { id: 'build',    label: '建立新鮮人履歷', time: '10 分鐘', desc: '用範本快速建立第一份履歷', href: '/resume-lab' },
    { id: 'skills',   label: '新增技能',        time: '3 分鐘',  desc: '列出你的專業能力',        href: '/dashboard/skills' },
    { id: 'practice', label: '練習面試',         time: '10 分鐘', desc: 'AI 即時回饋',             href: '/interviews' },
  ],
}

// 承接 /onboarding（登入前）寫的舊格式，換算成這裡看得懂的 status/goal，
// 避免使用者在 /onboarding 填過一次之後，進 Dashboard 又被 WelcomeModal 重問一次。
const STAGE_TO_STATUS: Record<string, string> = {
  student: 'fresh_grad',
  fresh: 'fresh_grad',
  employed: 'passive',
  unemployed: 'active_search',
}
const GOAL_TO_MODAL_GOAL: Record<string, string> = {
  new_job: 'jobs',
  switch: 'skills',
  upskill: 'skills',
  interview: 'interview',
}

function readLegacyOnboarding(): { status: string; goal: string; targetRole?: string } | null {
  try {
    const raw = localStorage.getItem('onboarding')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { goal?: string; stage?: string; targetRole?: string }
    const status = STAGE_TO_STATUS[parsed.stage ?? '']
    const goal = GOAL_TO_MODAL_GOAL[parsed.goal ?? '']
    if (!status || !goal) return null
    // 在職 + 想找新工作/轉職 其實已經是在積極求職了，不是單純被動觀望
    const active = parsed.stage === 'employed' && (parsed.goal === 'new_job' || parsed.goal === 'switch')
    return { status: active ? 'active_search' : status, goal, targetRole: parsed.targetRole }
  } catch {
    return null
  }
}

function getPersonalizedTasks(status: string | null, goal: string | null): TaskDef[] {
  if (!status) return DEFAULT_TASKS
  if (status === 'just_started') return TASK_PRESETS['just_started']
  if (status === 'fresh_grad')   return TASK_PRESETS['fresh_grad']
  const key = `${status}+${goal}`
  return TASK_PRESETS[key] ?? DEFAULT_TASKS
}

// ── Card Wrapper ───────────────────────────────────────────────────────────────
function Pane({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${className}`}
      style={{ background: '#FFFDFC', border: '1px solid #E6DDD2', boxShadow: '0 1px 4px rgba(100,70,40,0.06)' }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest mb-4" style={{ color: '#C4B0A2' }}>
      {children}
    </p>
  )
}

// ── Score Ring ─────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r     = (size - 10) / 2
  const circ  = 2 * Math.PI * r
  const offset = circ * (1 - Math.min(score, 100) / 100)
  const clr   = score >= 70 ? '#7FA887' : score >= 40 ? '#C97941' : '#D4905A'
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#EDE5DB" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={clr} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.7s ease' }} />
    </svg>
  )
}

// ── Mood Sparkline ─────────────────────────────────────────────────────────────
function MoodSparkline({ days }: { days: DayPoint[] }) {
  const COL = 30
  const H   = 36
  const PAD = 5

  const pts = days.map((d, i) => {
    const score = d.mood ? (MOOD_SCORE[d.mood] ?? 3) : null
    return {
      x: i * COL + COL / 2,
      y: score !== null ? PAD + ((5 - score) / 4) * (H - PAD * 2) : null,
      mood: d.mood,
      label: d.dayLabel,
    }
  })

  const valid = pts.filter(p => p.y !== null)
  const line  = valid.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={days.length * COL} height={H + 16} style={{ overflow: 'visible' }}>
      {valid.length > 1 && (
        <polyline points={line} fill="none" stroke="#C97941" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
      )}
      {pts.map((p, i) => (
        <g key={i}>
          {p.y !== null ? (
            <circle cx={p.x} cy={p.y} r="3.5"
              fill={NEGATIVE_MOODS.has(p.mood!) ? '#D48070' : '#8FBA97'} />
          ) : (
            <circle cx={p.x} cy={H / 2} r="2" fill="#E6DDD2" />
          )}
          <text x={p.x} y={H + 13} textAnchor="middle" fontSize="8" fill="#C4B8B2">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Checkbox ───────────────────────────────────────────────────────────────────
function Checkbox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="h-4 w-4 shrink-0 rounded-full flex items-center justify-center transition-all mt-0.5"
      style={{
        border: `1.5px solid ${done ? '#C97941' : '#D4C4B8'}`,
        background: done ? '#C97941' : 'transparent',
      }}>
      {done && (
        <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24"
          stroke="white" strokeWidth={3}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DashboardClient({ name }: { name: string }) {
  const [moodLogs,     setMoodLogs]     = useState<MoodEntry[]>([])
  const [todayMood,    setTodayMood]    = useState<string | null>(null)
  const [doneTaskIds,  setDoneTaskIds]  = useState<Set<string>>(new Set())
  const [showModal,    setShowModal]    = useState(false)
  const [onbStatus,    setOnbStatus]    = useState<string | null>(null)
  const [onbGoal,      setOnbGoal]      = useState<string | null>(null)
  const [celebVisible, setCelebVisible] = useState(false)
  const [localName,    setLocalName]    = useState<string | null>(null)

  const todayKey = new Date().toISOString().split('T')[0]

  useEffect(() => {
    try {
      const profileRaw = localStorage.getItem('profile-basic')
      if (profileRaw) {
        const profile = JSON.parse(profileRaw)
        if (profile?.nameZh) setLocalName(profile.nameZh)
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem('career-mood-logs')
      if (raw) {
        const logs: MoodEntry[] = JSON.parse(raw)
        setMoodLogs(logs)
        const t = logs.find(l => l.date === todayKey)
        if (t) setTodayMood(t.mood)
      }
    } catch { /* ignore */ }
    try {
      const rawDone = localStorage.getItem(`dashboard-done-${todayKey}`)
      if (rawDone) setDoneTaskIds(new Set(JSON.parse(rawDone)))
    } catch { /* ignore */ }

    const completed = localStorage.getItem('onboarding_completed')
    if (!completed) {
      const legacy = readLegacyOnboarding()
      if (legacy) {
        localStorage.setItem('onboarding_completed', 'true')
        localStorage.setItem('onboarding_status', legacy.status)
        localStorage.setItem('onboarding_goal', legacy.goal)
        if (legacy.targetRole) localStorage.setItem('onboarding_target_role', legacy.targetRole)
        setOnbStatus(legacy.status)
        setOnbGoal(legacy.goal)
      } else {
        setShowModal(true)
      }
    } else {
      setOnbStatus(localStorage.getItem('onboarding_status'))
      setOnbGoal(localStorage.getItem('onboarding_goal'))
    }
  }, [todayKey])

  function handleOnboardingComplete(status: string, goal: string, nameZh?: string, targetRole?: string) {
    localStorage.setItem('onboarding_completed', 'true')
    localStorage.setItem('onboarding_status', status)
    localStorage.setItem('onboarding_goal', goal)
    if (targetRole) localStorage.setItem('onboarding_target_role', targetRole)
    if (nameZh) setLocalName(nameZh)
    setOnbStatus(status)
    setOnbGoal(goal)
    setShowModal(false)
  }

  function handleOnboardingSkip() {
    localStorage.setItem('onboarding_completed', 'true')
    setShowModal(false)
  }

  function openGuide() {
    localStorage.removeItem('onboarding_completed')
    localStorage.removeItem('onboarding_status')
    localStorage.removeItem('onboarding_goal')
    const keys = Object.keys(localStorage).filter(k => k.startsWith('tooltip_seen_'))
    keys.forEach(k => localStorage.removeItem(k))
    setOnbStatus(null)
    setOnbGoal(null)
    setShowModal(true)
  }

  function recordMood(mood: string) {
    const updated = [...moodLogs.filter(l => l.date !== todayKey), { date: todayKey, mood }]
      .sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
    setMoodLogs(updated); setTodayMood(mood)
    localStorage.setItem('career-mood-logs', JSON.stringify(updated))
  }

  const todayTasks = useMemo(
    () => getPersonalizedTasks(onbStatus, onbGoal),
    [onbStatus, onbGoal]
  )

  function toggleTask(id: string) {
    setDoneTaskIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      localStorage.setItem(`dashboard-done-${todayKey}`, JSON.stringify([...next]))
      const allDone = todayTasks.every(t => next.has(t.id))
      if (allDone && !prev.has(id)) {
        setCelebVisible(true)
        setTimeout(() => setCelebVisible(false), 6000)
      }
      return next
    })
  }

  const last7Days: DayPoint[] = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr  = d.toISOString().split('T')[0]
    const entry    = moodLogs.find(l => l.date === dateStr)
    const dayLabel = d.toLocaleDateString('zh-TW', { weekday: 'short' }).replace('週', '')
    return { mood: entry?.mood ?? null, dayLabel }
  }), [moodLogs])

  const showEncouragement = last7Days.slice(-3).map(d => d.mood)
    .every(m => m !== null && NEGATIVE_MOODS.has(m))

  const totalScore    = SCORE_BREAKDOWN.reduce((s, b) => s + b.value, 0)
  const completedCount = doneTaskIds.size
  const totalTasks    = todayTasks.length
  const allTasksDone  = completedCount >= totalTasks && totalTasks > 0

  const hour     = new Date().getHours()
  const greeting = hour < 5 ? '深夜好' : hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'
  const dateLabel = new Date().toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' })

  const nextStepText = totalScore < 10
    ? '先上傳一份履歷，AI 會給你具體的改善建議'
    : totalScore < 40 ? '完善技能庫，比對目標職缺的需求'
    : '練習面試題目，提升表達自信'
  const nextStepHref = totalScore < 10 ? '/resume-lab'
    : totalScore < 40 ? '/dashboard/skills' : '/interviews'

  return (
    <>
      {showModal && (
        <WelcomeModal
          userName={name}
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingSkip}
        />
      )}

      {/* Extra top padding on mobile for hamburger button */}
      <div className="min-h-screen space-y-5 p-4 pt-16 md:pt-5 lg:p-8" style={{ background: '#F7F3EE' }}>

        {/* ── CELEBRATION BANNER ─────────────────────────────────────────────── */}
        {celebVisible && (
          <div
            style={{
              background: 'linear-gradient(135deg, #FBF2EA 0%, #F5F8F0 100%)',
              border: '1px solid #D8C8B8',
              borderRadius: 16,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              animation: 'fadeIn 0.4s ease',
            }}
          >
            <span style={{ fontSize: 22 }}>🎉</span>
            <p style={{ fontSize: 13, color: '#4B4038', fontWeight: 500 }}>
              今日任務全部完成！Career Score 已更新，明天繼續加油！
            </p>
          </div>
        )}

        {/* ── HERO ───────────────────────────────────────────────────────────── */}
        <Pane className="!p-5 md:!p-6">
          {/* Greeting */}
          <p className="text-xs font-medium" style={{ color: '#C4B0A2' }}>{dateLabel}</p>
          <h1 className="mt-1 text-2xl md:text-[1.6rem] font-bold leading-tight tracking-tight" style={{ color: '#4B4038' }}>
            {greeting}，{localName ?? name}
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#9E8E84' }}>
            {todayMood
              ? `今天心情：${MOODS.find(m => m.key === todayMood)?.emoji}  ${MOODS.find(m => m.key === todayMood)?.label}`
              : '今天求職準備進行得怎麼樣？'}
          </p>

          {/* Quick actions — 2×2 on mobile, row on desktop */}
          <div className="mt-4 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-2">
            {QUICK_LINKS.map((q) => (
              <Link key={q.href} href={q.href}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition-opacity hover:opacity-75 md:justify-start"
                style={{ background: q.bg, border: `1px solid ${q.border}`, color: q.color }}>
                <span>{q.symbol}</span>
                <span className="md:inline">{q.label === '技能落差' ? <><span className="md:hidden">技能分析</span><span className="hidden md:inline">技能落差</span></> : q.label}</span>
              </Link>
            ))}
          </div>

          {/* Guide button — below on mobile */}
          <button
            onClick={openGuide}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-75 md:hidden"
            style={{ background: '#F3ECE4', border: '1px solid #E6DDD2', color: '#9E8E84' }}
          >
            📖 查看使用指引
          </button>
          {/* Guide button — inline on desktop */}
          <div className="hidden md:flex justify-end mt-2">
            <button
              onClick={openGuide}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-opacity hover:opacity-75"
              style={{ background: '#F3ECE4', border: '1px solid #E6DDD2', color: '#9E8E84' }}
            >
              📖 查看使用指引
            </button>
          </div>

          {/* Progress hint */}
          {completedCount > 0 && (
            <div className="mt-5 flex items-center gap-3">
              <div className="flex-1 h-[3px] rounded-full" style={{ background: '#EDE5DB' }}>
                <div className="h-[3px] rounded-full" style={{
                  background: allTasksDone ? '#7FA887' : '#C97941',
                  width: `${(completedCount / totalTasks) * 100}%`,
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span className="text-[11px] shrink-0" style={{ color: allTasksDone ? '#7FA887' : '#C4B0A2' }}>
                {allTasksDone ? '✓ 今日全部完成' : `今日 ${completedCount}/${totalTasks} 完成`}
              </span>
            </div>
          )}
        </Pane>

        {/* ── CAREER SNAPSHOT  +  TODAY PROGRESS ────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 xl:grid-cols-5">

          {/* Career Snapshot — 3/5 */}
          <Pane className="lg:col-span-3">
            <SectionLabel>Career Score</SectionLabel>

            {/* Score header */}
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-end gap-2">
                  <span className="text-5xl font-bold leading-none" style={{ color: '#4B4038' }}>{totalScore}</span>
                  <span className="text-lg mb-1 font-light" style={{ color: '#C4B8B2' }}>/100</span>
                </div>
                <p className="text-xs mt-2" style={{ color: '#9E8E84' }}>
                  {totalScore < 20 ? '剛起步，每一步都算數'
                    : totalScore < 50 ? '穩定進行中，繼續保持'
                    : totalScore < 75 ? '表現不錯，快衝刺了！'
                    : '非常棒，接近完整狀態'}
                </p>
              </div>
              <ScoreRing score={totalScore} size={76} />
            </div>

            {/* Breakdown */}
            <div className="space-y-3.5">
              {SCORE_BREAKDOWN.map((b) => {
                const pct = Math.round((b.value / b.max) * 100)
                return (
                  <Link key={b.label} href={b.href} className="block group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium" style={{ color: '#6B5E56' }}>{b.label}</span>
                      <span className="text-[11px]" style={{ color: '#C4B8B2' }}>{b.note}</span>
                    </div>
                    <div className="h-[5px] rounded-full" style={{ background: '#EDE5DB' }}>
                      <div className="h-[5px] rounded-full transition-all duration-500 group-hover:opacity-70"
                        style={{ width: `${pct || 2}%`, background: b.color }} />
                    </div>
                  </Link>
                )
              })}
            </div>

            {/* Next step */}
            <div className="mt-5 pt-4" style={{ borderTop: '1px solid #EDE5DB' }}>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#C4B0A2' }}>本週建議</p>
              <p className="text-sm leading-relaxed" style={{ color: '#4B4038' }}>{nextStepText}</p>
              <Link href={nextStepHref}
                className="inline-flex items-center gap-1 text-xs font-medium mt-2 transition-opacity hover:opacity-70"
                style={{ color: '#C97941' }}>
                開始 →
              </Link>
            </div>
          </Pane>

          {/* Today Progress — 2/5 */}
          <Pane className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>今日進度</SectionLabel>
              <span className="text-[11px] px-2 py-0.5 rounded-full -mt-4"
                style={{ background: allTasksDone ? '#EBF4ED' : '#F3ECE4', color: allTasksDone ? '#5E8F68' : '#9E8E84' }}>
                {completedCount}/{totalTasks}
              </span>
            </div>

            <div className="space-y-2">
              {todayTasks.map((task) => {
                const done = doneTaskIds.has(task.id)
                return (
                  <div key={task.id} className="flex items-start gap-3 rounded-xl p-3 transition-colors"
                    style={{ background: done ? '#F5F0EB' : '#FAF7F4' }}>
                    <Checkbox done={done} onToggle={() => toggleTask(task.id)} />
                    <div className="flex-1 min-w-0">
                      <Link href={task.href} className="block transition-opacity hover:opacity-70">
                        <p className="text-sm font-medium"
                          style={{ color: done ? '#B8A890' : '#4B4038', textDecoration: done ? 'line-through' : 'none' }}>
                          {task.label}
                        </p>
                      </Link>
                      {!done && <p className="text-xs mt-0.5" style={{ color: '#B8A890' }}>{task.desc}</p>}
                    </div>
                    <span className="text-[10px] shrink-0 pt-0.5" style={{ color: '#D4C4B8' }}>{task.time}</span>
                  </div>
                )
              })}
            </div>

            {/* Gentle note */}
            <div className="mt-4 rounded-xl px-3 py-3"
              style={{ background: showEncouragement ? '#FBF5F0' : '#F5F8F5', border: `1px solid ${showEncouragement ? '#EDD8CC' : '#D8EAD8'}` }}>
              <p className="text-xs leading-relaxed" style={{ color: showEncouragement ? '#A07060' : '#6A9470' }}>
                {showEncouragement
                  ? '求職是需要時間的旅程，放慢腳步也沒關係。你已經很努力了 🤗'
                  : '完成今日任務，Career Score 會自動更新，AI 建議也會更精準。'}
              </p>
            </div>
          </Pane>
        </div>

        {/* ── STATS ROW ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: '本週投遞', value: '2',  sub: '較上週 +1',  color: '#C97941' },
            { label: 'ATS 平均', value: '—',  sub: '上傳後顯示', color: '#B8A090' },
            { label: '面試邀請', value: '1',  sub: '進行中',     color: '#7FA887' },
            { label: '今日完成', value: `${completedCount}`, sub: `共 ${totalTasks} 項`, color: '#D4A25A' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl px-4 py-3.5"
              style={{ background: '#FFFDFC', border: '1px solid #E6DDD2', boxShadow: '0 1px 3px rgba(100,70,40,0.05)' }}>
              <p className="text-2xl md:text-[1.6rem] font-bold leading-none" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium mt-1.5" style={{ color: '#6B5E56' }}>{s.label}</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#C4B8B2' }}>{s.sub}</p>
            </div>
          ))}
        </div>

        {/* ── PIPELINE  +  MOOD ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-1 lg:grid-cols-3">

          {/* Job Pipeline — 2/3 */}
          <Pane className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>求職追蹤</SectionLabel>
              <Link href="/jobs" className="text-[11px] font-medium -mt-4 transition-opacity hover:opacity-70"
                style={{ color: '#C97941' }}>
                全部 →
              </Link>
            </div>
            <div className="space-y-1.5">
              {PIPELINE_ITEMS.map((item, i) => {
                const cfg = STATUS_CFG[item.status] ?? STATUS_CFG.saved
                return (
                  <Link key={i} href="/jobs"
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
                    style={{ background: '#FAF7F4' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#F3ECE4')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#FAF7F4')}>
                    <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#4B4038' }}>{item.company}</p>
                      <p className="text-xs truncate" style={{ color: '#9E8E84' }}>{item.role}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-xs font-medium ${cfg.textColor}`}>{cfg.label}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#C4B8B2' }}>
                        {item.daysAgo === 0 ? '今天' : `${item.daysAgo} 天前`}
                      </p>
                    </div>
                  </Link>
                )
              })}
              <Link href="/jobs"
                className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-medium transition-colors mt-1"
                style={{ background: '#F3ECE4', color: '#9E8E84' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EAE0D4')}
                onMouseLeave={e => (e.currentTarget.style.background = '#F3ECE4')}>
                ＋ 新增職缺
              </Link>
            </div>
          </Pane>

          {/* Mood — 1/3 */}
          <Pane>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel>今日心情</SectionLabel>
              {todayMood && (
                <span className="text-[11px] -mt-4" style={{ color: '#C4B8B2' }}>
                  {MOODS.find(m => m.key === todayMood)?.emoji} 已記錄
                </span>
              )}
            </div>
            {/* Mood options — horizontal scroll on mobile */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 -mx-1 px-1 md:flex-wrap">
              {MOODS.map((m) => {
                const active = todayMood === m.key
                return (
                  <button key={m.key} type="button" onClick={() => recordMood(m.key)}
                    className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-all"
                    style={{
                      border: `1px solid ${active ? '#C97941' : '#E6DDD2'}`,
                      background: active ? '#FBF2EA' : '#FAF7F4',
                      color: active ? '#C97941' : '#9E8E84',
                      fontWeight: active ? 500 : 400,
                    }}>
                    <span>{m.emoji}</span>
                    <span className="hidden sm:inline lg:hidden xl:inline">{m.label}</span>
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] mb-2" style={{ color: '#C4B8B2' }}>7 天情緒趨勢</p>
            <div className="overflow-x-auto">
              <MoodSparkline days={last7Days} />
            </div>
          </Pane>
        </div>
      </div>
    </>
  )
}
