import { updateSession } from '@/lib/supabase/middleware';
import { NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  // API 라우트는 미들웨어를 건너뜀
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
