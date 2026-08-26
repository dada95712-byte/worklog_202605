import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'WorkLog — 工作記錄・職涯累積・求職準備',
  description: '記錄你每天的工作成果，AI 自動整理成技能庫、履歷素材與面試故事，累積成專屬你的職涯資料庫。',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="zh-TW" className={`${geist.variable} h-full antialiased`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-full bg-cream-100 font-sans text-ink-900">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  )
}
