import { createRouteClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    // 입력 검증
    if (!email || !password) {
      return NextResponse.json(
        { error: '이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const { supabase, response } = createRouteClient(request);

    // 1. 로그인 시도
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      console.error('Login error:', authError);
      
      // 더 자세한 에러 메시지
      let errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      
      if (authError.message.includes('Email not confirmed')) {
        errorMessage = '이메일 인증이 필요합니다. 이메일을 확인해주세요.';
      } else if (authError.message.includes('Invalid login credentials')) {
        errorMessage = '이메일 또는 비밀번호가 올바르지 않습니다.';
      }
      
      return NextResponse.json(
        { error: errorMessage, details: authError.message },
        { status: 401, headers: response.headers }
      );
    }

    // 2. 사용자 프로필 조회 (id로 조회, 실패 시 이메일로 한 번 더 조회)
    const { data: profileById, error: profileErrorById } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    let profile = profileById;
    let profileError = profileErrorById;

    if ((!profileById || profileErrorById) && authData.user.email) {
      const { data: profileByEmail, error: profileErrorByEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', authData.user.email)
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

    // 3. 계정 활성화 및 역할 확인
    if (!profile.is_active || profile.role === 'PENDING') {
      // 로그아웃 처리
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: '계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 403, headers: response.headers }
      );
    }

    // 4. 마지막 로그인 시간 업데이트
    await supabase
      .from('profiles')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', authData.user.id);

    // 5. 사용자 권한 조회
    const { data: permissions } = await supabase
      .from('user_permissions')
      .select('permission')
      .eq('user_id', authData.user.id);

    return NextResponse.json(
      {
        message: '로그인 성공',
        user: {
          ...profile,
          permissions: permissions?.map((p) => p.permission) || [],
        },
      },
      { headers: response.headers }
    );
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: '로그인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
