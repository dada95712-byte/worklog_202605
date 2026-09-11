'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export type PageKey =
  | 'profile_library' | 'resume_lab' | 'work_journal' | 'skills'
  | 'application_tracker' | 'skill_map' | 'interviews' | 'analytics' | 'career_coach'

// 各模組「有沒有資料」的快照，由 /api/progress 提供
interface Progress {
  hasProfile: boolean
  journals: number
  skills: number
  confirmedSkills: number
  resumes: number
  scoredResumes: number
  jobs: number
  analyzedJobs: number
  interviews: number
}

interface Tip {
  title: string
  body: string
  cta?: { label: string; href: string }
}

// 提示內容依實際資料狀態決定：還沒有資料就講「從哪裡開始」，
// 已經有資料就講「下一步可以做什麼」——不要對用了一個月的人講新手導覽。
// p 為 null 代表進度還沒讀到（或讀取失敗），一律走 empty 版本的通用說明。
const TIPS: Record<PageKey, (p: Progress | null) => Tip> = {
  profile_library: (p) => (!p?.hasProfile
    ? {
        title: '👤 從這裡開始：個人檔案庫',
        body: '這裡存放你的個人背景資料。先把基本資訊、學歷與工作經歷填進來，之後建立履歷會直接取用，不用重複輸入。',
      }
    : {
        title: '👤 個人檔案庫',
        body: '你的個人背景資料——基本資訊、學歷、經歷、證照、語言。資料愈完整，AI 生成的履歷就愈精準；右上角的完整度低於 60% 時，履歷頁會提醒你回來補齊。',
        cta: { label: '用這份資料建立履歷 →', href: '/resume-lab' },
      }),

  resume_lab: (p) => (p && p.resumes === 0
    ? {
        title: '📄 履歷',
        body: '履歷是從個人檔案庫「生成」的，不是在這裡重新打字。可以產通用履歷，也可以貼上 JD 產出針對該職缺的客製化版本。',
        cta: p.hasProfile
          ? { label: '開始建立履歷 →', href: '/resume-lab' }
          : { label: '先去填個人檔案庫 →', href: '/profile-library' },
      }
    : {
        title: '📄 履歷',
        body: `你已經有 ${p?.resumes ?? 0} 份履歷。${(p?.scoredResumes ?? 0) > 0 ? 'AI 評分會常駐在編輯器右側，改完即時看到分數變化。' : '還沒跑過 AI 評分——評分會指出 ATS 關鍵字與內容上的具體問題。'}`,
      }),

  work_journal: (p) => (!p || p.journals === 0
    ? {
        title: '✍ 工作日誌',
        body: '記錄每天做了什麼。AI 會從日誌自動萃取你的技能與成就，累積成職涯資料庫——求職時履歷和面試故事直接從這裡取用，不用臨時回想。',
      }
    : {
        title: '✍ 工作日誌',
        body: `已累積 ${p.journals} 篇日誌。到「待確認」分頁審核 AI 從日誌萃取出的成就與技能，確認過的才會進入職涯成就與技能庫。`,
      }),

  skills: (p) => {
    if (p && p.skills === 0 && p.journals > 0) {
      // 有日誌卻還沒有技能 —— 缺的是「跑一次分析」，不是叫他去寫日誌
      return {
        title: '⚡ 你的技能庫',
        body: `你已經有 ${p.journals} 篇工作日誌，但還沒萃取過技能。按下「分析日誌」，AI 會從日誌內容找出你展現過的技能，並附上逐字佐證。`,
      }
    }
    if (!p || p.skills === 0) {
      return {
        title: '⚡ 你的技能庫',
        body: '技能有兩個來源：你手動新增的，以及 AI 從工作日誌萃取並附上逐字佐證的。技能庫會用於職缺匹配與履歷生成。',
        cta: { label: '先寫幾篇工作日誌 →', href: '/work-journal' },
      }
    }
    return {
      title: '⚡ 你的技能庫',
      body: `目前有 ${p.skills} 項技能${p.confirmedSkills < p.skills ? `，其中 ${p.skills - p.confirmedSkills} 項是 AI 推論、還沒確認` : ''}。AI 推論的技能要你確認過，才會被履歷生成採用。`,
    }
  },

  application_tracker: (p) => (!p || p.jobs === 0
    ? {
        title: '◎ 求職追蹤',
        body: '把有興趣的職缺存進來。貼上職缺連結或 JD，AI 會自動擷取公司、職位與要求技能，之後用看板追蹤每一家的進度。',
      }
    : {
        title: '◎ 求職追蹤',
        body: `追蹤中 ${p.jobs} 個職缺。${p.analyzedJobs > 0 ? '職缺詳細頁的「JD 分析」會比對你的技能庫，列出已具備與待補強的項目。' : '貼上 JD 之後，AI 就能比對你的技能庫算出匹配度。'}`,
      }),

  // 技能落差分析已於 v1.7 移到求職追蹤的 JD 分析，這頁的主角是日誌技能頻率
  skill_map: (p) => {
    if (!p || p.journals === 0) {
      return {
        title: '◈ 技能地圖',
        body: '這裡呈現你的技能全貌：分類全覽、每項技能在工作日誌中出現的頻率，以及跨職缺累積的待補強技能。先累積幾篇日誌，頻率區塊才會有東西。',
        cta: { label: '前往工作日誌 →', href: '/work-journal' },
      }
    }
    if (p.skills === 0) {
      // 有日誌但還沒萃取過技能，頻率區塊會是空的
      return {
        title: '◈ 技能地圖',
        body: `你有 ${p.journals} 篇日誌但還沒萃取過技能，所以「來自工作日誌的技能頻率」目前是空的。到技能庫跑一次「分析日誌」就會出現。`,
        cta: { label: '前往技能庫分析 →', href: '/dashboard/skills' },
      }
    }
    return {
      title: '◈ 技能地圖',
      body: '展開任一項技能可以看到它的來源日誌與逐字引用，點擊就能跳回原始日誌確認——AI 推論的每一項都能追溯回你自己寫的內容。',
    }
  },

  interviews: (p) => (!p || p.interviews === 0
    ? {
        title: '⬟ 面試練習',
        body: '模擬面試會依你的求職情境出題，支援語音作答，答完 AI 會逐題評分並給改善建議。也可以把真實面試遇到的題目記錄下來。',
      }
    : {
        title: '⬟ 面試練習',
        body: `已完成 ${p.interviews} 次練習/記錄。覺得答得好的題目可以收藏進「個人題庫」，面試前快速複習自己的最佳版本。`,
      }),

  // 這頁是薪資／產業／公司三種查詢，不是求職統計儀表板
  analytics: () => ({
    title: '◉ 職缺分析',
    body: '查薪資行情、產業趨勢與公司深度分析。數字類資料一律附上來源網址，AI 推測的部分會標示「根據 JD 推測」，讓你自己判斷可信度。',
  }),

  career_coach: () => ({
    title: '🤖 AI 職涯教練',
    body: '可以直接聊轉職、升遷、被裁員怎麼辦這類問題。對話會保留，適合把一個問題慢慢談深，而不是問一次就結束。',
  }),
}

