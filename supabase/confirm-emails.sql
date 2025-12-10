-- 이메일 확인이 안 된 사용자의 이메일을 수동으로 확인 처리

-- 1. 확인이 필요한 사용자 조회
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
WHERE email_confirmed_at IS NULL;

-- 2. 특정 사용자의 이메일 확인 처리
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'your-email@court.go.kr'  -- 실제 이메일로 변경
  AND email_confirmed_at IS NULL;

-- 3. 모든 사용자의 이메일 확인 처리 (개발 환경용)
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  updated_at = NOW()
WHERE email_confirmed_at IS NULL;

-- 4. 확인
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users
ORDER BY created_at DESC;
