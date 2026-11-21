import { isApplicantSideParty, stageLevel, type Cost, type Party, type Rule, type Stage } from './caseInput';
import { reviewCosts, stageEffectiveValue, counterEffectiveValue, combinePartyValues, burden, type ReviewedExpense } from './costReview';
import { reviewAutomaticApplicationCosts } from './applicationCosts';
import { settleCosts } from './settlements';
import { ordinaryFeeFormula } from './ordinaryFee';

const sum = (expenses: ReviewedExpense[]) => expenses.reduce((total, e) => total + e.recognized, BigInt(0));

// Recognition totals are before ownership allocation, burden rates and rounding.
// Recovery and settlement amounts are kept separately in main/application/settlements.
export function calculateLitigationCosts(parties: Party[], stages: Stage[], costs: Cost[]) {
  const main = reviewCosts(stages, parties);
  const application = reviewAutomaticApplicationCosts(costs, parties, stages);
  const sideTotals = (expenses: ReviewedExpense[]) => ({
    applicant: sum(expenses.filter(e => e.owners.some(id => parties.some(p => p.id === id && isApplicantSideParty(p))))),
    respondent: sum(expenses.filter(e => e.owners.some(id => parties.some(p => p.id === id && !isApplicantSideParty(p))))),
  });
  const stageResults = stages.map((stage, index) => {
    const expenses = main.expenses.filter(e => e.stageId === stage.id);
    const mainValue = stageEffectiveValue(stage, parties);
    const counterValue = stage.counter ? counterEffectiveValue(stage, parties) : null;
    const value = stage.counter
      ? mainValue !== null && counterValue !== null && stage.counterFeeMode
        ? combinePartyValues([mainValue, counterValue], stage.counterFeeMode) : null
      : mainValue;
    return { stage, level: stageLevel(stage, index), expenses, totals: sideTotals(expenses), mainValue, counterValue, value };
  });
  const mainTotals = sideTotals(main.expenses);
  const applicationTotal = sum(application.expenses);
  return {
    main, application, stageResults, mainTotals, applicationTotal,
    totals: { applicant: mainTotals.applicant + applicationTotal, respondent: mainTotals.respondent },
    errors: [...main.errors, ...application.errors],
    settlements: settleCosts(parties, main, application, stages),
    roundingDescription: '본소·반소 배분이 필요한 경우 이를 먼저 적용한 뒤, 공동비용 귀속 → 상대방별 배분 → 부담률 적용 순서로 계산합니다. 각 배분 단계에서 10원 미만을 버리며, 비율이 1인 단계는 금액을 유지합니다.',
  };
}
export type LitigationCalculation = ReturnType<typeof calculateLitigationCosts>;

export function expenseRemark(expense: ReviewedExpense): string {
  const { cost, feeBasis, feeLimit, net, recognized, refund } = expense;
  const won = (n: bigint) => n.toLocaleString('ko-KR') + '원';
  if (cost.kind === '변호사보수') {
    return [feeBasis === null ? '소가 미확인' : `보수 산정 소가 ${won(feeBasis)}`,
      feeBasis === null || feeLimit === null ? '증빙 검토 인정액 적용' : `한도 ${ordinaryFeeFormula(feeBasis)} = ${won(feeLimit)}`,
      `실지출 ${won(net)} → 산입 ${won(recognized)}`].join(' · ');
  }
  const detail = cost.deliveryDetail;
  const delivery = detail ? ([['기발생', detail.incurred], ['결정정본', detail.decision], ['모바일단문메시지', detail.mobile]] as const)
    .filter(([, value]) => value && /^\d+$/.test(value) && BigInt(value) > BigInt(0))
    .map(([title, value]) => `${title} ${won(BigInt(value!))}`).join(' + ') : '';
  return [delivery, refund > BigInt(0) ? `환급액 ${won(refund)} 제외` : '',
    recognized !== net ? `실지출 ${won(net)} → 검토 인정액 ${won(recognized)}` : '', cost.evidence].filter(Boolean).join(' · ');
}

export function describeOrder(rule: Rule, parties: Party[], label: (p: Party) => string): string {
  const names = (ids: string[]) => ids.map(id => { const p = parties.find(p => p.id === id); return p ? label(p) : '당사자 확인 필요'; }).join(', ');
  const left = names(rule.left), right = names(rule.right);
  let content: string;
  try {
    const leftRate = burden(rule, false), rightRate = burden(rule, true);
    content = rule.mode === '각자 부담' ? '각자 부담'
      : `${left} ${leftRate.n}/${leftRate.d} 부담 · ${right} ${rightRate.n}/${rightRate.d} 부담`;
  } catch { content = '부담 내용 입력 확인 필요'; }
  return `${left} ↔ ${right} · ${rule.scope}${rule.claim ? ` · ${rule.claim}` : ''} : ${content}`;
}
