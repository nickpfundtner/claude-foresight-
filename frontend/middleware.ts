import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/api/auth/token']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get('foresight_token')?.value
  const role = req.cookies.get('foresight_role')?.value

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  // No token → redirect to login
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Has token + on auth page → redirect by role
  if (token && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(
      new URL(role === 'worker' ? '/training' : '/dashboard', req.url)
    )
  }

  // Worker accessing owner routes → redirect to /training
  if (token && role === 'worker' && !pathname.startsWith('/training') && !pathname.startsWith('/api')) {
    return NextResponse.redirect(new URL('/training', req.url))
  }

  // Owner accessing worker portal → redirect to /dashboard
  if (token && role === 'owner' && pathname.startsWith('/training')) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
