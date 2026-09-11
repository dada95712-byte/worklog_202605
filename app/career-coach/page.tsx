'use client'

import { useState, useRef, useEffect } from 'react'
import { PageTooltip } from '@/components/onboarding/page-tooltip'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface ChatMessage { role: 'user' | 'assistant'; content: string }

const QUICK_Q = [
  '我想從傳統產業轉往科技業，該怎麼開始？',
  '我想在現有公司升職，有什麼建議？',
  '我剛被裁員，下一步怎麼辦？',
  '我是應屆生，不知道從哪裡找工作',
  '如何準備技術面試？',
  '薪資談判有什麼技巧？',
]

export default function CareerCoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '你好！我是你的 AI 職涯教練。\n\n今天想聊什麼職涯話題？無論是轉職、升職、求職策略，面試準備，或任何職場困惑，我都在。',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')
    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context: 'career_coach' }),
      })
      const data = await res.json()
      setMessages((p) => [...p, { role: 'assistant', content: data.reply ?? '抱歉，目前無法回應，請稍後再試。' }])
    } catch {
      setMessages((p) => [...p, { role: 'assistant', content: '抱歉，目前無法回應，請稍後再試。' }])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function clearChat() {
    setMessages([{
      role: 'assistant',
      content: '你好！我是你的 AI 職涯教練。\n\n今天想聊什麼職涯話題？無論是轉職、升職、求職策略，面試準備，或任何職場困惑，我都在。',
    }])
  }

  return (
    <div className="p-4 pt-16 md:pt-8 md:p-8 h-[calc(100vh-64px)] md:h-screen flex flex-col gap-4 max-w-3xl mx-auto"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <PageTooltip pageKey="career_coach" />
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-ink-900">🤖 AI 職涯教練</h1>
          <p className="mt-1 text-sm text-ink-500">轉職、升職、求職策略 — 隨時提問</p>
        </div>
        <button
          onClick={clearChat}
          className="rounded-xl border border-warm-200 bg-white px-3 py-1.5 text-xs text-ink-400 hover:border-warm-300 hover:text-ink-600 transition-colors"
        >
          清除對話
        </button>
      </div>

      {/* Quick questions — horizontal scroll on mobile */}
      <div className="flex gap-2 shrink-0 overflow-x-auto pb-1 -mx-1 px-1 md:flex-wrap">
        {QUICK_Q.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={loading}
            className="shrink-0 rounded-full border border-warm-300 bg-white px-3 py-1.5 text-xs text-ink-400 transition-all hover:border-terra-400/50 hover:bg-terra-50 hover:text-terra-500 disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat window */}
      <Card className="flex flex-1 flex-col overflow-hidden min-h-0">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {m.role === 'assistant' && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terra-50 border border-terra-200 text-sm">
                  🤖
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-terra-500 text-white rounded-tr-sm max-w-[80%]'
                    : 'bg-cream-200 text-ink-700 rounded-tl-sm max-w-[85%]'
                }`}
                style={{ fontSize: '15px' }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terra-50 border border-terra-200 text-sm">
                🤖
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-cream-200 px-4 py-3">
                <div className="flex gap-1.5 items-center">
                  {[0, 150, 300].map((d) => (
                    <div
                      key={d}
                      className="h-2 w-2 animate-bounce rounded-full bg-ink-400"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Input bar — sticky with safe-area */}
        <div className="border-t border-warm-200 p-3 shrink-0"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              className="flex-1 rounded-xl border border-warm-300 bg-cream-100 px-4 py-2.5 text-ink-900 placeholder:text-ink-400 focus:border-terra-400 focus:outline-none"
              style={{ fontSize: '16px' }}
              placeholder="輸入你的職涯問題... (Enter 送出)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              disabled={loading}
            />
            <Button variant="primary" size="sm" onClick={() => sendMessage()} loading={loading} disabled={!input.trim()}>
              送出
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
