import { createRouteClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { supabase, response } = createRouteClient(request);

    // 현재 로그인한 사용자 정보
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401, headers: response.headers }
      );
    }

    // 프로필 정보 조회 (id 우선, 실패 시 이메일로 한 번 더 조회)
    const { data: profileById, error: profileErrorById } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    let profile = profileById;
    let profileError = profileErrorById;

    if ((!profileById || profileErrorById) && user.email) {
      const { data: profileByEmail, error: profileErrorByEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', user.email)
        .single();
      profile = profileByEmail;
      profileError = profileErrorByEmail;
    }

    if (profileError?.code === '42P17') {
      console.error('Profile policy recursion error:', profileError);
      return NextResponse.json(
        { error: '프로필 RLS 정책을 확인해주세요 (무한 재귀 발생).' },
        { status: 500, headers: response.headers }
      );
    }

    if (profileError || !profile) {
      console.error('Profile lookup failed:', profileError);
      return NextResponse.json(
        { error: '사용자 정보를 찾을 수 없습니다.' },
        { status: 404, headers: response.headers }
      );
    }

    // 권한 조회
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', user.id);

    return NextResponse.json(
      {
        user: {
          ...profile,
          permissions: permissions?.map((p) => p.permission) || [],
        },
      },
      { headers: response.headers }
    );
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: '사용자 정보를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
