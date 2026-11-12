import { consumeAttempt } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { createAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) {
      return NextResponse.json({ error: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const retryAfter = consumeAttempt(`login:${username.toLowerCase()}`, 10, 15 * 60 * 1000);
    if (retryAfter) return NextResponse.json({ error: '로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429, headers: { 'Retry-After': String(retryAfter) } });

    const user = (await query('SELECT * FROM users WHERE username = $1', [username])).rows[0];

    if (!user) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    if (!user.is_active) {
      return NextResponse.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, { status: 403 });
    }

    const token = createAuthToken({ id: user.id, password: user.password });

    const response = NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: '로그인 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