export function PageTooltip({ pageKey }: { pageKey: PageKey }) {
  const [show, setShow] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)

  useEffect(() => {
    const key = `tooltip_seen_${pageKey}`
    if (localStorage.getItem(key)) return

    // 先讀進度再顯示，避免先閃一版通用文案又換成另一版
    let alive = true
    fetch('/api/progress')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (alive) setProgress(data) })
      .catch(() => { /* 讀不到就用通用文案 */ })
      .finally(() => {
        if (!alive) return
        setShow(true)
        setTimeout(() => setMounted(true), 10)
      })
    return () => { alive = false }
  }, [pageKey])

  function dismiss() {
    setMounted(false)
    setTimeout(() => {
      setShow(false)
      localStorage.setItem(`tooltip_seen_${pageKey}`, 'true')
    }, 300)
  }

  if (!show) return null

  const content = TIPS[pageKey](progress)

  return (
    <div
      style={{
        background: '#F0F5F1',
        border: '1px solid #C8DDD0',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}
    >
      <span style={{ fontSize: 20, lineHeight: 1.4, flexShrink: 0 }}>🌿</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#3A5444', margin: 0 }}>{content.title}</p>
        <p style={{ fontSize: 12, color: '#5C7A68', margin: '4px 0 0', lineHeight: 1.6 }}>{content.body}</p>
        {content.cta && (
          <Link
            href={content.cta.href}
            style={{ display: 'inline-block', fontSize: 12, fontWeight: 500, color: '#3A5444', marginTop: 8, textDecoration: 'underline' }}
          >
            {content.cta.label}
          </Link>
        )}
      </div>
      <button
        onClick={dismiss}
        style={{
          flexShrink: 0,
          fontSize: 12,
          color: '#5C7A68',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px 0',
          whiteSpace: 'nowrap',
        }}
      >
        ✕ 了解了
      </button>
    </div>
  )
}
