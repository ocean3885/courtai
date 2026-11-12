import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    const user = await getUserFromRequest(request);
    return NextResponse.json({ user });
  } catch (error) {
    console.error('Session lookup failed:', error);
    return NextResponse.json({ error: '로그인 상태를 확인하지 못했습니다.' }, { status: 503 });
  }
}
