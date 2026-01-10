import { CreditorData, ValidationResult } from '@/types/rehabilitation';

export function validateCreditorData(data: CreditorData[]): ValidationResult[] {
  return data.map((item) => {
    const errors: string[] = [];
    const calculatedTotal = item.principal + item.interest;
    
    // Check if the sum of principal and interest matches the reported total
    if (calculatedTotal !== item.total) {
      errors.push(`수치 불일치: 원금(${item.principal.toLocaleString()}원) + 이자(${item.interest.toLocaleString()}원) = ${calculatedTotal.toLocaleString()}원이나, 문서에는 ${item.total.toLocaleString()}원으로 기재되어 있습니다.`);
    }

    // You can add more deterministic rules here (e.g., baseDate format, minimum values, etc.)
    if (item.principal < 0) errors.push('원금이 음수입니다.');
    if (item.interest < 0) errors.push('이자가 음수입니다.');

    return {
      creditorName: item.name,
      isValid: errors.length === 0,
      errors,
    };
  });
}
