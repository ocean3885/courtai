import { createRouteClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';

const ROLE_PERMISSIONS: Record<'USER' | 'OPERATOR', string[]> = {
  USER: ['MISC_EXECUTION_READ', 'MISC_EXECUTION_WRITE'],
  OPERATOR: ['USER_MANAGEMENT', 'MISC_EXECUTION_READ', 'MISC_EXECUTION_WRITE'],
};

async function requireAdmin(request: NextRequest) {
  const { supabase, response } = createRouteClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errorResponse: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

  if (profileError?.code === '42P17') {
    return {
      errorResponse: NextResponse.json(
        { error: '프로필 RLS 정책을 확인해주세요 (무한 재귀 발생).' },
        { status: 500, headers: response.headers }
      ),
    };
  }

  if (profileError || !profile) {
    return {
      errorResponse: NextResponse.json(
        { error: '프로필을 찾을 수 없습니다.' },
        { status: 404, headers: response.headers }
      ),
    };
  }

  if (profile.role !== 'ADMIN' || !profile.is_active) {
    return {
      errorResponse: NextResponse.json(
        { error: 'ADMIN 권한이 필요합니다.' },
        { status: 403, headers: response.headers }
      ),
    };
  }

  return { supabase, response, user } as const;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;
  const { supabase, response } = auth;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, court, department, position, role, is_active, created_at, last_login_at')
    .order('created_at', { ascending: false });

  if (error?.code === '42P17') {
    return NextResponse.json(
      { error: '프로필 RLS 정책을 확인해주세요 (무한 재귀 발생).' },
      { status: 500, headers: response.headers }
    );
  }

  if (error) {
    return NextResponse.json(
      { error: '사용자 목록을 불러오지 못했습니다.', details: error.message },
      { status: 500, headers: response.headers }
    );
  }

  return NextResponse.json({ users: data ?? [] }, { headers: response.headers });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;
  const { supabase, response } = auth;

  let payload: any;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청 본문입니다.' }, { status: 400 });
  }

  const { userId, role, isActive } = payload as {
    userId?: string;
    role?: 'USER' | 'OPERATOR';
    isActive?: boolean;
  };

  if (!userId || !role || !['USER', 'OPERATOR'].includes(role)) {
    return NextResponse.json(
      { error: 'userId와 role(USER|OPERATOR)이 필요합니다.' },
      { status: 400, headers: response.headers }
    );
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role, is_active: isActive ?? true })
    .eq('id', userId);

  if (updateError?.code === '42P17') {
    return NextResponse.json(
      { error: '프로필 RLS 정책을 확인해주세요 (무한 재귀 발생).' },
      { status: 500, headers: response.headers }
    );
  }

  if (updateError) {
    return NextResponse.json(
      { error: '역할을 업데이트하지 못했습니다.', details: updateError.message },
      { status: 500, headers: response.headers }
    );
  }

  const requiredPermissions = ROLE_PERMISSIONS[role];

  // 필요한 권한 upsert
  const { error: permissionUpsertError } = await supabase
    .from('user_permissions')
    .upsert(requiredPermissions.map((perm) => ({ user_id: userId, permission: perm })));

  if (permissionUpsertError) {
    return NextResponse.json(
      { error: '권한 부여에 실패했습니다.', details: permissionUpsertError.message },
      { status: 500, headers: response.headers }
    );
  }

  // 불필요한 권한 제거 (해당 역할에 없는 권한은 삭제)
  const permsList = requiredPermissions.length
    ? `(${requiredPermissions.map((p) => `'${p}'`).join(',')})`
    : '(NULL)';

  const { error: permissionCleanupError } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId)
    .not('permission', 'in', permsList);

  if (permissionCleanupError) {
    return NextResponse.json(
      { error: '권한 정리 중 오류가 발생했습니다.', details: permissionCleanupError.message },
      { status: 500, headers: response.headers }
    );
  }

  return NextResponse.json({ success: true }, { headers: response.headers });
}
