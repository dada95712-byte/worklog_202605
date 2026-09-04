import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { syncManualSkills, getSkillMap } from '@/lib/skill-sync'

// PUT 會在同一個請求裡整份重寫個人檔案（技能同步 + 十幾張表的 delete+createMany），
// 正式環境對資料庫的網路延遲比本機測試高，明確拉高執行時間上限避免被平台中斷
export const maxDuration = 60

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

// ── GET: load the whole profile for the signed-in user ─────────────────────────

export async function GET() {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const [basic, educations, experiences, internships, projects, languages, skillMap, certificates, activities, conferences, attachments, customBlocks] =
    await Promise.all([
      prisma.profileBasic.findUnique({ where: { userId } }),
      prisma.profileEducation.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.profileExperience.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.profileInternship.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.profileProject.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
      prisma.profileLanguage.findMany({ where: { userId } }),
      getSkillMap(userId),
      prisma.profileCertificate.findMany({ where: { userId } }),
      prisma.profileActivity.findMany({ where: { userId } }),
      prisma.profileConference.findMany({ where: { userId } }),
      prisma.profileAttachment.findMany({ where: { userId } }),
      prisma.profileCustom.findMany({ where: { userId }, orderBy: { sortOrder: 'asc' } }),
    ])

  return NextResponse.json({
    basic: {
      nameZh: basic?.nameZh ?? '', nameEn: basic?.nameEn ?? '',
      email: basic?.email ?? '', phone: basic?.phone ?? '', address: basic?.address ?? '',
      linkedinUrl: basic?.linkedinUrl ?? '', portfolioUrl: basic?.portfolioUrl ?? '', websiteUrl: basic?.websiteUrl ?? '',
    } satisfies BasicInfo,
    summaryZh: basic?.summaryZh ?? '',
    summaryEn: basic?.summaryEn ?? '',
    educations: educations.map((e): EduEntry => ({ id: e.id, schoolName: e.schoolName, schoolNameEn: e.schoolNameEn ?? '', degree: e.degree ?? '', major: e.major ?? '', gpa: e.gpa ?? '', startDate: e.startDate ?? '', endDate: e.endDate ?? '', isCurrent: e.isCurrent, description: e.description ?? '' })),
    experiences: experiences.map((e): ExpEntry => ({ id: e.id, company: e.company, companyEn: e.companyEn ?? '', title: e.title ?? '', titleEn: e.titleEn ?? '', location: e.location ?? '', startDate: e.startDate ?? '', endDate: e.endDate ?? '', isCurrent: e.isCurrent, description: e.description ?? '' })),
    internships: internships.map((e): ExpEntry => ({ id: e.id, company: e.company, companyEn: e.companyEn ?? '', title: e.title ?? '', titleEn: e.titleEn ?? '', location: e.location ?? '', startDate: e.startDate ?? '', endDate: e.endDate ?? '', isCurrent: e.isCurrent, description: e.description ?? '' })),
    projects: projects.map((p): ProjEntry => ({ id: p.id, projectName: p.projectName, projectNameEn: p.projectNameEn ?? '', role: p.role ?? '', roleEn: p.roleEn ?? '', url: p.url ?? '', startDate: p.startDate ?? '', endDate: p.endDate ?? '', description: p.description ?? '' })),
    languages: languages.map((l): LangEntry => ({ id: l.id, language: l.language, proficiency: l.proficiency })),
    skillMap,
    certificates: certificates.map((c): CertEntry => ({ id: c.id, name: c.name, issuer: c.issuer ?? '', issueDate: c.issueDate ?? '', expiryDate: c.expiryDate ?? '', credentialUrl: c.credentialUrl ?? '' })),
    activities: activities.map((a): ActvEntry => ({ id: a.id, organization: a.organization, role: a.role ?? '', startDate: a.startDate ?? '', endDate: a.endDate ?? '', description: a.description ?? '' })),
    conferences: conferences.map((c): ConfEntry => ({ id: c.id, name: c.name, role: c.role, date: c.date ?? '', description: c.description ?? '' })),
    attachments: attachments.map((a): AttachEntry => ({ id: a.id, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType ?? '', description: a.description ?? '' })),
    customBlocks: customBlocks.map((c): CustomBlock => ({ id: c.id, sectionTitle: c.sectionTitle, content: c.content ?? '' })),
  })
}

