-- Court GPT 데이터베이스 스키마
-- Supabase SQL Editor에서 실행하세요

-- 1. profiles 테이블 생성 (auth.users를 확장)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  court TEXT,
  department TEXT,
  position TEXT,
  role TEXT NOT NULL DEFAULT 'PENDING' CHECK (role IN ('ADMIN', 'OPERATOR', 'USER', 'PENDING')),
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

-- 2. 권한 테이블
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission TEXT NOT NULL CHECK (permission IN (
    'MISC_EXECUTION_READ',
    'MISC_EXECUTION_WRITE',
    'MISC_EXECUTION_DELETE',
    'USER_MANAGEMENT',
    'SYSTEM_ADMIN'
  )),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- 3. 기타집행 사건 테이블
CREATE TABLE IF NOT EXISTS public.misc_execution_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  case_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('PROPERTY_INQUIRY', 'SEIZURE', 'COLLECTION', 'OTHERS')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'SUSPENDED')),
  plaintiff TEXT NOT NULL,
  defendant TEXT NOT NULL,
  amount BIGINT,
  description TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 4. RLS (Row Level Security) 정책 활성화
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.misc_execution_cases ENABLE ROW LEVEL SECURITY;

-- 5. profiles 테이블 RLS 정책
-- 모든 사용자가 자신의 프로필을 볼 수 있음
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 사용자가 자신의 프로필을 업데이트할 수 있음
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ADMIN과 OPERATOR는 모든 프로필을 볼 수 있음
CREATE POLICY "Admins and operators can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'OPERATOR')
    )
  );

-- 6. user_permissions 테이블 RLS 정책
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all permissions" ON public.user_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 7. misc_execution_cases 테이블 RLS 정책
-- 활성 사용자는 사건을 조회할 수 있음
CREATE POLICY "Active users can view cases" ON public.misc_execution_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_active = true
    )
  );

-- 권한이 있는 사용자는 사건을 생성할 수 있음
CREATE POLICY "Users with write permission can create cases" ON public.misc_execution_cases
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND permission IN ('MISC_EXECUTION_WRITE', 'SYSTEM_ADMIN')
    )
  );

-- 권한이 있는 사용자는 사건을 수정할 수 있음
CREATE POLICY "Users with write permission can update cases" ON public.misc_execution_cases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND permission IN ('MISC_EXECUTION_WRITE', 'SYSTEM_ADMIN')
    )
  );

-- 권한이 있는 사용자는 사건을 삭제할 수 있음
CREATE POLICY "Users with delete permission can delete cases" ON public.misc_execution_cases
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND permission IN ('MISC_EXECUTION_DELETE', 'SYSTEM_ADMIN')
    )
  );

-- 8. 함수: 회원가입 시 자동으로 profile 생성
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Unknown')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. 트리거: 새 사용자 생성 시 profile 자동 생성
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 10. 함수: updated_at 자동 업데이트
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 11. 트리거: profiles updated_at 자동 업데이트
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
CREATE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 12. 트리거: misc_execution_cases updated_at 자동 업데이트
DROP TRIGGER IF EXISTS on_case_updated ON public.misc_execution_cases;
CREATE TRIGGER on_case_updated
  BEFORE UPDATE ON public.misc_execution_cases
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 13. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON public.user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.misc_execution_cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_created_by ON public.misc_execution_cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_assigned_to ON public.misc_execution_cases(assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_case_number ON public.misc_execution_cases(case_number);
