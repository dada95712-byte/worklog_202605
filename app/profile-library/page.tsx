'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  DndContext, closestCenter, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// ── Types ──────────────────────────────────────────────────────────────────────

interface BasicInfo {
  nameZh: string; nameEn: string
  email: string; phone: string; address: string
  linkedinUrl: string; portfolioUrl: string; websiteUrl: string
}
interface EduEntry  { id: string; schoolName: string; schoolNameEn: string; degree: string; major: string; gpa: string; startDate: string; endDate: string; isCurrent: boolean; description: string }
interface ExpEntry  { id: string; company: string; companyEn: string; title: string; titleEn: string; location: string; startDate: string; endDate: string; isCurrent: boolean; description: string }
interface ProjEntry { id: string; projectName: string; projectNameEn: string; role: string; roleEn: string; url: string; startDate: string; endDate: string; description: string }
interface LangEntry { id: string; language: string; proficiency: string }
interface CertEntry { id: string; name: string; issuer: string; issueDate: string; expiryDate: string; credentialUrl: string }
interface ActvEntry { id: string; organization: string; role: string; startDate: string; endDate: string; description: string }
interface ConfEntry { id: string; name: string; role: string; date: string; description: string }
interface CustomBlock { id: string; sectionTitle: string; content: string }
interface AttachEntry { id: string; fileName: string; fileUrl: string; fileType: string; description: string }

type ModalSection = 'education' | 'experience' | 'internship' | 'project' | 'certificate' | 'activity' | 'conference'
type ModalData = Record<string, string | boolean>

interface ParsedResume {
  basic?: Record<string, string | null>
  education?: Record<string, string | boolean | null>[]
  experience?: Record<string, string | boolean | null>[]
  internship?: Record<string, string | boolean | null>[]
  project?: Record<string, string | null>[]
  skills?: { skill_name: string | null; category: string | null }[]
  languages?: { language: string | null; proficiency: string | null }[]
  certificates?: Record<string, string | null>[]
  activities?: Record<string, string | null>[]
  summary_zh?: string | null
  summary_en?: string | null
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SKILL_CATS = ['專業技能', '工具與軟體', '核心職能', '軟實力', '證照與認證', '學習中'] as const

const TOOLS_LIST = ['Microsoft Office', 'Google Workspace', 'Slack', 'Notion', 'Jira', 'Trello', 'Python', 'R', 'SQL', 'Tableau', 'Power BI', 'Salesforce', 'SAP', 'ERP系統', 'Photoshop', 'Illustrator', 'Figma', 'AutoCAD']

const SKILL_OPTIONS: Record<string, string[]> = {
  '專業技能': ['數據分析', '專案管理', '財務分析', '市場調查', '業務開發', '客戶服務', '供應鏈管理', '品質管理', '人力資源管理', '行銷策略', '產品管理', '營運管理'],
  '工具與軟體': TOOLS_LIST,
  '核心職能': ['溝通協調', '問題解決', '跨部門合作', '專案規劃', '數據驅動決策', '客戶關係管理', '流程優化', '團隊領導', '策略規劃'],
  '軟實力': ['領導力', '溝通能力', '團隊合作', '適應力', '創意思考', '時間管理', '抗壓性', '自我驅動', '細心謹慎', '邏輯思維'],
  '證照與認證': ['PMP（專案管理）', 'CPA（會計師）', '證券商業務員', '期貨商業務員', '人身保險業務員', 'TOEIC（多益）', 'TOEFL', 'IELTS', 'AWS認證', 'Google Analytics認證'],
  '學習中': TOOLS_LIST,
}

const LANGUAGE_OPTIONS = ['中文（普通話）', '英文', '日文', '韓文', '法文', '德文', '西班牙文', '粵語', '台語', '客語']

const PROFICIENCY = [
  { value: 'native', label: '母語' },
  { value: 'c2',     label: 'C2 精通' },
  { value: 'c1',     label: 'C1 高階' },
  { value: 'b2',     label: 'B2 中高階' },
  { value: 'b1',     label: 'B1 中階' },
  { value: 'a2',     label: 'A2 基礎' },
  { value: 'a1',     label: 'A1 入門' },
]

const SCHOOLS = [
  { zh: '國立台灣大學', en: 'National Taiwan University' },
  { zh: '國立清華大學', en: 'National Tsing Hua University' },
  { zh: '國立陽明交通大學', en: 'National Yang Ming Chiao Tung University' },
  { zh: '國立成功大學', en: 'National Cheng Kung University' },
  { zh: '國立政治大學', en: 'National Chengchi University' },
  { zh: '國立中央大學', en: 'National Central University' },
  { zh: '國立中興大學', en: 'National Chung Hsing University' },
  { zh: '國立中正大學', en: 'National Chung Cheng University' },
  { zh: '國立台灣師範大學', en: 'National Taiwan Normal University' },
  { zh: '國立台灣科技大學', en: 'National Taiwan University of Science and Technology' },
  { zh: '國立台北科技大學', en: 'National Taipei University of Technology' },
  { zh: '國立雲林科技大學', en: 'National Yunlin University of Science and Technology' },
  { zh: '國立中山大學', en: 'National Sun Yat-sen University' },
  { zh: '國立台灣海洋大學', en: 'National Taiwan Ocean University' },
  { zh: '國立台北大學', en: 'National Taipei University' },
  { zh: '國立嘉義大學', en: 'National Chiayi University' },
  { zh: '國立宜蘭大學', en: 'National Ilan University' },
  { zh: '國立東華大學', en: 'National Dong Hwa University' },
  { zh: '國立屏東大學', en: 'National Pingtung University' },
  { zh: '國立聯合大學', en: 'National United University' },
  { zh: '淡江大學', en: 'Tamkang University' },
  { zh: '輔仁大學', en: 'Fu Jen Catholic University' },
  { zh: '東吳大學', en: 'Soochow University' },
  { zh: '中原大學', en: 'Chung Yuan Christian University' },
  { zh: '逢甲大學', en: 'Feng Chia University' },
  { zh: '東海大學', en: 'Tunghai University' },
  { zh: '銘傳大學', en: 'Ming Chuan University' },
  { zh: '世新大學', en: 'Shih Hsin University' },
  { zh: '中國文化大學', en: 'Chinese Culture University' },
  { zh: '台北醫學大學', en: 'Taipei Medical University' },
  { zh: '長庚大學', en: 'Chang Gung University' },
  { zh: '元智大學', en: 'Yuan Ze University' },
  { zh: '靜宜大學', en: 'Providence University' },
  { zh: '朝陽科技大學', en: 'Chaoyang University of Technology' },
  { zh: '南台科技大學', en: 'Southern Taiwan University of Science and Technology' },
  { zh: '高雄科技大學', en: 'National Kaohsiung University of Science and Technology' },
  { zh: '義守大學', en: 'I-Shou University' },
  { zh: '大葉大學', en: 'Da-Yeh University' },
  { zh: '台灣首府大學', en: 'Taiwan Shoufu University' },
  { zh: '其他', en: '' },
]

const DEGREES = ['博士', '碩士', '學士', '副學士', '高中/高職', '國中', '其他']

const MAJORS = [
  '電機工程', '資訊工程', '資訊科學', '電子工程', '機械工程', '化學工程', '工業工程', '土木工程', '材料工程', '環境工程',
  '企業管理', '財務金融', '國際貿易', '會計', '行銷', '人力資源管理', '資訊管理', '供應鏈管理', '創業管理',
  '經濟學', '社會學', '心理學', '政治學', '法律', '歷史', '哲學', '中國文學', '外國語文', '英語',
  '新聞傳播', '廣告', '公共關係', '視覺傳達設計', '工業設計', '建築', '室內設計',
  '醫學', '護理', '公共衛生', '生物科技', '生命科學', '藥學', '物理治療',
  '教育', '幼兒教育', '特殊教育', '其他',
]

const CONF_ROLES = [
  { value: 'attendee', label: '聽眾' },
  { value: 'speaker',  label: '講者' },
  { value: 'organizer',label: '主辦' },
]

const NAV_SECTIONS = [
  { id: 'basic',       label: '基本資訊' },
  { id: 'education',   label: '學歷' },
  { id: 'experience',  label: '工作經歷' },
  { id: 'internship',  label: '實習經驗' },
  { id: 'project',     label: '專案經驗' },
  { id: 'skill',       label: '技能' },
  { id: 'language',    label: '語言能力' },
  { id: 'certificate', label: '證照' },
  { id: 'activity',    label: '社團活動' },
  { id: 'conference',  label: '會議' },
  { id: 'summary',     label: '自傳' },
  { id: 'attachment',  label: '作品附件' },
  { id: 'custom',      label: '自訂區塊' },
]

const MODAL_TITLES: Record<ModalSection, string> = {
  education: '學歷', experience: '工作經歷', internship: '實習經驗',
  project: '專案經驗', certificate: '證照', activity: '社團活動', conference: '會議',
}

const MODAL_DEFAULTS: Record<ModalSection, ModalData> = {
  education:   { schoolName: '', schoolNameEn: '', degree: '', major: '', gpa: '', startDate: '', endDate: '', isCurrent: false, description: '' },
  experience:  { company: '', companyEn: '', title: '', titleEn: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' },
  internship:  { company: '', companyEn: '', title: '', titleEn: '', location: '', startDate: '', endDate: '', isCurrent: false, description: '' },
  project:     { projectName: '', projectNameEn: '', role: '', roleEn: '', url: '', startDate: '', endDate: '', description: '' },
  certificate: { name: '', issuer: '', issueDate: '', expiryDate: '', credentialUrl: '' },
  activity:    { organization: '', role: '', startDate: '', endDate: '', description: '' },
  conference:  { name: '', role: 'attendee', date: '', description: '' },
}

const EMPTY_BASIC: BasicInfo = { nameZh: '', nameEn: '', email: '', phone: '', address: '', linkedinUrl: '', portfolioUrl: '', websiteUrl: '' }

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7) }

