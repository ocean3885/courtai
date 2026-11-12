import type { DocumentData } from './document-service';
import { calculateRepayment } from './repayment-calculator';

export class InputError extends Error {}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function nonnegativeNumbers(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
  if (Array.isArray(value)) return value.every(nonnegativeNumbers);
  if (object(value)) return Object.values(value).every(nonnegativeNumbers);
  return typeof value === 'string' ? value.length <= 10000 : true;
}
function date(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateCase(title: unknown, value: unknown, generating = false): asserts value is DocumentData {
  if (typeof title !== 'string' || !title.trim() || title.length > 200) throw new InputError('제목은 1~200자로 입력해주세요.');
  if (!object(value) || !object(value.debtorInfo) || !object(value.repaymentPlan) || !Array.isArray(value.creditors)) {
    throw new InputError('사건 입력 형식이 올바르지 않습니다.');
  }
  const debtor = value.debtorInfo;
  if (typeof debtor.name !== 'string' || !debtor.name.trim() || typeof debtor.birthDate !== 'string' ||
    !/^\d{8}$/.test(debtor.birthDate) || !date(debtor.birthDate.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'))) {
    throw new InputError('채무자 이름과 유효한 생년월일 8자리를 입력해주세요.');
  }
  if (value.creditors.length > 500 || !nonnegativeNumbers(value)) throw new InputError('금액 또는 입력 범위를 확인해주세요.');
  for (const creditor of value.creditors) {
    if (!object(creditor) || typeof creditor.id !== 'string' || typeof creditor.number !== 'string' || typeof creditor.name !== 'string') {
      throw new InputError('채권자 정보 형식이 올바르지 않습니다.');
    }
    if (generating && !creditor.name.trim()) throw new InputError('채권자명을 입력해주세요.');
    if (creditor.subrogatedList !== undefined && (!Array.isArray(creditor.subrogatedList) || creditor.subrogatedList.length > 100)) {
      throw new InputError('대위변제자 목록을 확인해주세요.');
    }
  }
  const plan = value.repaymentPlan;
  if (!object(plan.repaymentPeriod)) throw new InputError('변제기간을 입력해주세요.');
  if (plan.trusteeFee && (!object(plan.trusteeFee) || Number(plan.trusteeFee.postConfirmationRate) > 100)) {
    throw new InputError('회생위원 보수율은 0~100%여야 합니다.');
  }
  const start = plan.repaymentPeriod.startDate, end = plan.repaymentPeriod.endDate;
  if ((start && !date(start)) || (end && !date(end)) || (typeof start === 'string' && typeof end === 'string' && start && end && start > end)) {
    throw new InputError('변제 시작일과 종료일을 확인해주세요.');
  }
  if ((plan.createDate && !date(plan.createDate)) || (generating && (!date(start) || !date(end) || !date(plan.createDate) || !value.creditors.length))) {
    throw new InputError('문서 생성에 필요한 채권자, 작성일과 변제 시작·종료일을 입력해주세요.');
  }
  try { calculateRepayment(value.creditors, plan); } catch (error) {
    throw new InputError(error instanceof Error ? error.message : '변제계획을 확인해주세요.');
  }
}

export function validateTemplate(creditors: unknown, monthlyAvailable: unknown, months: unknown): void {
  if (!Array.isArray(creditors) || creditors.length > 500 || !creditors.every(object) || !nonnegativeNumbers(creditors) ||
      typeof monthlyAvailable !== 'number' || !Number.isSafeInteger(monthlyAvailable) || monthlyAvailable < 0 ||
      typeof months !== 'number' || !Number.isInteger(months) || months < 1 || months > 120) {
    throw new InputError('채권자 목록, 월 가용소득과 변제기간(1~120개월)을 확인해주세요.');
  }
}
