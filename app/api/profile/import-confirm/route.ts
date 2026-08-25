import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'

// This app uses localStorage exclusively (no server-side DB).
// Import confirmation and storage happen client-side via applyImport().
// This route exists as a typed endpoint stub for future server-side persistence.
export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { sections } = await req.json() as { sections: Record<string, unknown> }
    if (!sections || typeof sections !== 'object') {
      return NextResponse.json({ error: '請提供確認資料' }, { status: 400 })
    }
    // Acknowledge — actual write occurs in the browser via localStorage
    return NextResponse.json({ ok: true, confirmed: Object.keys(sections).length })
  } catch {
    return NextResponse.json({ error: '確認失敗' }, { status: 500 })
  }
}
