import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
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
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const initialAdminUsername = getInitialAdminUsername();
    const users = db.prepare('SELECT id, username, role, created_at FROM users').all() as UserRow[];
    return NextResponse.json({
      users: users.map((user) => ({
        ...user,
        isInitialAdmin: user.username === initialAdminUsername,
      })),
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, role } = await request.json();
    const initialAdminUsername = getInitialAdminUsername();
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as Pick<UserRow, 'username'> | undefined;
    if (user?.username === initialAdminUsername) {
      return NextResponse.json({ error: '초기 관리자 계정의 권한은 변경할 수 없습니다.' }, { status: 400 });
    }

    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    const initialAdminUsername = getInitialAdminUsername();
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as Pick<UserRow, 'username'> | undefined;
    if (user?.username === initialAdminUsername) {
      return NextResponse.json({ error: '초기 관리자 계정은 삭제할 수 없습니다.' }, { status: 400 });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '서버 오류가 발생했습니다.';
}
