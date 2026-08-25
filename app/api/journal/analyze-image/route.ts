import OpenAI from 'openai'
import { NextResponse } from 'next/server'
import { VISION_MODEL } from '@/lib/ai-client'
import { requireAuth } from '@/lib/auth-guard'

export async function POST(req: Request) {
  const { error: authError } = await requireAuth()
  if (authError) return authError

  try {
    const { imageUrl } = await req.json()
    if (!imageUrl) return NextResponse.json({ description: '' }, { status: 400 })

    // Data URLs can't be fetched by remote vision models — skip analysis
    if (imageUrl.startsWith('data:'))
      return NextResponse.json({ description: '' })

    const key = process.env.OPENROUTER_API_KEY
    if (!key) return NextResponse.json({ description: '' })

    const client = new OpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1' })
    const content: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: 'image_url', image_url: { url: imageUrl, detail: 'auto' } },
      {
        type: 'text',
        text: '請分析這張圖片的內容，用繁體中文描述。如果圖片包含文字（白板、截圖、筆記、證書等），請直接擷取並回覆文字內容；否則描述圖片中的場景與重點。回答請簡潔，不超過 150 字。',
      },
    ]

    try {
      const res = await client.chat.completions.create({
        model: VISION_MODEL,
        messages: [{ role: 'user', content }],
      })
      return NextResponse.json({ description: res.choices[0]?.message?.content ?? '' })
    } catch (err) {
      const e = err as { status?: number; message?: string }
      console.warn(`[analyze-image] ${VISION_MODEL} failed: ${e.status ?? ''} ${e.message ?? ''}`)
    }

    return NextResponse.json({ description: '' }, { status: 500 })
  } catch (err) {
    console.error('[analyze-image]', err)
    return NextResponse.json({ description: '' }, { status: 500 })
  }
}
