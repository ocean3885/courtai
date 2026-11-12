import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password, name } = await request.json();

    if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,50}$/.test(username) || typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72 || (name !== undefined && (typeof name !== 'string' || name.length > 100))) {
      return NextResponse.json({ error: '아이디는 영문·숫자·_.- 3~50자, 비밀번호는 8자 이상(UTF-8 72바이트 이하)이어야 합니다.' }, { status: 400 });
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
