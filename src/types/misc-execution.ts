/**
 * 기타집행 업무 관련 타입 정의
 */

/**
 * 기타집행 사건 상태
 */
export enum MiscExecutionStatus {
  PENDING = 'PENDING',           // 접수 대기
  IN_PROGRESS = 'IN_PROGRESS',   // 진행 중
  COMPLETED = 'COMPLETED',       // 완료
  REJECTED = 'REJECTED',         // 반려
  SUSPENDED = 'SUSPENDED',       // 중지
}

/**
 * 기타집행 사건 타입
 */
export enum MiscExecutionType {
  PROPERTY_INQUIRY = 'PROPERTY_INQUIRY',         // 재산조회
  SEIZURE = 'SEIZURE',                           // 압류
  COLLECTION = 'COLLECTION',                     // 추심
  OTHERS = 'OTHERS',                             // 기타
}

/**
 * 기타집행 사건 정보
 */
export interface MiscExecutionCase {
  id: string;
  caseNumber: string;              // 사건번호
  title: string;                   // 사건명
  type: MiscExecutionType;         // 사건 유형
  status: MiscExecutionStatus;     // 상태
  plaintiff: string;               // 채권자
  defendant: string;               // 채무자
  amount?: number;                 // 청구금액
  description?: string;            // 사건 설명
  createdBy: string;               // 생성자 ID
  assignedTo?: string;             // 담당자 ID
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * 기타집행 사건 생성 요청
 */
export interface CreateMiscExecutionCaseRequest {
  caseNumber: string;
  title: string;
  type: MiscExecutionType;
  plaintiff: string;
  defendant: string;
  amount?: number;
  description?: string;
  assignedTo?: string;
}

/**
 * 기타집행 사건 수정 요청
 */
export interface UpdateMiscExecutionCaseRequest {
  title?: string;
  status?: MiscExecutionStatus;
  plaintiff?: string;
  defendant?: string;
  amount?: number;
  description?: string;
  assignedTo?: string;
}

/**
 * 기타집행 사건 목록 필터
 */
export interface MiscExecutionCaseFilter {
  status?: MiscExecutionStatus;
  type?: MiscExecutionType;
  assignedTo?: string;
  searchTerm?: string;             // 사건번호, 제목, 당사자명 검색
  dateFrom?: Date;
  dateTo?: Date;
}