// ── Helper components ──────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
    </svg>
  )
}

function GripIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
      <circle cx="9" cy="5" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="9" cy="19" r="1.2"/>
      <circle cx="15" cy="5" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="15" cy="19" r="1.2"/>
    </svg>
  )
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.45 : 1 }}
      className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-3 py-2.5 group"
    >
      <button {...attributes} {...listeners} type="button"
        className="touch-none cursor-grab text-ink-200 hover:text-ink-400 shrink-0">
        <GripIcon />
      </button>
      {children}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-ink-300">{text}</p>
}

function SectionCard({ title, id, children, onAdd, addLabel = '＋ 新增' }: {
  title: string; id: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string
}) {
  return (
    <div id={id} className="rounded-2xl border border-warm-200 bg-white p-5 md:p-6 scroll-mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-ink-800">{title}</h2>
        {onAdd && (
          <button type="button" onClick={onAdd}
            className="rounded-lg border border-warm-200 bg-cream-50 px-3 py-1 text-xs font-medium text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all">
            {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function DateSelect({ value, onChange, label, disabled }: {
  value: string; onChange: (v: string) => void; label: string; disabled?: boolean
}) {
  const parts = (value ?? '').split('-')
  const year = parts[0] ?? ''
  const month = parts[1] ?? ''
  const years = Array.from({ length: 55 }, (_, i) => String(2030 - i))
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
  const cls = 'rounded-xl border border-warm-200 bg-white px-2 py-2 text-sm text-ink-800 focus:border-terra-400 focus:outline-none transition-colors disabled:opacity-40 disabled:bg-cream-50'

  function update(y: string, m: string) { onChange(y && m ? `${y}-${m}` : y || '') }

  return (
    <div>
      <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
      <div className="flex gap-1.5">
        <select disabled={disabled} value={year} onChange={e => update(e.target.value, month)} className={`flex-1 ${cls}`}>
          <option value="">年份</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select disabled={disabled} value={month} onChange={e => update(year, e.target.value)} className={`w-20 ${cls}`}>
          <option value="">月</option>
          {months.map(m => <option key={m} value={m}>{Number(m)}月</option>)}
        </select>
      </div>
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:border-terra-400 focus:outline-none transition-colors'
const labelCls = 'block text-xs font-medium text-ink-500 mb-1'

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProfileLibraryPage() {
  // ── Save status (1.5s debounce + failed state) ──
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const persistTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // ── State ──
  const [basic,        setBasic]        = useState<BasicInfo>(EMPTY_BASIC)
  const [educations,   setEducations]   = useState<EduEntry[]>([])
  const [experiences,  setExperiences]  = useState<ExpEntry[]>([])
  const [internships,  setInternships]  = useState<ExpEntry[]>([])
  const [projects,     setProjects]     = useState<ProjEntry[]>([])
  const [languages,    setLanguages]    = useState<LangEntry[]>([])
  const [skillMap,     setSkillMap]     = useState<Record<string, string[]>>(() =>
    Object.fromEntries(SKILL_CATS.map(c => [c, []]))
  )
  const [certificates, setCertificates] = useState<CertEntry[]>([])
  const [activities,   setActivities]   = useState<ActvEntry[]>([])
  const [conferences,  setConferences]  = useState<ConfEntry[]>([])
  const [summaryZh,    setSummaryZh]    = useState('')
  const [summaryEn,    setSummaryEn]    = useState('')
  const [attachments,  setAttachments]  = useState<AttachEntry[]>([])
  const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([])

  // Always-fresh snapshot of the full profile, read by the debounced persist call
  // so it never sends a stale closure over state.
  const latestProfile = useRef<Record<string, unknown>>({})
  useEffect(() => {
    latestProfile.current = {
      basic, summaryZh, summaryEn, educations, experiences, internships,
      projects, languages, skillMap, certificates, activities, conferences,
      attachments, customBlocks,
    }
  })

  const persistNow = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(latestProfile.current),
      })
      if (!res.ok) throw new Error('save failed')
      setSaveStatus('saved')
    } catch {
      setSaveStatus('failed')
    }
    setTimeout(() => setSaveStatus('idle'), saveStatus === 'failed' ? 3000 : 2000)
  }, [saveStatus])

  // `key` is kept for call-site compatibility but ignored — every save persists the whole profile.
  const save = useCallback((_key: string, _data?: unknown) => {
    setSaveStatus('saving')
    clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(persistNow, 1500)
  }, [persistNow])

  function saveAll() {
    clearTimeout(persistTimer.current)
    void persistNow()
  }

  // ── Modal state ──
  const [modalSection, setModalSection] = useState<ModalSection | null>(null)
  const [modalData,    setModalData]    = useState<ModalData>({})
  const [editingId,    setEditingId]    = useState<string | null>(null)

  // ── Skill state ──
  const [skillInputs,  setSkillInputs]  = useState<Record<string, string>>({})
  const [skillSelects, setSkillSelects] = useState<Record<string, string>>({})

  // ── Import state (Feature 1) ──
  const [importParsing,  setImportParsing]  = useState(false)
  const [importStep,     setImportStep]     = useState(0)
  const [importParsed,   setImportParsed]   = useState<ParsedResume | null>(null)
  const [importAccepted, setImportAccepted] = useState<Record<string, boolean[]>>({})
  const [importWarning,  setImportWarning]  = useState<string | null>(null)
  const [toast,          setToast]          = useState<string | null>(null)
  const importFileRef = useRef<HTMLInputElement>(null)

  // ── Attachment upload ──
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Section scroll refs ──
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})
  function scrollTo(id: string) { sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }

  // ── Load from the database ──
  const [loading, setLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // 個人檔案讀取失敗時獨立用 loadError 標示（不能借用 saveStatus）——
  // 這裡代表的是「資料還沒載入」，不是「儲存失敗」，兩者語意不同也不該共用同一個狀態：
  // 如果誤用 saveStatus，畫面會照樣渲染空白表單，使用者一旦按下「儲存所有變更」
  // 就會用空資料覆蓋、刪除他原本已存在資料庫裡的真實資料。
  async function loadProfile() {
    setLoading(true); setLoadError(false)
    try {
      const res = await fetch('/api/profile')
      if (res.status === 401) { setAuthRequired(true); return }
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setBasic({ ...EMPTY_BASIC, ...data.basic })
      setEducations(data.educations ?? [])
      setExperiences(data.experiences ?? [])
      setInternships(data.internships ?? [])
      setProjects(data.projects ?? [])
      setLanguages(data.languages ?? [])
      const loaded = (data.skillMap ?? {}) as Record<string, string[]>
      setSkillMap(Object.fromEntries(SKILL_CATS.map(c => [c, loaded[c] ?? []])))
      setCertificates(data.certificates ?? [])
      setActivities(data.activities ?? [])
      setConferences(data.conferences ?? [])
      setSummaryZh(data.summaryZh ?? '')
      setSummaryEn(data.summaryEn ?? '')
      setAttachments(data.attachments ?? [])
      setCustomBlocks(data.customBlocks ?? [])
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  // ── Completeness ──
  const completeness = useMemo(() => {
    let f = 0, t = 0
    ;(['nameZh','nameEn','email','phone','address','linkedinUrl','portfolioUrl','websiteUrl'] as (keyof BasicInfo)[]).forEach(k => { t++; if (basic[k]) f++ })
    ;[educations, experiences, internships, projects, certificates, activities, conferences].forEach(l => { t++; if (l.length > 0) f++ })
    t++; if (Object.values(skillMap).some(a => a.length > 0)) f++
    t++; if (languages.length > 0) f++
    t++; if (summaryZh) f++
    t++; if (summaryEn) f++
    t++; if (attachments.length > 0) f++
    return Math.round((f / t) * 100)
  }, [basic, educations, experiences, internships, projects, certificates, activities, conferences, skillMap, languages, summaryZh, summaryEn, attachments])

  // ── DnD ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function makeDragEnd<T extends { id: string }>(items: T[], setter: (v: T[]) => void, key: string) {
    return (e: DragEndEvent) => {
      const { active, over } = e
      if (!over || active.id === over.id) return
      const next = arrayMove(items, items.findIndex(i => i.id === active.id), items.findIndex(i => i.id === over.id))
      setter(next); save(key, next)
    }
  }

  // ── Modal handlers ──
  function openAdd(section: ModalSection) {
    setModalSection(section); setEditingId(null); setModalData({ ...MODAL_DEFAULTS[section] })
  }
  function openEdit(section: ModalSection, item: Record<string, unknown>) {
    setModalSection(section); setEditingId(item.id as string); setModalData(item as ModalData)
  }

  function saveModal() {
    if (!modalSection) return
    const id = editingId ?? genId()
    const item = { ...modalData, id }
    function upsert<T extends { id: string }>(list: T[], setter: (v: T[]) => void, key: string) {
      const next = editingId ? list.map(e => e.id === editingId ? item as T : e) : [...list, item as T]
      setter(next); save(key, next)
    }
    switch (modalSection) {
      case 'education':   upsert(educations,  setEducations,  'profile-education');  break
      case 'experience':  upsert(experiences, setExperiences, 'profile-experience'); break
      case 'internship':  upsert(internships, setInternships, 'profile-internship'); break
      case 'project':     upsert(projects,    setProjects,    'profile-project');    break
      case 'certificate': upsert(certificates,setCertificates,'profile-certificate');break
      case 'activity':    upsert(activities,  setActivities,  'profile-activity');   break
      case 'conference':  upsert(conferences, setConferences, 'profile-conference'); break
    }
    setModalSection(null)
  }

  function deleteItem<T extends { id: string }>(id: string, list: T[], setter: (v: T[]) => void, key: string) {
    const next = list.filter(e => e.id !== id); setter(next); save(key, next)
  }

  // ── Basic field ──
  function setBasicField(field: keyof BasicInfo, value: string) {
    const next = { ...basic, [field]: value }; setBasic(next); save('profile-basic', next)
  }

  // ── Skills ──
  function addSkill(cat: string) {
    const val = (skillInputs[cat] ?? '').trim()
    if (!val || (skillMap[cat] ?? []).includes(val)) return
    const next = { ...skillMap, [cat]: [...(skillMap[cat] ?? []), val] }
    setSkillMap(next); save('profile-skillmap', next)
    setSkillInputs(p => ({ ...p, [cat]: '' }))
  }
  function addSkillFromSelect(cat: string, val: string) {
    if (!val || (skillMap[cat] ?? []).includes(val)) { setSkillSelects(p => ({ ...p, [cat]: '' })); return }
    const next = { ...skillMap, [cat]: [...(skillMap[cat] ?? []), val] }
    setSkillMap(next); save('profile-skillmap', next)
    setSkillSelects(p => ({ ...p, [cat]: '' }))
  }
  function removeSkill(cat: string, idx: number) {
    const next = { ...skillMap, [cat]: (skillMap[cat] ?? []).filter((_, i) => i !== idx) }
    setSkillMap(next); save('profile-skillmap', next)
  }

  // ── Language ──
  function addLanguage() {
    const next: LangEntry = { id: genId(), language: '', proficiency: 'b1' }
    const list = [...languages, next]; setLanguages(list); save('profile-language', list)
  }
  function setLangField(id: string, field: keyof LangEntry, value: string) {
    const next = languages.map(l => l.id === id ? { ...l, [field]: value } : l)
    setLanguages(next); save('profile-language', next)
  }

  // ── Custom blocks ──
  function addCustomBlock() {
    const next: CustomBlock = { id: genId(), sectionTitle: '', content: '' }
    const list = [...customBlocks, next]; setCustomBlocks(list); save('profile-custom', list)
  }
  function setCustomField(id: string, field: keyof CustomBlock, value: string) {
    const next = customBlocks.map(b => b.id === id ? { ...b, [field]: value } : b)
    setCustomBlocks(next); save('profile-custom', next)
  }

  // ── Attachment upload ──
  async function handleAttachmentUpload(file: File) {
    setUploading(true)
    const form = new FormData(); form.append('file', file)
    try {
      const res = await fetch('/api/profile/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) { alert(data.error ?? '上傳失敗'); return }
      const entry: AttachEntry = { id: genId(), fileName: data.fileName ?? file.name, fileUrl: data.url, fileType: data.fileType ?? file.type, description: '' }
      const next = [...attachments, entry]; setAttachments(next); save('profile-attachment', next)
    } catch { alert('上傳失敗') }
    finally { setUploading(false) }
  }

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000) }

  // ── Resume import (Feature 1) ──
  async function handleImportFile(file: File) {
    setImportParsing(true); setImportStep(0)
    const steps = [1, 2, 3]
    const timers = steps.map((s, i) => setTimeout(() => setImportStep(s), (i + 1) * 1200))
    const form = new FormData(); form.append('file', file)
    try {
      const res = await fetch('/api/profile/import-from-resume', { method: 'POST', body: form })
      const data = await res.json()
      timers.forEach(t => clearTimeout(t))
      if (!res.ok || !data.parsed) { alert(data.error ?? '解析失敗，請再試一次'); return }
      const p = data.parsed as ParsedResume
      setImportParsed(p)
      setImportWarning(data.warning ?? null)
      // build per-item accepted map (all true by default)
      const acc: Record<string, boolean[]> = {}
      if (p.basic && Object.values(p.basic).some(v => v)) acc['basic'] = [true]
      if (p.education?.length)    acc['education']    = p.education.map(() => true)
      if (p.experience?.length)   acc['experience']   = p.experience.map(() => true)
      if (p.internship?.length)   acc['internship']   = p.internship.map(() => true)
      if (p.project?.length)      acc['project']      = p.project.map(() => true)
      if (p.skills?.length)       acc['skills']       = p.skills.map(() => true)
      if (p.languages?.length)    acc['languages']    = p.languages.map(() => true)
      if (p.certificates?.length) acc['certificates'] = p.certificates.map(() => true)
      if (p.activities?.length)   acc['activities']   = p.activities.map(() => true)
      if (p.summary_zh)           acc['summary_zh']   = [true]
      if (p.summary_en)           acc['summary_en']   = [true]
      setImportAccepted(acc)
    } catch { timers.forEach(t => clearTimeout(t)); alert('上傳失敗，請再試一次') }
    finally { setImportParsing(false); setImportStep(0) }
  }

  function applyImport() {
    if (!importParsed) return
    const p = importParsed
    let count = 0

    if (importAccepted['basic']?.[0] && p.basic) {
      const b = p.basic
      const next = { ...basic }
      if (b.name_zh)       next.nameZh      = b.name_zh
      if (b.name_en)       next.nameEn      = b.name_en
      if (b.email)         next.email       = b.email
      if (b.phone)         next.phone       = b.phone
      if (b.address)       next.address     = b.address
      if (b.linkedin_url)  next.linkedinUrl = b.linkedin_url
      if (b.portfolio_url) next.portfolioUrl= b.portfolio_url
      if (b.website_url)   next.websiteUrl  = b.website_url
      setBasic(next); save('profile-basic', next)
    }

    if (p.education?.length) {
      const accepted = (importAccepted['education'] ?? [])
      const newEdu: EduEntry[] = p.education.filter((_, i) => accepted[i]).map(e => ({
        id: genId(), schoolName: String(e.school_name_zh ?? e.school_name_en ?? ''), schoolNameEn: String(e.school_name_en ?? ''),
        degree: String(e.degree ?? ''), major: String(e.major_zh ?? ''), gpa: String(e.gpa ?? ''),
        startDate: String(e.start_date ?? ''), endDate: String(e.end_date ?? ''), isCurrent: !e.end_date, description: String(e.description ?? ''),
      }))
      if (newEdu.length) { count += newEdu.length; const next = [...educations, ...newEdu]; setEducations(next); save('profile-education', next) }
    }

    if (p.experience?.length) {
      const accepted = (importAccepted['experience'] ?? [])
      const newExp: ExpEntry[] = p.experience.filter((_, i) => accepted[i]).map(e => ({
        id: genId(), company: String(e.company_zh ?? e.company_en ?? ''), companyEn: String(e.company_en ?? ''),
        title: String(e.title_zh ?? e.title_en ?? ''), titleEn: String(e.title_en ?? ''), location: String(e.location ?? ''),
        startDate: String(e.start_date ?? ''), endDate: String(e.end_date ?? ''), isCurrent: !!(e.is_current), description: String(e.description ?? ''),
      }))
      if (newExp.length) { count += newExp.length; const next = [...experiences, ...newExp]; setExperiences(next); save('profile-experience', next) }
    }

    if (p.internship?.length) {
      const accepted = (importAccepted['internship'] ?? [])
      const newInt: ExpEntry[] = p.internship.filter((_, i) => accepted[i]).map(e => ({
        id: genId(), company: String(e.company_zh ?? e.company_en ?? ''), companyEn: String(e.company_en ?? ''),
        title: String(e.title_zh ?? e.title_en ?? ''), titleEn: String(e.title_en ?? ''), location: String(e.location ?? ''),
        startDate: String(e.start_date ?? ''), endDate: String(e.end_date ?? ''), isCurrent: false, description: String(e.description ?? ''),
      }))
      if (newInt.length) { count += newInt.length; const next = [...internships, ...newInt]; setInternships(next); save('profile-internship', next) }
    }

    if (p.project?.length) {
      const accepted = (importAccepted['project'] ?? [])
      const newProj: ProjEntry[] = p.project.filter((_, i) => accepted[i]).map(e => ({
        id: genId(), projectName: String(e.project_name_zh ?? e.project_name_en ?? ''), projectNameEn: String(e.project_name_en ?? ''),
        role: String(e.role_zh ?? e.role_en ?? ''), roleEn: String(e.role_en ?? ''), url: String(e.url ?? ''),
        startDate: String(e.start_date ?? ''), endDate: String(e.end_date ?? ''), description: String(e.description ?? ''),
      }))
      if (newProj.length) { count += newProj.length; const next = [...projects, ...newProj]; setProjects(next); save('profile-project', next) }
    }

    if (p.skills?.length) {
      const accepted = (importAccepted['skills'] ?? [])
      const newMap = { ...skillMap }
      p.skills.filter((_, i) => accepted[i]).forEach(s => {
        if (!s.skill_name) return
        const cat = SKILL_CATS.includes(s.category as typeof SKILL_CATS[number]) ? s.category! : '專業技能'
        if (!newMap[cat]) newMap[cat] = []
        if (!newMap[cat].includes(s.skill_name)) { newMap[cat] = [...newMap[cat], s.skill_name]; count++ }
      })
      setSkillMap(newMap); save('profile-skillmap', newMap)
    }

    if (p.languages?.length) {
      const PROF_MAP: Record<string, string> = { fluent: 'c1', intermediate: 'b1', basic: 'a2' }
      const accepted = (importAccepted['languages'] ?? [])
      const newLangs: LangEntry[] = p.languages.filter((_, i) => accepted[i]).map(l => ({
        id: genId(), language: l.language ?? '',
        proficiency: PROF_MAP[l.proficiency ?? ''] ?? (PROFICIENCY.find(pf => pf.value === l.proficiency) ? l.proficiency! : 'b1'),
      }))
      if (newLangs.length) { count += newLangs.length; const next = [...languages, ...newLangs]; setLanguages(next); save('profile-language', next) }
    }

    if (p.certificates?.length) {
      const accepted = (importAccepted['certificates'] ?? [])
      const newCerts: CertEntry[] = p.certificates.filter((_, i) => accepted[i]).map(c => ({
        id: genId(), name: String(c.name ?? ''), issuer: String(c.issuer ?? ''),
        issueDate: String(c.issue_date ?? ''), expiryDate: '', credentialUrl: String(c.credential_url ?? ''),
      }))
      if (newCerts.length) { count += newCerts.length; const next = [...certificates, ...newCerts]; setCertificates(next); save('profile-certificate', next) }
    }

    if (p.activities?.length) {
      const accepted = (importAccepted['activities'] ?? [])
      const newActs: ActvEntry[] = p.activities.filter((_, i) => accepted[i]).map(a => ({
        id: genId(), organization: String(a.organization_zh ?? ''), role: String(a.role ?? ''),
        startDate: String(a.start_date ?? ''), endDate: String(a.end_date ?? ''), description: String(a.description ?? ''),
      }))
      if (newActs.length) { count += newActs.length; const next = [...activities, ...newActs]; setActivities(next); save('profile-activity', next) }
    }

    if (importAccepted['summary_zh']?.[0] && p.summary_zh) { count++; setSummaryZh(p.summary_zh); save('profile-summary-zh', p.summary_zh) }
    if (importAccepted['summary_en']?.[0] && p.summary_en) { count++; setSummaryEn(p.summary_en); save('profile-summary-en', p.summary_en) }

    setImportParsed(null); setImportAccepted({}); setImportWarning(null)
    showToast(`✓ 成功匯入 ${count} 筆資料，請逐一確認內容正確性`)
  }

  // ── Modal content renderer (Features 3,4,5) ──
  function renderModalContent() {
    if (!modalSection) return null
    const md = modalData
    const set = (k: string, v: string | boolean) => setModalData(p => ({ ...p, [k]: v }))

    if (modalSection === 'education') {
      const knownSchool = SCHOOLS.find(s => s.zh !== '其他' && s.zh === (md.schoolName as string))
      const schoolSelectVal = knownSchool ? knownSchool.zh : ((md.schoolName as string) ? '其他' : '')
      const knownMajor = MAJORS.slice(0, -1).includes(md.major as string)
      const majorSelectVal = knownMajor ? (md.major as string) : ((md.major as string) ? '其他' : '')

      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>學校名稱 *</label>
            <select className={inputCls} value={schoolSelectVal}
              onChange={e => {
                if (!e.target.value || e.target.value === '其他') { set('schoolName', ''); set('schoolNameEn', '') }
                else { const s = SCHOOLS.find(s => s.zh === e.target.value)!; set('schoolName', s.zh); set('schoolNameEn', s.en) }
              }}>
              <option value="">請選擇學校</option>
              {SCHOOLS.map(s => <option key={s.zh} value={s.zh}>{s.zh}</option>)}
            </select>
            {(!knownSchool) && (
              <input className={`${inputCls} mt-1.5`} placeholder="輸入學校名稱（中文）"
                value={(md.schoolName as string) ?? ''} onChange={e => set('schoolName', e.target.value)} />
            )}
          </div>
          <div>
            <label className={labelCls}>學校英文名稱</label>
            <input className={inputCls} placeholder="University Name (English)"
              value={(md.schoolNameEn as string) ?? ''} onChange={e => set('schoolNameEn', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>學位</label>
              <select className={inputCls} value={(md.degree as string) ?? ''} onChange={e => set('degree', e.target.value)}>
                <option value="">請選擇</option>
                {DEGREES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>GPA</label>
              <input className={inputCls} placeholder="如：3.8 / 4.0"
                value={(md.gpa as string) ?? ''} onChange={e => set('gpa', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>科系/主修</label>
            <select className={inputCls} value={majorSelectVal}
              onChange={e => { if (!e.target.value || e.target.value === '其他') set('major', ''); else set('major', e.target.value) }}>
              <option value="">請選擇科系</option>
              {MAJORS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            {(!knownMajor) && (
              <input className={`${inputCls} mt-1.5`} placeholder="輸入科系名稱"
                value={(md.major as string) ?? ''} onChange={e => set('major', e.target.value)} />
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateSelect label="開始" value={(md.startDate as string) ?? ''} onChange={v => set('startDate', v)} />
            <DateSelect label="結束" value={(md.endDate as string) ?? ''} onChange={v => set('endDate', v)} disabled={!!(md.isCurrent)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!(md.isCurrent)} onChange={e => set('isCurrent', e.target.checked)} className="rounded border-warm-300 text-terra-500" />
            <span className="text-sm text-ink-700">目前就讀中（至今）</span>
          </label>
          <div>
            <label className={labelCls}>描述</label>
            <textarea rows={3} className={`${inputCls} resize-none`} value={(md.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      )
    }

    if (modalSection === 'experience' || modalSection === 'internship') {
      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>公司名稱（中文） *</label>
            <input className={inputCls} placeholder="公司名稱" value={(md.company as string) ?? ''} onChange={e => set('company', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>公司英文名稱</label>
            <input className={inputCls} placeholder="Company Name (English)" value={(md.companyEn as string) ?? ''} onChange={e => set('companyEn', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>職稱</label>
              <input className={inputCls} placeholder="職稱（中文）" value={(md.title as string) ?? ''} onChange={e => set('title', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>英文職稱</label>
              <input className={inputCls} placeholder="Job Title" value={(md.titleEn as string) ?? ''} onChange={e => set('titleEn', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>地點</label>
            <input className={inputCls} placeholder="工作地點" value={(md.location as string) ?? ''} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateSelect label="開始" value={(md.startDate as string) ?? ''} onChange={v => set('startDate', v)} />
            <DateSelect label="結束" value={(md.endDate as string) ?? ''} onChange={v => set('endDate', v)} disabled={!!(md.isCurrent)} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!(md.isCurrent)} onChange={e => set('isCurrent', e.target.checked)} className="rounded border-warm-300 text-terra-500" />
            <span className="text-sm text-ink-700">{modalSection === 'internship' ? '實習中（至今）' : '目前在職（至今）'}</span>
          </label>
          <div>
            <label className={labelCls}>工作描述</label>
            <textarea rows={4} className={`${inputCls} resize-none`} value={(md.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      )
    }

    if (modalSection === 'project') {
      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>專案名稱（中文） *</label>
            <input className={inputCls} placeholder="專案名稱" value={(md.projectName as string) ?? ''} onChange={e => set('projectName', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>英文專案名稱</label>
            <input className={inputCls} placeholder="Project Name (English)" value={(md.projectNameEn as string) ?? ''} onChange={e => set('projectNameEn', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>角色/職責</label>
              <input className={inputCls} placeholder="角色（中文）" value={(md.role as string) ?? ''} onChange={e => set('role', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>英文角色</label>
              <input className={inputCls} placeholder="Role (English)" value={(md.roleEn as string) ?? ''} onChange={e => set('roleEn', e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls}>專案連結</label>
            <input className={inputCls} placeholder="https://..." value={(md.url as string) ?? ''} onChange={e => set('url', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateSelect label="開始" value={(md.startDate as string) ?? ''} onChange={v => set('startDate', v)} />
            <DateSelect label="結束" value={(md.endDate as string) ?? ''} onChange={v => set('endDate', v)} />
          </div>
          <div>
            <label className={labelCls}>描述</label>
            <textarea rows={3} className={`${inputCls} resize-none`} value={(md.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      )
    }

    if (modalSection === 'certificate') {
      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>證照名稱 *</label>
            <input className={inputCls} value={(md.name as string) ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>發行機構</label>
            <input className={inputCls} value={(md.issuer as string) ?? ''} onChange={e => set('issuer', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <DateSelect label="取得日期" value={(md.issueDate as string) ?? ''} onChange={v => set('issueDate', v)} />
            <DateSelect label="到期日期" value={(md.expiryDate as string) ?? ''} onChange={v => set('expiryDate', v)} />
          </div>
          <div>
            <label className={labelCls}>認證連結</label>
            <input className={inputCls} placeholder="https://..." value={(md.credentialUrl as string) ?? ''} onChange={e => set('credentialUrl', e.target.value)} />
          </div>
        </div>
      )
    }

    if (modalSection === 'activity') {
      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>社團/組織 *</label>
            <input className={inputCls} value={(md.organization as string) ?? ''} onChange={e => set('organization', e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>職位/角色</label>
            <input className={inputCls} value={(md.role as string) ?? ''} onChange={e => set('role', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DateSelect label="開始" value={(md.startDate as string) ?? ''} onChange={v => set('startDate', v)} />
            <DateSelect label="結束" value={(md.endDate as string) ?? ''} onChange={v => set('endDate', v)} />
          </div>
          <div>
            <label className={labelCls}>描述</label>
            <textarea rows={3} className={`${inputCls} resize-none`} value={(md.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      )
    }

    if (modalSection === 'conference') {
      return (
        <div className="space-y-3 pr-1">
          <div>
            <label className={labelCls}>會議名稱 *</label>
            <input className={inputCls} value={(md.name as string) ?? ''} onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>參與角色</label>
              <select className={inputCls} value={(md.role as string) ?? 'attendee'} onChange={e => set('role', e.target.value)}>
                {CONF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <DateSelect label="日期" value={(md.date as string) ?? ''} onChange={v => set('date', v)} />
          </div>
          <div>
            <label className={labelCls}>描述</label>
            <textarea rows={3} className={`${inputCls} resize-none`} value={(md.description as string) ?? ''} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      )
    }

    return null
  }

  // ── Import preview modal ──
  function renderImportModal() {
    if (!importParsed) return null
    const p = importParsed

    function toggleItem(sec: string, idx: number) {
      setImportAccepted(prev => {
        const arr = [...(prev[sec] ?? [])]
        arr[idx] = !arr[idx]
        return { ...prev, [sec]: arr }
      })
    }

    function totalAccepted() {
      return Object.values(importAccepted).reduce((s, arr) => s + arr.filter(Boolean).length, 0)
    }

    type ImportItem = { sec: string; idx: number; label: string; detail: string }
    const items: ImportItem[] = []

    if (p.basic && importAccepted['basic']) {
      const b = p.basic
      items.push({ sec: 'basic', idx: 0, label: '基本資訊', detail: [b.name_zh, b.name_en, b.email, b.phone].filter(Boolean).join(' · ') })
    }
    p.education?.forEach((e, i) => items.push({ sec: 'education', idx: i, label: `學歷：${e.school_name_zh ?? e.school_name_en ?? '—'}`, detail: [e.degree, e.major_zh, e.start_date && e.end_date ? `${e.start_date} ~ ${e.end_date}` : ''].filter(Boolean).join(' · ') }))
    p.experience?.forEach((e, i) => items.push({ sec: 'experience', idx: i, label: `工作：${e.company_zh ?? e.company_en ?? '—'}`, detail: [e.title_zh ?? e.title_en, e.start_date && e.end_date ? `${e.start_date} ~ ${e.end_date}` : ''].filter(Boolean).join(' · ') }))
    p.internship?.forEach((e, i) => items.push({ sec: 'internship', idx: i, label: `實習：${e.company_zh ?? e.company_en ?? '—'}`, detail: [e.title_zh ?? e.title_en, e.start_date].filter(Boolean).join(' · ') }))
    p.project?.forEach((e, i) => items.push({ sec: 'project', idx: i, label: `專案：${e.project_name_zh ?? e.project_name_en ?? '—'}`, detail: String(e.role_zh ?? e.role_en ?? '') }))
    p.skills?.forEach((s, i) => items.push({ sec: 'skills', idx: i, label: `技能：${s.skill_name ?? ''}`, detail: s.category ?? '' }))
    p.languages?.forEach((l, i) => items.push({ sec: 'languages', idx: i, label: `語言：${l.language ?? ''}`, detail: l.proficiency ?? '' }))
    p.certificates?.forEach((c, i) => items.push({ sec: 'certificates', idx: i, label: `證照：${c.name ?? ''}`, detail: [c.issuer, c.issue_date].filter(Boolean).join(' · ') }))
    p.activities?.forEach((a, i) => items.push({ sec: 'activities', idx: i, label: `社團：${a.organization_zh ?? ''}`, detail: String(a.role ?? '') }))
    if (p.summary_zh && importAccepted['summary_zh']) items.push({ sec: 'summary_zh', idx: 0, label: '中文自傳', detail: p.summary_zh.slice(0, 50) + '...' })
    if (p.summary_en && importAccepted['summary_en']) items.push({ sec: 'summary_en', idx: 0, label: '英文自傳 (EN)', detail: p.summary_en.slice(0, 50) + '...' })

    const accepted = totalAccepted()

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(75,64,56,0.4)' }}>
        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between mb-2 shrink-0">
            <h3 className="text-base font-semibold text-ink-800">AI 解析完成，請確認以下資訊</h3>
            <button type="button" onClick={() => { setImportParsed(null); setImportAccepted({}); setImportWarning(null) }}
              className="rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-sm text-ink-400 hover:text-ink-600 transition-colors">✕</button>
          </div>
          <p className="text-xs text-ink-500 mb-3 shrink-0">所有資料來自你的履歷原文，請確認正確性後再匯入</p>
          {importWarning && (
            <p className="mb-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-700 leading-relaxed shrink-0">
              ⚠️ {importWarning}
            </p>
          )}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {items.length === 0 && <p className="text-sm text-ink-400 py-4 text-center">未解析到可匯入的資料</p>}
            {items.map(item => {
              const checked = importAccepted[item.sec]?.[item.idx] ?? false
              return (
                <div key={`${item.sec}-${item.idx}`}
                  className="flex items-center gap-3 rounded-xl border border-warm-200 bg-cream-50 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-700 truncate">{item.label}</p>
                    {item.detail && <p className="text-xs text-ink-400 truncate">{item.detail}</p>}
                  </div>
                  <button type="button" onClick={() => toggleItem(item.sec, item.idx)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border ${
                      checked
                        ? 'bg-sage-50 border-sage-300 text-sage-700'
                        : 'bg-cream-100 border-warm-200 text-ink-400'
                    }`}>
                    {checked ? '✓ 保留' : '✕ 不匯入'}
                  </button>
                </div>
              )
            })}
          </div>
          <p className="mt-3 rounded-xl border border-honey-200 bg-honey-50 px-3 py-2 text-xs text-honey-700 leading-relaxed shrink-0">
            ⚠ 請確認以上資訊確實來自你的履歷，AI 解析可能有誤，確認後才會儲存
          </p>
          <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-warm-100 shrink-0">
            <button type="button" onClick={() => { setImportParsed(null); setImportAccepted({}); setImportWarning(null) }}
              className="rounded-xl border border-warm-200 bg-cream-100 px-4 py-2 text-sm text-ink-600 hover:bg-cream-200 transition-colors">取消</button>
            <button type="button" onClick={applyImport} disabled={accepted === 0}
              className="rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors disabled:opacity-50 shadow-[var(--shadow-warm-sm)]">
              確認匯入選取項目 ({accepted}) →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center py-24">
        <Spinner className="h-6 w-6 text-terra-500" />
      </div>
    )
  }

  if (authRequired) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 py-24 text-center px-4">
        <p className="text-2xl">🔒</p>
        <p className="font-semibold text-ink-700">請先登入才能使用個人檔案庫</p>
        <p className="text-sm text-ink-400">你的資料會存進帳號，登入後即可跨裝置存取</p>
        <a href="/auth/signin?callbackUrl=/profile-library"
          className="rounded-xl bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
          前往登入 →
        </a>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 py-24 text-center px-4">
        <p className="text-2xl">⚠️</p>
        <p className="font-semibold text-ink-700">個人檔案資料載入失敗</p>
        <p className="text-sm text-ink-400 max-w-sm">可能是網路不穩或伺服器暫時無法回應。為了避免用空白資料覆蓋你已經存在的內容，這裡先不會顯示編輯畫面，請重試一次。</p>
        <button onClick={loadProfile}
          className="rounded-xl bg-terra-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
          重新載入
        </button>
      </div>
    )
  }

  return (
    <div className="flex min-h-full">

      {/* Left nav */}
      <aside className="hidden md:block w-48 shrink-0">
        <div className="sticky top-0 h-screen overflow-y-auto pt-6 pb-8 pl-3 pr-2">
          <p className="px-2 pb-3 text-[10px] font-semibold uppercase tracking-widest text-ink-300">區塊導覽</p>
          <ul className="space-y-0.5">
            {NAV_SECTIONS.map(s => (
              <li key={s.id}>
                <button onClick={() => scrollTo(s.id)}
                  className="w-full text-left rounded-lg px-3 py-1.5 text-xs text-ink-500 hover:text-terra-600 hover:bg-terra-50/60 transition-all">
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 px-4 md:px-8 pt-16 pb-28 md:py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-ink-900">個人檔案庫</h1>
            <p className="mt-1 text-xs md:text-sm text-ink-400">你的職涯原始資料，建立履歷時自動引用</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {saveStatus !== 'idle' && (
              <span className={`flex items-center gap-1.5 text-xs font-medium ${saveStatus === 'saved' ? 'text-sage-600' : saveStatus === 'failed' ? 'text-red-500' : 'text-ink-400'}`}>
                {saveStatus === 'saving' ? <><Spinner className="h-3 w-3" />儲存中</> : saveStatus === 'failed' ? '✗ 儲存失敗' : '✓ 已儲存'}
              </span>
            )}
            <button onClick={saveAll}
              className="rounded-xl bg-terra-500 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
              儲存所有變更
            </button>
          </div>
        </div>

        {/* Import resume block (Feature 1) */}
        <div className="rounded-2xl border-2 border-dashed border-warm-300 bg-cream-50 p-6 text-center">
          {importParsing ? (
            <div className="space-y-3">
              <Spinner className="h-6 w-6 text-terra-500 mx-auto" />
              <p className="text-sm font-medium text-ink-700">AI 正在解析你的履歷，請稍候...</p>
              <p className="text-xs text-ink-400">
                {importStep === 0 ? '解析文件格式中...' : importStep === 1 ? '擷取個人資訊...' : importStep === 2 ? '整理學歷與經歷...' : '填入各區塊...'}
              </p>
            </div>
          ) : (
            <>
              <p className="text-2xl mb-2">📄</p>
              <p className="text-sm font-semibold text-ink-700 mb-1">上傳現有履歷，AI 自動填入各區塊</p>
              <p className="text-xs text-ink-400 mb-4">支援 PDF、DOC、DOCX，最大 10MB</p>
              <button type="button" onClick={() => importFileRef.current?.click()}
                className="rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                選擇檔案
              </button>
            </>
          )}
          <input ref={importFileRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { handleImportFile(f); e.target.value = '' } }} />
        </div>

        {/* Data source explanation */}
        <div className="bg-sage-50 border-l-4 border-l-sage-400 rounded-xl px-4 py-3 text-sm text-sage-700">
          個人檔案庫是你所有職涯資料的唯一來源，Resume Lab 建立的所有履歷都從這裡取得資料。
        </div>

        {/* Progress bar */}
        <div className="rounded-2xl border border-warm-200 bg-white p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-ink-500">資料完整度</span>
            <span className="text-xs font-bold text-terra-600">{completeness}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-warm-100 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${completeness}%`, background: completeness >= 80 ? '#7FA887' : '#C97941' }} />
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {NAV_SECTIONS.map(s => (
            <button key={s.id} onClick={() => scrollTo(s.id)}
              className="shrink-0 rounded-full border border-warm-200 bg-white px-3 py-1 text-xs text-ink-500 whitespace-nowrap hover:border-terra-300 hover:text-terra-600 transition-all">
              {s.label}
            </button>
          ))}
        </div>

        {/* ════ BASIC INFO ════ */}
        <div ref={el => { sectionRefs.current['basic'] = el }}>
          <SectionCard id="basic" title="基本資訊">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([['nameZh','中文姓名'],['nameEn','英文姓名'],['email','Email'],['phone','電話']] as [keyof BasicInfo,string][]).map(([k,l]) => (
                <div key={k}>
                  <label className={labelCls}>{l}</label>
                  <input className={inputCls} value={basic[k]} placeholder={l} onChange={e => setBasicField(k, e.target.value)} />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className={labelCls}>地址</label>
                <input className={inputCls} value={basic.address} placeholder="居住地址（選填）" onChange={e => setBasicField('address', e.target.value)} />
              </div>
              {([['linkedinUrl','LinkedIn URL'],['portfolioUrl','作品集 URL'],['websiteUrl','個人網站']] as [keyof BasicInfo,string][]).map(([k,l]) => (
                <div key={k}>
                  <label className={labelCls}>{l}</label>
                  <input className={inputCls} value={basic[k]} placeholder="https://..." onChange={e => setBasicField(k, e.target.value)} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ════ LIST SECTIONS ════ */}
        {([
          { key: 'education',  label: '學歷',    section: 'education'  as ModalSection, items: educations,  setter: setEducations,  lsKey: 'profile-education' },
          { key: 'experience', label: '工作經歷', section: 'experience' as ModalSection, items: experiences, setter: setExperiences, lsKey: 'profile-experience' },
          { key: 'internship', label: '實習經驗', section: 'internship' as ModalSection, items: internships, setter: setInternships, lsKey: 'profile-internship' },
          { key: 'project',    label: '專案經驗', section: 'project'    as ModalSection, items: projects,    setter: setProjects,    lsKey: 'profile-project' },
        ] as const).map(({ key, label, section, items, setter, lsKey }) => (
          <div key={key} ref={el => { sectionRefs.current[key] = el }}>
            <SectionCard id={key} title={label} onAdd={() => openAdd(section)}>
              <DndContext sensors={sensors} collisionDetection={closestCenter}
                onDragEnd={makeDragEnd(items as { id: string }[], setter as (v: { id: string }[]) => void, lsKey)}>
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.length === 0 && <EmptyHint text={`尚未新增${label}`} />}
                    {items.map(item => {
                      const edu  = item as EduEntry
                      const exp  = item as ExpEntry
                      const proj = item as ProjEntry
                      const primary   = edu.schoolName ?? exp.company ?? proj.projectName ?? ''
                      const secondary = [edu.degree ?? exp.title ?? proj.role, edu.major ?? exp.location ?? ''].filter(Boolean).join(' · ')
                      const dates     = [item.startDate ?? '', (item as EduEntry).isCurrent ? '至今' : (item.endDate ?? '')].filter(Boolean).join(' ~ ')
                      return (
                        <SortableRow key={item.id} id={item.id}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-ink-700 truncate">{primary}</p>
                            <p className="text-xs text-ink-400 truncate">{[secondary, dates].filter(Boolean).join('  ·  ')}</p>
                          </div>
                          <button type="button" onClick={() => openEdit(section, item as unknown as Record<string, unknown>)}
                            className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">編輯</button>
                          <button type="button" onClick={() => deleteItem(item.id, items as {id:string}[], setter as (v:{id:string}[])=>void, lsKey)}
                            className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                        </SortableRow>
                      )
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            </SectionCard>
          </div>
        ))}

        {/* ════ SKILL (Feature 6) ════ */}
        <div ref={el => { sectionRefs.current['skill'] = el }}>
          <SectionCard id="skill" title="技能">
            <div className="space-y-5">
              {SKILL_CATS.map(cat => (
                <div key={cat}>
                  <p className="text-xs font-semibold text-ink-500 mb-2">{cat}</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(skillMap[cat] ?? []).map((skill, idx) => (
                      <span key={idx} className="flex items-center gap-1 rounded-full border border-terra-200 bg-terra-50 px-2.5 py-0.5 text-xs text-terra-700">
                        {skill}
                        <button type="button" onClick={() => removeSkill(cat, idx)} className="text-terra-400 hover:text-red-400 leading-none">×</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mb-1.5">
                    <select value={skillSelects[cat] ?? ''} onChange={e => addSkillFromSelect(cat, e.target.value)}
                      className="flex-1 rounded-xl border border-warm-200 bg-cream-50 px-3 py-1.5 text-sm text-ink-600 focus:border-terra-400 focus:outline-none">
                      <option value="">常用{cat}...</option>
                      {(SKILL_OPTIONS[cat] ?? []).filter(s => !(skillMap[cat] ?? []).includes(s)).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input className="flex-1 rounded-xl border border-warm-200 bg-cream-50 px-3 py-1.5 text-sm text-ink-800 placeholder:text-ink-300 focus:border-terra-400 focus:outline-none"
                      placeholder={`自訂${cat}...`}
                      value={skillInputs[cat] ?? ''}
                      onChange={e => setSkillInputs(p => ({ ...p, [cat]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(cat) } }} />
                    <button type="button" onClick={() => addSkill(cat)}
                      className="rounded-xl border border-warm-200 bg-cream-50 px-3 py-1.5 text-xs text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all">新增</button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ════ LANGUAGE (Feature 6) ════ */}
        <div ref={el => { sectionRefs.current['language'] = el }}>
          <SectionCard id="language" title="語言能力" onAdd={addLanguage} addLabel="＋ 新增語言">
            <div className="space-y-2">
              {languages.length === 0 && <EmptyHint text="尚未新增語言能力" />}
              {languages.map(lang => {
                const isKnown = LANGUAGE_OPTIONS.includes(lang.language)
                return (
                  <div key={lang.id} className="flex items-center gap-2 rounded-xl border border-warm-200 bg-cream-50 px-3 py-2">
                    <select value={isKnown ? lang.language : '其他'} onChange={e => {
                      if (e.target.value === '其他') setLangField(lang.id, 'language', '')
                      else setLangField(lang.id, 'language', e.target.value)
                    }} className="flex-1 rounded-lg border border-warm-200 bg-white px-2 py-1.5 text-sm text-ink-800 focus:border-terra-400 focus:outline-none">
                      <option value="">選擇語言</option>
                      {LANGUAGE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                      <option value="其他">其他</option>
                    </select>
                    {!isKnown && (
                      <input className="w-24 rounded-lg border border-warm-200 bg-white px-2 py-1.5 text-sm text-ink-800 placeholder:text-ink-300 focus:border-terra-400 focus:outline-none"
                        placeholder="語言名稱" value={lang.language}
                        onChange={e => setLangField(lang.id, 'language', e.target.value)} />
                    )}
                    <select value={lang.proficiency} onChange={e => setLangField(lang.id, 'proficiency', e.target.value)}
                      className="rounded-lg border border-warm-200 bg-white px-2 py-1.5 text-xs text-ink-600 focus:border-terra-400 focus:outline-none">
                      {PROFICIENCY.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                    <button type="button"
                      onClick={() => { const next = languages.filter(l => l.id !== lang.id); setLanguages(next); save('profile-language', next) }}
                      className="text-ink-200 hover:text-red-400 transition-colors text-lg leading-none shrink-0">×</button>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>

        {/* ════ CERTIFICATE ════ */}
        <div ref={el => { sectionRefs.current['certificate'] = el }}>
          <SectionCard id="certificate" title="證照" onAdd={() => openAdd('certificate')}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragEnd(certificates, setCertificates, 'profile-certificate')}>
              <SortableContext items={certificates.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {certificates.length === 0 && <EmptyHint text="尚未新增證照" />}
                  {certificates.map(cert => (
                    <SortableRow key={cert.id} id={cert.id}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-700 truncate">{cert.name}</p>
                        <p className="text-xs text-ink-400 truncate">{[cert.issuer, cert.issueDate].filter(Boolean).join('  ·  ')}</p>
                      </div>
                      <button type="button" onClick={() => openEdit('certificate', cert as unknown as Record<string, unknown>)}
                        className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">編輯</button>
                      <button type="button" onClick={() => deleteItem(cert.id, certificates, setCertificates, 'profile-certificate')}
                        className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </SectionCard>
        </div>

        {/* ════ ACTIVITY ════ */}
        <div ref={el => { sectionRefs.current['activity'] = el }}>
          <SectionCard id="activity" title="社團活動" onAdd={() => openAdd('activity')}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={makeDragEnd(activities, setActivities, 'profile-activity')}>
              <SortableContext items={activities.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {activities.length === 0 && <EmptyHint text="尚未新增社團活動" />}
                  {activities.map(act => (
                    <SortableRow key={act.id} id={act.id}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-700 truncate">{act.organization}</p>
                        <p className="text-xs text-ink-400 truncate">{[act.role, act.startDate && act.endDate ? `${act.startDate} ~ ${act.endDate}` : ''].filter(Boolean).join('  ·  ')}</p>
                      </div>
                      <button type="button" onClick={() => openEdit('activity', act as unknown as Record<string, unknown>)}
                        className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">編輯</button>
                      <button type="button" onClick={() => deleteItem(act.id, activities, setActivities, 'profile-activity')}
                        className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                    </SortableRow>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </SectionCard>
        </div>

        {/* ════ CONFERENCE ════ */}
        <div ref={el => { sectionRefs.current['conference'] = el }}>
          <SectionCard id="conference" title="會議" onAdd={() => openAdd('conference')}>
            <div className="space-y-2">
              {conferences.length === 0 && <EmptyHint text="尚未新增會議記錄" />}
              {conferences.map(conf => (
                <div key={conf.id} className="flex items-center gap-2 rounded-xl border border-warm-200 bg-white px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-700 truncate">{conf.name}</p>
                    <p className="text-xs text-ink-400">{[CONF_ROLES.find(r => r.value === conf.role)?.label, conf.date].filter(Boolean).join('  ·  ')}</p>
                  </div>
                  <button type="button" onClick={() => openEdit('conference', conf as unknown as Record<string, unknown>)}
                    className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-terra-300 hover:text-terra-600 transition-all">編輯</button>
                  <button type="button" onClick={() => deleteItem(conf.id, conferences, setConferences, 'profile-conference')}
                    className="shrink-0 rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        {/* ════ SUMMARY ════ */}
        <div ref={el => { sectionRefs.current['summary'] = el }}>
          <SectionCard id="summary" title="自傳">
            <div className="space-y-4">
              <div>
                <label className={labelCls}>中文自傳</label>
                <textarea rows={5} className={`${inputCls} resize-y`} placeholder="請輸入中文自傳內容..."
                  value={summaryZh} onChange={e => { setSummaryZh(e.target.value); save('profile-summary-zh', e.target.value) }} />
              </div>
              <div>
                <label className={labelCls}>英文自傳 (English Summary)</label>
                <textarea rows={5} className={`${inputCls} resize-y`} placeholder="Write your English summary here..."
                  value={summaryEn} onChange={e => { setSummaryEn(e.target.value); save('profile-summary-en', e.target.value) }} />
              </div>
            </div>
          </SectionCard>
        </div>

        {/* ════ ATTACHMENT ════ */}
        <div ref={el => { sectionRefs.current['attachment'] = el }}>
          <SectionCard id="attachment" title="作品附件">
            <div className="space-y-3">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 rounded-xl border-2 border-dashed border-warm-300 px-4 py-3 text-sm text-ink-500 hover:border-terra-300 hover:text-terra-600 transition-all disabled:opacity-50">
                {uploading ? <><Spinner className="h-4 w-4" />上傳中...</> : '📎 上傳附件 (PDF / JPG / PNG · 最大 10MB)'}
              </button>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleAttachmentUpload(f) }} />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 rounded-xl border border-warm-200 bg-cream-50 px-3 py-2.5">
                      <span className="text-lg shrink-0">{att.fileType === 'application/pdf' ? '📄' : '🖼'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-700 truncate">{att.fileName}</p>
                        <input className="mt-0.5 w-full bg-transparent text-xs text-ink-400 placeholder:text-ink-300 outline-none"
                          placeholder="描述（選填）" value={att.description}
                          onChange={e => { const next = attachments.map(a => a.id === att.id ? { ...a, description: e.target.value } : a); setAttachments(next); save('profile-attachment', next) }} />
                      </div>
                      {att.fileUrl && !att.fileUrl.startsWith('data:application/pdf') && (
                        <a href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-xs text-terra-500 hover:text-terra-700 underline">查看</a>
                      )}
                      <button type="button"
                        onClick={() => { const next = attachments.filter(a => a.id !== att.id); setAttachments(next); save('profile-attachment', next) }}
                        className="shrink-0 text-ink-200 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ════ CUSTOM BLOCKS ════ */}
        <div ref={el => { sectionRefs.current['custom'] = el }}>
          <SectionCard id="custom" title="自訂區塊" onAdd={addCustomBlock} addLabel="＋ 新增區塊">
            <div className="space-y-4">
              {customBlocks.length === 0 && <EmptyHint text="可新增自訂區塊，例如：獲獎記錄、志工經驗" />}
              {customBlocks.map(block => (
                <div key={block.id} className="rounded-xl border border-warm-200 bg-cream-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input className="flex-1 rounded-xl border border-warm-200 bg-white px-3 py-2 text-sm font-medium text-ink-800 placeholder:text-ink-300 focus:border-terra-400 focus:outline-none"
                      placeholder="區塊標題（如：志工經歷、獲獎記錄）" value={block.sectionTitle}
                      onChange={e => setCustomField(block.id, 'sectionTitle', e.target.value)} />
                    <button type="button"
                      onClick={() => { const next = customBlocks.filter(b => b.id !== block.id); setCustomBlocks(next); save('profile-custom', next) }}
                      className="shrink-0 rounded-lg border border-warm-200 bg-white px-2.5 py-1 text-xs text-ink-400 hover:border-red-200 hover:text-red-400 transition-all">刪除</button>
                  </div>
                  <textarea rows={3} className={`${inputCls} resize-y`} placeholder="內容..."
                    value={block.content} onChange={e => setCustomField(block.id, 'content', e.target.value)} />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="h-8" />
      </div>

      {/* Mobile sticky save */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-warm-200 bg-white px-4 pt-3 pb-safe">
        <button onClick={saveAll}
          className="w-full rounded-xl bg-terra-500 py-3 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
          {saveStatus === 'saving' ? '儲存中...' : saveStatus === 'saved' ? '✓ 已儲存' : '儲存所有變更'}
        </button>
      </div>

      {/* ════ MODAL ════ */}
      {modalSection && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(75,64,56,0.4)' }}
          onClick={() => setModalSection(null)}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 shadow-xl flex flex-col max-h-[90dvh]"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5 shrink-0">
              <h3 className="text-base font-semibold text-ink-800">
                {editingId ? '編輯' : '新增'}{MODAL_TITLES[modalSection]}
              </h3>
              <button type="button" onClick={() => setModalSection(null)}
                className="rounded-lg border border-warm-200 bg-cream-50 px-2.5 py-1 text-sm text-ink-400 hover:text-ink-600 transition-colors">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              {renderModalContent()}
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-warm-100 shrink-0 pb-safe">
              <button type="button" onClick={() => setModalSection(null)}
                className="rounded-xl border border-warm-200 bg-cream-100 px-4 py-2 text-sm text-ink-600 hover:bg-cream-200 transition-colors">取消</button>
              <button type="button" onClick={saveModal}
                className="rounded-xl bg-terra-500 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-700 transition-colors shadow-[var(--shadow-warm-sm)]">
                {editingId ? '更新' : '新增'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ IMPORT PREVIEW MODAL ════ */}
      {renderImportModal()}

      {/* ════ TOAST ════ */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-2xl bg-ink-900 px-5 py-3 text-sm font-medium text-white shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-sm text-center">
          {toast}
        </div>
      )}

    </div>
  )
}
