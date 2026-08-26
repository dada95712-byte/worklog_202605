'use client'

import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  Configuration: '伺服器設定有誤，請聯絡管理員',
  AccessDenied: '你取消了 Google 授權，或此帳號不在允許登入的名單中',
  OAuthSignin: 'Google 登入發生錯誤，請再試一次',
  OAuthCallback: 'Google 登入發生錯誤，請再試一次',
  OAuthCreateAccount: '建立帳號時發生錯誤，請再試一次',
  OAuthAccountNotLinked: '這個 Email 已用其他方式註冊過，請改用原本的登入方式',
  Default: '登入失敗，請再試一次',
}

function SignInForm() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [oauthError, setOauthError] = useState('')

  useEffect(() => { if (session) router.push(callbackUrl) }, [session, router, callbackUrl])

  useEffect(() => {
    const code = searchParams.get('error')
    if (code) setOauthError(GOOGLE_ERROR_MESSAGES[code] ?? GOOGLE_ERROR_MESSAGES.Default)
  }, [searchParams])

  async function handleGoogle() {
    setGoogleLoading(true); setOauthError('')
    await signIn('google', { callbackUrl })
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('請輸入電子郵件'); return }
    setLoading(true); setError('')
    const res = await signIn('credentials', { email, name, redirect: false, callbackUrl })
    setLoading(false)
    if (res?.error) setError('登入失敗，請再試一次')
    else router.push(callbackUrl)
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-cream-100 px-4 py-8"
      style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>
      <div className="w-full max-w-sm">
        {/* Logo above card — centered */}
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-terra-500 text-white font-bold text-base shadow-[var(--shadow-warm-md)]">
            W
          </div>
          <h1 className="text-xl font-bold text-ink-900">WorkLog</h1>
          <p className="mt-1 text-sm text-ink-400">工作記錄・職涯累積・求職準備</p>
        </div>

        <div className="rounded-2xl border border-warm-200 bg-white p-6 md:p-8"
          style={{ boxShadow: 'var(--shadow-warm-lg)' }}>

          {oauthError && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {oauthError}
            </div>
          )}

          {/* Google OAuth */}
          <Button
            variant="secondary"
            className="w-full mb-4"
            style={{ height: '52px', fontSize: '15px' }}
            onClick={handleGoogle}
            loading={googleLoading}
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            使用 Google 帳號登入
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-warm-200" />
            <span className="text-xs text-ink-300">或用 Email</span>
            <div className="h-px flex-1 bg-warm-200" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <Input id="name" label="姓名" placeholder="你的姓名" value={name} onChange={(e) => setName(e.target.value)} />
            <Input id="email" type="email" label="電子郵件" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
            <Button type="submit" className="w-full" loading={loading}>繼續</Button>
          </form>

          <p className="mt-5 text-center text-xs text-ink-300">
            登入即同意使用條款與隱私政策
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-ink-300">
          還沒有帳號？直接輸入 Email 即可立即建立
        </p>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return <Suspense><SignInForm /></Suspense>
}
