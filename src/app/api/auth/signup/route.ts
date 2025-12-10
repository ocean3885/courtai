import { createRouteClient } from '@/lib/supabase/route';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, court, department, position } = await request.json();

    // 입력 검증
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: '필수 항목을 입력해주세요.' },
        { status: 400 }
      );
    }

    const { supabase, response } = createRouteClient(request);

    // 1. Supabase Auth로 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          court,
          department,
          position,
        },
      },
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400, headers: response.headers }
      );
    }

    // 2. profiles 테이블 업서트 (없으면 생성, 있으면 추가 정보 업데이트)
    if (authData.user) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: authData.user.id,
        email: authData.user.email,
        name,
        court,
        department,
        position,
        role: 'PENDING',
        is_active: false,
      });

      if (profileError) {
        console.error('Profile upsert error:', profileError);
      }
    }

    return NextResponse.json(
      {
        message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
        user: authData.user,
      },
      { headers: response.headers }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
