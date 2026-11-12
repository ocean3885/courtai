import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isAdminRequest } from '@/lib/auth';
import { getInitialAdminUsername } from '@/lib/env';

type UserRow = {
  id: number;
  username: string;
  role: string;
  created_at: string;
};

async function isAdmin(request: NextRequest) {
  return isAdminRequest(request);
}

export async function GET(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    const initialAdminUsername = getInitialAdminUsername();
    const users = (await query<UserRow>('SELECT id, username, role, created_at FROM users')).rows;
    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        isInitialAdmin: user.username === initialAdminUsername,
      })),
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      return NextResponse.json({ error: '저장된 사건·문서·문의가 있는 계정은 삭제할 수 없습니다. 데이터를 먼저 확인해주세요.' }, { status: 409 });
    }
    console.error('User management failed:', error);
    return NextResponse.json({ error: '사용자 관리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    const { id, role } = await request.json();
    if (!Number.isSafeInteger(id) || id < 1 || !['ADMIN', 'USER'].includes(role)) return NextResponse.json({ error: '사용자 ID 또는 권한이 올바르지 않습니다.' }, { status: 400 });
    const initialAdminUsername = getInitialAdminUsername();
    const user = (await query<Pick<UserRow, 'username'>>('SELECT username FROM users WHERE id = $1', [id])).rows[0];
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    if (user.username === initialAdminUsername) {
      return NextResponse.json({ error: '초기 관리자 계정의 권한은 변경할 수 없습니다.' }, { status: 400 });
    }

    await query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      return NextResponse.json({ error: '저장된 사건·문서·문의가 있는 계정은 삭제할 수 없습니다. 데이터를 먼저 확인해주세요.' }, { status: 409 });
    }
    console.error('User management failed:', error);
    return NextResponse.json({ error: '사용자 관리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!(await isAdmin(request))) return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 });
    const { id } = await request.json();
    if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: '사용자 ID가 올바르지 않습니다.' }, { status: 400 });
    const initialAdminUsername = getInitialAdminUsername();
    const user = (await query<Pick<UserRow, 'username'>>('SELECT username FROM users WHERE id = $1', [id])).rows[0];
    if (!user) return NextResponse.json({ error: '사용자를 찾을 수 없습니다.' }, { status: 404 });
    if (user.username === initialAdminUsername) {
      return NextResponse.json({ error: '초기 관리자 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === '23503') {
      return NextResponse.json({ error: '저장된 사건·문서·문의가 있는 계정은 삭제할 수 없습니다. 데이터를 먼저 확인해주세요.' }, { status: 409 });
    }
    console.error('User management failed:', error);
    return NextResponse.json({ error: '사용자 관리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
