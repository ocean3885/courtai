# Supabase 설정 가이드

Court GPT 프로젝트에서 Supabase를 사용하기 위한 설정 가이드입니다.

## 1. Supabase 프로젝트 생성

1. [Supabase](https://supabase.com)에 접속하여 새 프로젝트 생성
2. 프로젝트 이름과 데이터베이스 비밀번호 설정
3. 지역 선택 (한국의 경우 Northeast Asia (Seoul) 권장)

## 2. 환경 변수 설정

프로젝트의 `.env.local` 파일에 다음 정보를 입력하세요:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**키를 찾는 방법:**
1. Supabase 대시보드에서 프로젝트 선택
2. Settings > API 메뉴로 이동
3. Project URL과 anon public, service_role 키 복사

## 3. 데이터베이스 스키마 생성

1. Supabase 대시보드에서 SQL Editor 메뉴로 이동
2. `supabase/schema.sql` 파일의 내용을 복사하여 붙여넣기
3. Run 버튼 클릭하여 실행

**생성되는 테이블:**
- `profiles`: 사용자 프로필 정보
- `user_permissions`: 사용자 권한
- `misc_execution_cases`: 기타집행 사건

## 4. 인증 설정

### 이메일 인증 설정
1. Authentication > Providers 메뉴로 이동
2. Email 활성화
3. 이메일 확인 설정:
   - "Enable email confirmations" 옵션 확인
   - 개발 중에는 비활성화 가능

### URL 설정
1. Authentication > URL Configuration 메뉴로 이동
2. Site URL: `http://localhost:3000` (개발)
3. Redirect URLs 추가:
   - `http://localhost:3000/auth/callback`
   - 프로덕션 URL (배포 후)

## 5. RLS (Row Level Security) 정책 확인

`schema.sql`에 포함된 RLS 정책:

### profiles 테이블
- ✅ 사용자는 자신의 프로필 조회/수정 가능
- ✅ ADMIN/OPERATOR는 모든 프로필 조회 가능

### user_permissions 테이블
- ✅ 사용자는 자신의 권한 조회 가능
- ✅ ADMIN만 권한 관리 가능

### misc_execution_cases 테이블
- ✅ 활성 사용자는 사건 조회 가능
- ✅ 쓰기 권한이 있는 사용자만 사건 생성/수정
- ✅ 삭제 권한이 있는 사용자만 사건 삭제

## 6. 첫 관리자 계정 생성

데이터베이스에 직접 접근하여 첫 관리자 계정 설정:

```sql
-- 1. 회원가입 후 사용자 ID 확인
SELECT id, email FROM auth.users;

-- 2. 해당 사용자를 ADMIN으로 설정하고 활성화
UPDATE public.profiles
SET role = 'ADMIN', is_active = true
WHERE id = 'user-id-here';

-- 3. ADMIN 권한 부여
INSERT INTO public.user_permissions (user_id, permission)
VALUES 
  ('user-id-here', 'SYSTEM_ADMIN'),
  ('user-id-here', 'USER_MANAGEMENT'),
  ('user-id-here', 'MISC_EXECUTION_READ'),
  ('user-id-here', 'MISC_EXECUTION_WRITE'),
  ('user-id-here', 'MISC_EXECUTION_DELETE');
```

## 7. 테스트

### 회원가입 테스트
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@court.go.kr",
    "password": "password123",
    "name": "테스트사용자",
    "court": "서울중앙지방법원",
    "department": "집행과",
    "position": "주사"
  }'
```

### 로그인 테스트
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@court.go.kr",
    "password": "password123"
  }'
```

## 8. 문제 해결

### 인증 오류
- `.env.local` 파일의 키 확인
- 개발 서버 재시작 (`npm run dev`)

### RLS 정책 오류
- SQL Editor에서 정책이 올바르게 생성되었는지 확인
- 테이블의 RLS가 활성화되어 있는지 확인

### 이메일 전송 오류
- Supabase 무료 플랜은 이메일 전송 제한 있음
- 개발 중에는 이메일 확인 비활성화 권장

## 9. 프로덕션 배포

배포 전 체크리스트:
- [ ] `.env.local` 파일이 `.gitignore`에 포함되어 있는지 확인
- [ ] 프로덕션 환경 변수 설정
- [ ] Site URL과 Redirect URLs를 프로덕션 도메인으로 변경
- [ ] 이메일 확인 활성화
- [ ] RLS 정책 재확인
- [ ] 첫 관리자 계정 생성 완료

## 참고 자료

- [Supabase 문서](https://supabase.com/docs)
- [Supabase Auth 가이드](https://supabase.com/docs/guides/auth)
- [Next.js with Supabase](https://supabase.com/docs/guides/getting-started/tutorials/with-nextjs)
