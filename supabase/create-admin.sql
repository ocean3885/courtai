-- 초기 관리자 계정 설정 스크립트
-- 사용법: 이메일 주소를 실제 값으로 변경한 후 실행

-- =====================================================
-- 1단계: 설정할 이메일 주소 (여기를 수정하세요)
-- =====================================================
DO $$
DECLARE
  admin_email TEXT := 'ocean3885@court.go.kr';  -- ← 여기를 실제 이메일로 변경
  user_id UUID;
BEGIN
  -- 사용자 ID 조회
  SELECT id INTO user_id
  FROM public.profiles
  WHERE email = admin_email;

  -- 사용자가 존재하지 않으면 오류 메시지
  IF user_id IS NULL THEN
    RAISE EXCEPTION '이메일 %에 해당하는 사용자를 찾을 수 없습니다. 먼저 회원가입을 진행하세요.', admin_email;
  END IF;

  -- ADMIN 역할 설정 및 계정 활성화
  UPDATE public.profiles
  SET 
    role = 'ADMIN',
    is_active = true
  WHERE id = user_id;

  RAISE NOTICE '사용자 %를 ADMIN으로 설정했습니다.', admin_email;

  -- 모든 권한 부여
  INSERT INTO public.user_permissions (user_id, permission)
  VALUES 
    (user_id, 'SYSTEM_ADMIN'),
    (user_id, 'USER_MANAGEMENT'),
    (user_id, 'MISC_EXECUTION_READ'),
    (user_id, 'MISC_EXECUTION_WRITE'),
    (user_id, 'MISC_EXECUTION_DELETE')
  ON CONFLICT (user_id, permission) DO NOTHING;

  RAISE NOTICE '모든 권한을 부여했습니다.';

  -- 결과 출력
  RAISE NOTICE '====================================';
  RAISE NOTICE '초기 관리자 계정 설정 완료!';
  RAISE NOTICE '====================================';
  RAISE NOTICE '이메일: %', admin_email;
  RAISE NOTICE '역할: ADMIN';
  RAISE NOTICE '상태: 활성화';
  RAISE NOTICE '====================================';
END $$;

-- 설정 확인
SELECT 
  p.email,
  p.name,
  p.court,
  p.department,
  p.position,
  p.role,
  p.is_active,
  array_agg(up.permission ORDER BY up.permission) as permissions
FROM public.profiles p
LEFT JOIN public.user_permissions up ON p.id = up.user_id
WHERE p.role = 'ADMIN'
GROUP BY p.id, p.email, p.name, p.court, p.department, p.position, p.role, p.is_active;
