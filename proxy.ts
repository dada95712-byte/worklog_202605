import withAuth from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/resume-lab/:path*',
    '/work-journal/:path*',
    '/jobs/:path*',
    '/skill-map/:path*',
    '/interviews/:path*',
    '/career-coach/:path*',
    '/analytics/:path*',
    '/profile-library/:path*',
    // WorkLog 統一為登入後才能使用，登入前的偏好收集頁已移除（見 app/onboarding/page.tsx）
    '/onboarding/:path*',
  ],
}
