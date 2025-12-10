/**
 * 사용자 역할 정의
 */
export enum UserRole {
  ADMIN = 'ADMIN',           // 관리자 - 모든 권한
  OPERATOR = 'OPERATOR',     // 운영자 - 사용자 관리 및 권한 부여
  USER = 'USER',             // 일반 사용자 - 승인된 기능만 사용
  PENDING = 'PENDING',       // 대기 중 - 승인 대기
}

/**
 * 기능별 권한 정의
 */
export enum Permission {
  // 기타집행 업무 관련
  MISC_EXECUTION_READ = 'MISC_EXECUTION_READ',
  MISC_EXECUTION_WRITE = 'MISC_EXECUTION_WRITE',
  MISC_EXECUTION_DELETE = 'MISC_EXECUTION_DELETE',
  
  // 사용자 관리
  USER_MANAGEMENT = 'USER_MANAGEMENT',
  
  // 시스템 관리
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

/**
 * 사용자 정보 타입
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: Permission[];
  court?: string;             // 소속법원
  department?: string;        // 부서
  position?: string;          // 직급
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;          // 계정 활성화 상태
}

/**
 * 로그인 요청 타입
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * 회원가입 요청 타입
 */
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  court?: string;
  department?: string;
  position?: string;
}

/**
 * 인증 응답 타입
 */
export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

/**
 * 세션 정보 타입
 */
export interface Session {
  user: User;
  expiresAt: Date;
}
