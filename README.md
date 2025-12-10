# Court GPT

법원 업무 편의성을 위한 웹서비스

## 프로젝트 개요

Court GPT는 법원 업무를 지원하는 웹 애플리케이션입니다. 운영자로부터 권한을 받은 사용자만 서비스를 이용할 수 있으며, 업무별로 기능을 추가할 수 있는 확장 가능한 구조로 설계되었습니다.

## 주요 기능

### 1. 인증 및 권한 관리
- 회원가입 및 로그인
- 역할 기반 접근 제어 (RBAC)
- 사용자 역할: 관리자(ADMIN), 운영자(OPERATOR), 사용자(USER), 승인 대기(PENDING)
- 세밀한 권한 관리

### 2. 기타집행 업무 (1차 기능)
- 사건 등록 및 관리
- 사건 목록 조회 및 필터링
- 사건 상태 추적 (접수 대기, 진행 중, 완료, 반려, 중지)
- 사건 유형별 관리 (재산조회, 압류, 추심, 기타)

### 3. 관리자 기능
- 사용자 관리
- 권한 승인 및 관리
- 시스템 통계 및 현황

## 기술 스택

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Authentication**: 준비 중 (NextAuth.js 추천)
- **Database**: 준비 중

## 프로젝트 구조

```
courtai/
├── src/
│   ├── app/                      # Next.js App Router 페이지
│   │   ├── auth/                 # 인증 관련 페이지
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── dashboard/            # 대시보드
│   │   ├── misc-execution/       # 기타집행 업무
│   │   │   ├── cases/           # 사건 목록 및 상세
│   │   │   └── statistics/      # 통계 (예정)
│   │   └── admin/               # 관리자 페이지
│   │       └── users/           # 사용자 관리
│   ├── components/              # 재사용 가능한 컴포넌트
│   │   ├── layout/             # 레이아웃 컴포넌트
│   │   ├── ui/                 # UI 컴포넌트
│   │   └── auth/               # 인증 관련 컴포넌트
│   ├── features/               # 기능별 모듈
│   │   ├── auth/               # 인증 기능
│   │   ├── misc-execution/     # 기타집행 기능
│   │   └── admin/              # 관리자 기능
│   ├── lib/                    # 유틸리티 및 라이브러리
│   │   ├── api/                # API 클라이언트
│   │   └── utils/              # 유틸리티 함수
│   ├── types/                  # TypeScript 타입 정의
│   │   ├── auth.ts
│   │   └── misc-execution.ts
│   └── hooks/                  # 커스텀 React Hooks
├── public/                     # 정적 파일
└── package.json
```

## 시작하기

### 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 엽니다.

### 빌드

```bash
npm run build
```

### 프로덕션 서버 실행

```bash
npm start
```

## 페이지 구성

- `/` - 홈 (로그인 페이지로 리다이렉트)
- `/auth/login` - 로그인
- `/auth/signup` - 회원가입
- `/dashboard` - 대시보드
- `/misc-execution` - 기타집행 업무 메인
- `/misc-execution/cases` - 사건 목록
- `/misc-execution/cases/new` - 새 사건 등록
- `/admin/users` - 사용자 관리 (관리자/운영자 전용)

## 권한 체계

### 역할 (Role)
- **ADMIN**: 시스템 최고 관리자
- **OPERATOR**: 사용자 관리 및 권한 부여
- **USER**: 일반 사용자 (승인 후)
- **PENDING**: 승인 대기 중인 사용자

### 권한 (Permission)
- `MISC_EXECUTION_READ`: 기타집행 업무 조회
- `MISC_EXECUTION_WRITE`: 기타집행 업무 생성/수정
- `MISC_EXECUTION_DELETE`: 기타집행 업무 삭제
- `USER_MANAGEMENT`: 사용자 관리
- `SYSTEM_ADMIN`: 시스템 관리

## 향후 계획

- [ ] 백엔드 API 연동
- [ ] 실제 인증 시스템 구현 (NextAuth.js)
- [ ] 데이터베이스 연동
- [ ] 파일 업로드 기능
- [ ] 알림 시스템
- [ ] 사건 상세 페이지
- [ ] 통계 및 리포트 기능
- [ ] 추가 업무 모듈 확장

## 개발 가이드

### 새로운 업무 모듈 추가 시

1. `src/types/`에 타입 정의 생성
2. `src/features/`에 기능 모듈 생성
3. `src/app/`에 페이지 라우트 추가
4. `src/components/layout/Sidebar.tsx`에 네비게이션 항목 추가
5. 필요한 권한 정의를 `src/types/auth.ts`에 추가

## 라이선스

이 프로젝트는 법원 내부용으로 개발되었습니다.

