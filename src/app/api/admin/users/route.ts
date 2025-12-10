import { createRouteClient } from '@/lib/supabase/route';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const ROLE_PERMISSIONS: Record<'USER' | 'OPERATOR', string[]> = {
  USER: ['MISC_EXECUTION_READ', 'MISC_EXECUTION_WRITE'],
  OPERATOR: ['USER_MANAGEMENT', 'MISC_EXECUTION_READ', 'MISC_EXECUTION_WRITE'],
};

// Admin 권한 확인 및 Service Role 클라이언트 반환
async function getAdminClient(request: NextRequest) {
  const { supabase, response } = createRouteClient(request);

  // 1. 현재 로그인한 사용자 확인 (쿠키 기반)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { errorResponse: NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 }) };
  }

  // 2. Service Role 클라이언트 생성 (RLS 우회)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 3. 실제 DB에서 유저 권한 확인 (Service Role 사용)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single();

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

  return { supabaseAdmin, response, user } as const;
}

export async function GET(request: NextRequest) {
  const adminContext = await getAdminClient(request);
  if ('errorResponse' in adminContext) return adminContext.errorResponse;
  const { supabaseAdmin, response } = adminContext;

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, court, department, position, role, is_active, created_at, last_login_at')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: '사용자 목록을 불러오지 못했습니다.', details: error.message },
      { status: 500, headers: response.headers }
    );
  }

  return NextResponse.json({ users: data ?? [] }, { headers: response.headers });
}

export async function PATCH(request: NextRequest) {
  const adminContext = await getAdminClient(request);
  if ('errorResponse' in adminContext) return adminContext.errorResponse;
  const { supabaseAdmin, response } = adminContext;

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

  // 1. 프로필 업데이트
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ role, is_active: isActive ?? true })
    .eq('id', userId);

  if (updateError) {
    return NextResponse.json(
      { error: '역할을 업데이트하지 못했습니다.', details: updateError.message },
      { status: 500, headers: response.headers }
    );
  }

  // 2. Supabase Auth 메타데이터 업데이트 (선택 사항이지만 권장됨)
  // supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { role } });

  const requiredPermissions = ROLE_PERMISSIONS[role];

  // 3. 권한 부여 (upsert)
  const { error: permissionUpsertError } = await supabaseAdmin
    .from('user_permissions')
    .upsert(requiredPermissions.map((perm) => ({ user_id: userId, permission: perm })));

  if (permissionUpsertError) {
    return NextResponse.json(
      { error: '권한 부여에 실패했습니다.', details: permissionUpsertError.message },
      { status: 500, headers: response.headers }
    );
  }

  // 4. 불필요한 권한 제거
  const permsList = requiredPermissions.length
    ? `(${requiredPermissions.map((p) => `'${p}'`).join(',')})`
    : '(NULL)';

  const { error: permissionCleanupError } = await supabaseAdmin
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
