import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未找到檔案' }, { status: 400 })

    if (file.size > MAX_SIZE)
      return NextResponse.json({ error: '檔案超過 10MB 上限' }, { status: 400 })

    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json({ error: '僅支援 PDF、JPG、PNG 格式' }, { status: 400 })

    // Local dev fallback when Blob is not configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (file.type === 'application/pdf') {
        return NextResponse.json({
          url: `data:application/pdf;name=${encodeURIComponent(file.name)}`,
          fileName: file.name,
          fileType: file.type,
          local: true,
        })
      }
      const bytes = await file.arrayBuffer()
      const b64 = Buffer.from(bytes).toString('base64')
      return NextResponse.json({
        url: `data:${file.type};base64,${b64}`,
        fileName: file.name,
        fileType: file.type,
        local: true,
      })
    }

    const { url } = await put(`profile-attachments/${Date.now()}-${file.name}`, file, { access: 'public' })
    return NextResponse.json({ url, fileName: file.name, fileType: file.type })
  } catch (err) {
    console.error('[profile/upload]', err)
    return NextResponse.json({ error: '上傳失敗，請稍後再試' }, { status: 500 })
  }
}
