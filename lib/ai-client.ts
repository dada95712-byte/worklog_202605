import OpenAI from 'openai'

const FREE_MODEL     = 'openrouter/free'
const FALLBACK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free'

export const VISION_MODEL = 'meta-llama/llama-3.2-11b-vision-instruct:free'

const DEFAULT_SYSTEM = '你是一個專業的台灣職涯顧問，請用繁體中文回答。'

// ── Concurrent request limiter ────────────────────────────────────────────────
// Prevents flooding OpenRouter when multiple pages trigger AI calls at once.

const MAX_CONCURRENT = 2
let activeRequests = 0
const waitQueue: Array<() => void> = []

function acquireSlot(): Promise<void> {
  if (activeRequests < MAX_CONCURRENT) {
    activeRequests++
    return Promise.resolve()
  }
  return new Promise<void>(resolve => waitQueue.push(resolve))
}

function releaseSlot() {
  const next = waitQueue.shift()
  if (next) {
    // Pass the freed slot directly to the next waiter (no net change to activeRequests)
    next()
  } else {
    activeRequests--
  }
}

// ── Lazy singleton ────────────────────────────────────────────────────────────

let _client: OpenAI | null = null
function getClient(): OpenAI {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  if (!_client) {
    // openai SDK 預設沒設 timeout 會等到 10 分鐘，免費模型偶爾會掛住不回應，
    // 導致整個 serverless function 撞到平台自己的執行時間上限被砍斷（504），
    // complete() 的 429 重試/fallback 邏輯完全來不及介入。明確設短一點的
    // timeout 讓卡住的呼叫快速失敗、把機會讓給下一次重試或備援模型。
    // maxRetries 設 0 是因為 complete() 已經自己做 429 重試，避免兩層重試疊加
    // 讓總等待時間更難預期。
    _client = new OpenAI({ apiKey: key, baseURL: 'https://openrouter.ai/api/v1', timeout: 15000, maxRetries: 0 })
  }
  return _client
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ── Rate-limit error marker ───────────────────────────────────────────────────

export function isRateLimitError(err: unknown): boolean {
  const e = err as { status?: number; message?: string }
  return e.status === 429 || Boolean(e.message?.startsWith('rate_limit:'))
}

function makeRateLimitError(model: string, retries: number): Error {
  return Object.assign(
    new Error(`rate_limit: ${model} 在 ${retries} 次重試後仍返回 429`),
    { status: 429 }
  )
}

// ── Internal: single completion with 429 retry + exponential backoff ──────────

async function complete(
  model: string,
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  maxRetries = 3
): Promise<string> {
  let lastErr: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await getClient().chat.completions.create({ model, messages })
      const content = res?.choices?.[0]?.message?.content
      if (!content) {
        console.warn(`[AI] ${model} returned unexpected format:`, JSON.stringify(res))
        throw new Error('AI 回應格式異常')
      }
      return content
    } catch (err) {
      const e = err as { status?: number; message?: string }
      if (e.status === 429) {
        // Exponential backoff: 1s, 2s, 4s (+ jitter)
        const waitMs = Math.pow(2, attempt) * 1000 + Math.random() * 500
        console.warn(`[AI] ${model} 429 rate limit，等待 ${Math.round(waitMs)}ms（第 ${attempt + 1}/${maxRetries} 次）`)
        await sleep(waitMs)
        lastErr = err
        continue
      }
      // Non-429: rethrow immediately (no retry)
      throw err
    }
  }
  throw makeRateLimitError(model, maxRetries)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Single-turn AI call with retry, fallback model, and concurrent-request queue.
 * Throws a rate_limit error (status 429) if all retries are exhausted.
 */
export async function callAI(prompt: string, systemPrompt?: string): Promise<string> {
  await acquireSlot()
  try {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt ?? DEFAULT_SYSTEM },
      { role: 'user',   content: prompt },
    ]
    try {
      return await complete(FREE_MODEL, messages)
    } catch (err) {
      if (isRateLimitError(err)) throw err  // propagate — don't try fallback after 429
      const e = err as { status?: number; message?: string }
      console.warn(`[AI] ${FREE_MODEL} failed (${e.status ?? 'unknown'}): ${e.message ?? ''}`)
    }
    try {
      return await complete(FALLBACK_MODEL, messages)
    } catch (err) {
      if (isRateLimitError(err)) throw err
      const e = err as { status?: number; message?: string }
      console.error(`[AI] ${FALLBACK_MODEL} also failed: ${e.status ?? ''} ${e.message ?? ''}`)
      throw new Error('所有 AI 服務目前無法使用，請稍後再試')
    }
  } finally {
    releaseSlot()
  }
}

/**
 * Multi-turn chat call with the same retry + queue behaviour.
 */
export async function callAIChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt?: string
): Promise<string> {
  if (messages.length === 0) throw new Error('messages 不得為空')
  await acquireSlot()
  try {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt ?? DEFAULT_SYSTEM },
      ...messages,
    ]
    try {
      return await complete(FREE_MODEL, openaiMessages)
    } catch (err) {
      if (isRateLimitError(err)) throw err
      const e = err as { status?: number; message?: string }
      console.warn(`[AI] ${FREE_MODEL} failed: ${e.status ?? ''} ${e.message ?? ''}`)
    }
    try {
      return await complete(FALLBACK_MODEL, openaiMessages)
    } catch (err) {
      if (isRateLimitError(err)) throw err
      const e = err as { status?: number; message?: string }
      console.error(`[AI] ${FALLBACK_MODEL} also failed: ${e.status ?? ''} ${e.message ?? ''}`)
      throw new Error('所有 AI 服務目前無法使用，請稍後再試')
    }
  } finally {
    releaseSlot()
  }
}
