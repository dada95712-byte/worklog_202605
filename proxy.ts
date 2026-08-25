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
  ],
}
