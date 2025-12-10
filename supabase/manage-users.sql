-- 여러 사용자의 역할과 권한을 일괄 설정하는 스크립트

-- =====================================================
-- 운영자(OPERATOR) 설정
-- =====================================================
-- 사용법: 이메일을 실제 값으로 변경 후 실행

DO $$
DECLARE
  operator_email TEXT := 'operator@court.go.kr';  -- ← 여기를 실제 이메일로 변경
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM public.profiles WHERE email = operator_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION '이메일 %에 해당하는 사용자를 찾을 수 없습니다.', operator_email;
  END IF;

  -- OPERATOR 역할 설정 및 활성화
  UPDATE public.profiles
  SET role = 'OPERATOR', is_active = true
  WHERE id = user_id;

  -- OPERATOR 권한 부여
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES 
    (user_id, 'USER_MANAGEMENT'),
    (user_id, 'MISC_EXECUTION_READ'),
    (user_id, 'MISC_EXECUTION_WRITE')
  ON CONFLICT (user_id, permission) DO NOTHING;

  RAISE NOTICE '운영자 계정 설정 완료: %', operator_email;
END $$;


-- =====================================================
-- 일반 사용자(USER) 승인 및 권한 부여
-- =====================================================
-- 사용법: 이메일을 실제 값으로 변경 후 실행

DO $$
DECLARE
  user_email TEXT := 'user@court.go.kr';  -- ← 여기를 실제 이메일로 변경
  user_id UUID;
BEGIN
  SELECT id INTO user_id FROM public.profiles WHERE email = user_email;
  
  IF user_id IS NULL THEN
    RAISE EXCEPTION '이메일 %에 해당하는 사용자를 찾을 수 없습니다.', user_email;
  END IF;

  -- USER 역할 설정 및 활성화
  UPDATE public.profiles
  SET role = 'USER', is_active = true
  WHERE id = user_id;

  -- 기본 권한 부여
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES 
    (user_id, 'MISC_EXECUTION_READ'),
    (user_id, 'MISC_EXECUTION_WRITE')
  ON CONFLICT (user_id, permission) DO NOTHING;

  RAISE NOTICE '사용자 승인 완료: %', user_email;
END $$;


-- =====================================================
-- 승인 대기 중인 사용자 목록 조회
-- =====================================================
SELECT 
  email,
  name,
  court,
  department,
  position,
  role,
  created_at
FROM public.profiles
WHERE role = 'PENDING'
ORDER BY created_at DESC;


-- =====================================================
-- 모든 사용자 현황 조회
-- =====================================================
SELECT 
  p.email,
  p.name,
  p.court,
  p.role,
  p.is_active,
  array_agg(DISTINCT up.permission ORDER BY up.permission) FILTER (WHERE up.permission IS NOT NULL) as permissions,
  p.created_at,
  p.last_login_at
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
GROUP BY p.id, p.email, p.name, p.court, p.role, p.is_active, p.created_at, p.last_login_at
ORDER BY p.created_at DESC;
