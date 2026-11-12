// 두 JSON 객체를 비교하여 변경사항을 텍스트로 반환하는 유틸리티

interface DiffResult {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  type: 'added' | 'modified' | 'deleted';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(없음)';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  if (typeof value === 'number') return value.toLocaleString('ko-KR');
  
  // 특정 값들의 한국어 변환
  const valueMap: Record<string, string> = {
    'wage': '급여소득자',
    'business': '영업소득자',
    'yes': '있음',
    'no': '없음',
  };
  
  if (typeof value === 'string' && valueMap[value]) {
    return valueMap[value];
  }
  
  return String(value);
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    // DebtorInfo
    'debtorInfo.name': '채무자 이름',
    'debtorInfo.birthDate': '생년월일',
    'debtorInfo.address': '주소',
    'debtorInfo.phone': '전화번호',
    'debtorInfo.court': '관할법원',
    
    // RepaymentPlan
    'repaymentPlan.companyName': '근무(운영)업체명',
    'repaymentPlan.repaymentPeriod.startDate': '변제시작일',
    'repaymentPlan.repaymentPeriod.endDate': '변제종료일',
    'repaymentPlan.repaymentPeriod.months': '변제기간(개월)',
    'repaymentPlan.incomeType': '수입형태',
    'repaymentPlan.monthlyAverageIncome': '월평균수입',
    'repaymentPlan.monthlyAverageLivingCost': '월평균생계비',
    'repaymentPlan.otherEstateClaims': '기타재단채권',
    'repaymentPlan.dependentsCount': '피부양자수',
    'repaymentPlan.standardMedianIncome': '기준중위소득',
    'repaymentPlan.trusteeFee.preConfirmation': '회생위원보수(인가전)',
    'repaymentPlan.trusteeFee.postConfirmationRate': '회생위원보수(인가후)',
    'repaymentPlan.liquidationValue': '청산가치',
    'repaymentPlan.seizedReservesStatus': '압류적립금 여부',
    'repaymentPlan.seizedReservesAmount': '압류적립액',
    'repaymentPlan.createDate': '작성일',
    
    // Creditors
    'creditors': '채권자 목록',
  };
  
  // 채권자 개별 필드 매칭
  if (field.includes('creditors[')) {
    const fieldMatch = field.match(/creditors\[([^\]]+)\]\.(.+)/);
    if (fieldMatch) {
      const [, number, subField] = fieldMatch;
      const subLabels: Record<string, string> = {
        'name': '채권자명',
        'reason': '발생원인',
        'principal': '원금',
        'interest': '이자',
        'address': '주소',
        'phone': '전화번호',
        'fax': '팩스',
        'interestRate': '이자율',
        'interestStartDate': '이자기산일',
        'baseDate': '기준일자',
        'isPreferential': '우선변제권',
        'isSubrogated': '구상채권',
        'isSecured': '별제권부채권',
      };
      return `채권자[${number}] ${subLabels[subField] || subField}`;
    }
    return field.replace('creditors', '채권자');
  }
  
  return labels[field] || field;
}

function compareObjects(
  oldObj: unknown,
  newObj: unknown,
  path: string = '',
  diffs: DiffResult[] = []
): DiffResult[] {
  if (Object.is(oldObj, newObj)) return diffs;
  const ignoredPaths = ['repaymentSchedule', 'totalsByCreditor', 'calculatedValues', 'calculationVersion'];
  if (ignoredPaths.some(ignored => path === ignored)) return diffs;
  if (Array.isArray(oldObj) && Array.isArray(newObj)) {
    const identified = (items: unknown[]): items is Record<string, unknown>[] => items.every(item =>
      item !== null && typeof item === 'object' && 'id' in item);
    if (identified(oldObj) && identified(newObj)) {
      const oldMap = new Map(oldObj.map(item => [item.id, item]));
      const newMap = new Map(newObj.map(item => [item.id, item]));
      for (const item of newObj) compareObjects(oldMap.get(item.id), item, `${path}[${item.number ?? item.id}]`, diffs);
      for (const item of oldObj) if (!newMap.has(item.id)) compareObjects(item, undefined, `${path}[${item.number ?? item.id}]`, diffs);
    } else {
      for (let i = 0; i < Math.max(oldObj.length, newObj.length); i++) compareObjects(oldObj[i], newObj[i], `${path}[${i}]`, diffs);
    }
  } else if (oldObj !== null && newObj !== null && typeof oldObj === 'object' && typeof newObj === 'object') {
    const oldRecord = oldObj as Record<string, unknown>, newRecord = newObj as Record<string, unknown>;
    for (const key of new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])) {
      compareObjects(oldRecord[key], newRecord[key], path ? `${path}.${key}` : key, diffs);
    }
  } else {
    diffs.push({ field: path, oldValue: oldObj, newValue: newObj,
      type: oldObj === undefined ? 'added' : newObj === undefined ? 'deleted' : 'modified' });
  }

  return diffs;
}

export function generateChangeLog(oldSnapshot: unknown, newSnapshot: unknown): string {
  try {
    const oldData = typeof oldSnapshot === 'string' ? JSON.parse(oldSnapshot) : oldSnapshot;
    const newData = typeof newSnapshot === 'string' ? JSON.parse(newSnapshot) : newSnapshot;
    
    const diffs = compareObjects(oldData, newData);
    
    if (diffs.length === 0) {
      return '변경사항 없음';
    }
    
    const now = new Date();
    const timestamp = now.toLocaleString('ko-KR', { 
      timeZone: 'Asia/Seoul',
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    let changeLog = `[${timestamp}] 변경사항:\n\n`;
    
    diffs.forEach((diff, index) => {
      const label = getFieldLabel(diff.field);
      
      if (diff.type === 'added') {
        changeLog += `${index + 1}. ${label} 추가\n`;
        changeLog += `   - 새 값: ${formatValue(diff.newValue)}\n\n`;
      } else if (diff.type === 'deleted') {
        changeLog += `${index + 1}. ${label} 삭제\n`;
        changeLog += `   - 이전 값: ${formatValue(diff.oldValue)}\n\n`;
      } else if (diff.type === 'modified') {
        changeLog += `${index + 1}. ${label} 수정\n`;
        changeLog += `   - 이전: ${formatValue(diff.oldValue)}\n`;
        changeLog += `   - 변경: ${formatValue(diff.newValue)}\n\n`;
      }
    });
    
    return changeLog;
  } catch (error) {
    console.error('Failed to generate change log:', error);
    return '변경사항 분석 실패';
  }
}

export function compareSnapshots(oldSnapshot: unknown, newSnapshot: unknown): DiffResult[] {
  const oldData = typeof oldSnapshot === 'string' ? JSON.parse(oldSnapshot) : oldSnapshot;
  const newData = typeof newSnapshot === 'string' ? JSON.parse(newSnapshot) : newSnapshot;
  return compareObjects(oldData, newData);
}
