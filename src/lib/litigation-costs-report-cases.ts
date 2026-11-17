import definitions from './fixtures/litigation-costs-report-cases.json';
import feeDefinitions from './fixtures/litigation-costs-attorney-fee-cases.json';
import { draftFromReferenceCase, type ReferenceCase } from './litigation-costs-case-library';
import type { LitigationDraft } from './litigation-costs-draft';

export type ReportValidationCase = ReferenceCase & {
  expected: { forward: string; reverse: string; net: string; amount: string; debtorId: string; creditorId: string };
};
// 기대 금액은 사례 입력과 별도로 손계산해 고정한다. 계산기 결과로 생성하지 않는다.
export const reportValidationCases = [
  ...definitions,
  ...feeDefinitions.map(entry => ({ ...definitions.find(c => c.id === entry.baseCaseId)!, id: entry.id, title: entry.title, expected: entry.expected })),
] as ReportValidationCase[];
export function reportCaseDraft(id: string): LitigationDraft {
  const entry = reportValidationCases.find(c => c.id === id);
  if (!entry) throw new Error('알 수 없는 출력 검증 사례입니다.');
  const d = draftFromReferenceCase(entry);
  d.meta.number = `검증-${id}`;
  d.stages.forEach(s => s.number = `검증-${id}-${s.id}`);
  d.review.responseState = '기간 내 제출';
  d.review.setoff = '제112조 본문 적용 검토';
  d.review.rounding = '원 단위·절사 시점 개별 검토';
  d.rulings.forEach(r => { r.status = '검토함'; r.text = entry.order; });
  d.costs.forEach(c => { c.reason = '지출 당사자 전액 귀속 · 명시한 부담 비율 적용'; c.note = '개발용 인정액'; c.evidence = `${id} 검증 입력`; });
  d.calculation.plans.forEach(p => { if (p.applicationBasis) p.applicationBasis = '이 사례에서는 신청비용에도 본안 부담 비율을 적용한다고 가정'; });
  const automatic = feeDefinitions.find(c => c.id === id);
  if (automatic) {
    d.claims[0].value = automatic.fees[0].litigationValue;
    d.calculation.values = []; d.calculation.groups = [];
    d.calculation.plans.forEach(p => { p.basisGroupId = ''; });
    d.costs.forEach(cost => {
      const fee = automatic.fees.find(f => f.stageId === cost.stageId);
      if (cost.kind === '변호사보수' && fee) {
        cost.attorneyFee = { schedule: '2020-12-28', treatment: 'ordinary', litigationValue: fee.litigationValue };
        cost.claimed = fee.paid; cost.recognized = ''; cost.note = '개발용 실비 입력';
      } else if (cost.stageId === 'app') { cost.claimed = automatic.applicationFee; cost.recognized = automatic.applicationFee; }
    });
  }
  return d;
}
export function matchesReportCase(d: LitigationDraft) {
  return reportValidationCases.some(c => c.id === d.referenceCaseId) && JSON.stringify(d) === JSON.stringify(reportCaseDraft(d.referenceCaseId!));
}
