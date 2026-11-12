# 배포 및 환경설정

이 서비스는 Next.js와 `pg`를 사용합니다. 현재 Python 실행이나 AI API 호출은 없습니다.

## DB 준비

Supabase SQL Editor 또는 마이그레이션 도구에서 아래 SQL을 한 번 적용합니다.

```
supabase/migrations/202607180001_create_courtai_schema.sql
```

기본 스키마는 `courtai`입니다. `DATABASE_SCHEMA`를 변경한다면 마이그레이션의 스키마명도 일치시켜야 합니다. `AUTO_CREATE_DB_SCHEMA`는 사용자 테이블만 생성하는 개발용 옵션이므로 전체 마이그레이션을 대체하지 않습니다.

## 환경변수

```env
DATABASE_URL=postgresql://postgres:[password]@[host]:5432/postgres
DATABASE_SCHEMA=courtai
DATABASE_SSL=true
AUTO_CREATE_DB_SCHEMA=false
JWT_SECRET=replace_with_a_long_random_secret
ADMIN_USERNAME=replace_with_admin_username
ADMIN_PASSWORD=replace_with_strong_admin_password
ADMIN_NAME=운영자
```

필수 항목은 `DATABASE_URL`, `JWT_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`입니다. DB 접속 문자열은 서버 측에만 설정하고 채팅이나 저장소에 비밀값을 올리지 마세요. Supabase에서는 배포 환경의 IPv4/IPv6 연결 지원에 맞는 직접 연결 또는 세션 풀러 주소를 사용하세요. 코드가 트랜잭션과 `SET LOCAL search_path`를 사용합니다.

초기 관리자 비밀번호는 최초 계정 생성에만 쓰입니다. 이후에는 서비스에서 비밀번호를 변경하세요. 기존 계정을 유지한 채 환경변수만 변경해도 비밀번호나 역할은 변경되지 않습니다. 비밀번호를 분실한 경우 별도의 관리자 복구 절차가 필요합니다.

## 실행

Node.js 20.9 이상에서 실행합니다.

```bash
npm ci
npm test
npm run lint
npm run build
npm start
```

Vercel에서도 동일한 환경변수를 설정하고 DB 마이그레이션 적용 후 배포할 수 있습니다. `npm run build`는 DB 접속 성공을 검증하지 않습니다.

## 이번 업데이트 적용 시

- 추가 DB 스키마 변경은 없습니다. 기존 `html_preview` 열에 두 문서의 HTML을 버전이 있는 JSON으로 저장합니다. 이를 직접 읽는 외부 도구가 있다면 변경된 형식을 반영해야 합니다.
- 기존 로그인 토큰은 무효화됩니다. 배포 후 다시 로그인하세요.
- 새 문서는 생성 당시 결과를 보존합니다. 과거 문서의 HTML이 저장되어 있지 않다면 그 당시 결과를 복원할 수 없어 현재 계산식으로 표시합니다.
- 비밀번호는 8자 이상, bcrypt 제한에 맞춰 UTF-8 72바이트 이하로 설정합니다. 기존 짧은 비밀번호 계정은 로그인할 수 있지만 변경 시 새 기준을 적용합니다.
- 로그인 시도 제한은 인스턴스별 메모리를 사용합니다. 여러 인스턴스 또는 서버리스에서는 게이트웨이/공유 저장소 제한을 함께 구성하세요.
- 사건 저장·문서 생성·다른 계정 접근 차단·권한 회수·인쇄는 테스트 DB와 실제 배포 환경에서 확인하세요.