// ── PUT: replace the whole profile for the signed-in user ──────────────────────

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  const userId = session!.user.id as string

  const body = await req.json() as {
    basic: BasicInfo
    summaryZh?: string; summaryEn?: string
    educations?: EduEntry[]; experiences?: ExpEntry[]; internships?: ExpEntry[]
    projects?: ProjEntry[]; languages?: LangEntry[]; skillMap?: Record<string, string[]>
    certificates?: CertEntry[]; activities?: ActvEntry[]; conferences?: ConfEntry[]
    attachments?: AttachEntry[]; customBlocks?: CustomBlock[]
  }

  const {
    basic, summaryZh = '', summaryEn = '',
    educations = [], experiences = [], internships = [], projects = [],
    languages = [], skillMap = {}, certificates = [], activities = [],
    conferences = [], attachments = [], customBlocks = [],
  } = body

  const skills = Object.entries(skillMap).flatMap(([category, names]) =>
    names.map((name) => ({ name, category }))
  )

  try {
    await syncManualSkills(userId, skills)

    await prisma.$transaction([
      prisma.profileBasic.upsert({
        where: { userId },
        update: { ...basic, summaryZh, summaryEn },
        create: { userId, ...basic, summaryZh, summaryEn },
      }),

      prisma.profileEducation.deleteMany({ where: { userId } }),
      prisma.profileEducation.createMany({
        data: educations.map((e, i) => ({ userId, sortOrder: i, schoolName: e.schoolName, schoolNameEn: e.schoolNameEn, degree: e.degree, major: e.major, gpa: e.gpa, startDate: e.startDate, endDate: e.endDate, isCurrent: e.isCurrent, description: e.description })),
      }),

      prisma.profileExperience.deleteMany({ where: { userId } }),
      prisma.profileExperience.createMany({
        data: experiences.map((e, i) => ({ userId, sortOrder: i, company: e.company, companyEn: e.companyEn, title: e.title, titleEn: e.titleEn, location: e.location, startDate: e.startDate, endDate: e.endDate, isCurrent: e.isCurrent, description: e.description })),
      }),

      prisma.profileInternship.deleteMany({ where: { userId } }),
      prisma.profileInternship.createMany({
        data: internships.map((e, i) => ({ userId, sortOrder: i, company: e.company, companyEn: e.companyEn, title: e.title, titleEn: e.titleEn, location: e.location, startDate: e.startDate, endDate: e.endDate, isCurrent: e.isCurrent, description: e.description })),
      }),

      prisma.profileProject.deleteMany({ where: { userId } }),
      prisma.profileProject.createMany({
        data: projects.map((p, i) => ({ userId, sortOrder: i, projectName: p.projectName, projectNameEn: p.projectNameEn, role: p.role, roleEn: p.roleEn, url: p.url, startDate: p.startDate, endDate: p.endDate, description: p.description })),
      }),

      prisma.profileLanguage.deleteMany({ where: { userId } }),
      prisma.profileLanguage.createMany({
        data: languages.map((l) => ({ userId, language: l.language, proficiency: l.proficiency })),
      }),

      prisma.profileCertificate.deleteMany({ where: { userId } }),
      prisma.profileCertificate.createMany({
        data: certificates.map((c) => ({ userId, name: c.name, issuer: c.issuer, issueDate: c.issueDate, expiryDate: c.expiryDate, credentialUrl: c.credentialUrl })),
      }),

      prisma.profileActivity.deleteMany({ where: { userId } }),
      prisma.profileActivity.createMany({
        data: activities.map((a) => ({ userId, organization: a.organization, role: a.role, startDate: a.startDate, endDate: a.endDate, description: a.description })),
      }),

      prisma.profileConference.deleteMany({ where: { userId } }),
      prisma.profileConference.createMany({
        data: conferences.map((c) => ({ userId, name: c.name, role: c.role || 'attendee', date: c.date, description: c.description })),
      }),

      prisma.profileAttachment.deleteMany({ where: { userId } }),
      prisma.profileAttachment.createMany({
        data: attachments.map((a) => ({ userId, fileName: a.fileName, fileUrl: a.fileUrl, fileType: a.fileType, description: a.description })),
      }),

      prisma.profileCustom.deleteMany({ where: { userId } }),
      prisma.profileCustom.createMany({
        data: customBlocks.map((c, i) => ({ userId, sortOrder: i, sectionTitle: c.sectionTitle, content: c.content })),
      }),
    ], { timeout: 20000 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[api/profile PUT]', err)
    return NextResponse.json({ error: '儲存失敗，請稍後再試' }, { status: 500 })
  }
}
