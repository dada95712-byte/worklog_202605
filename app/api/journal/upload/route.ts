import { put } from '@vercel/blob'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: '未找到檔案' }, { status: 400 })

    if (file.size > 5 * 1024 * 1024)
      return NextResponse.json({ error: '圖片太大，請上傳 5MB 以內的圖片' }, { status: 400 })

    if (!file.type.startsWith('image/'))
      return NextResponse.json({ error: '僅支援圖片格式（JPG / PNG）' }, { status: 400 })

    // Local dev fallback: return base64 data URL when Blob is not configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const bytes = await file.arrayBuffer()
      const b64 = Buffer.from(bytes).toString('base64')
      return NextResponse.json({
        url: `data:${file.type};base64,${b64}`,
        local: true,
      })
    }

    const { url } = await put(`journal/${Date.now()}-${file.name}`, file, { access: 'public' })
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: '上傳失敗，請稍後再試' }, { status: 500 })
  }
}
