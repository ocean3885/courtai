import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password, name } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
    }

    // 아이디 중복 확인
    const existingUser = (await query('SELECT id FROM users WHERE username = $1', [username])).rows[0];
    if (existingUser) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await query<{ id: string }>(`
      INSERT INTO users (username, password, name, role, is_active)
      VALUES ($1, $2, $3, 'USER', 1)
      RETURNING id
    `, [username, hashedPassword, name || username]);

    return NextResponse.json({ success: true, userId: result.rows[0].id });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: '회원가입 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
