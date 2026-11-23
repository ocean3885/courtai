import { type Party, type Stage } from './caseInput';
import { add, burden, nothing, resolveRuleRoutes, subtract, truncateWon, type Amount, type reviewCosts } from './costReview';
import { type reviewApplicationCosts } from './applicationCosts';

export function absoluteAmount(amount: Amount): Amount {
  return amount.n < BigInt(0) ? subtract(nothing, amount) : amount;
}

function cannotRecover(stages: Stage[], owner: string, debtor: string): boolean {
  const relevant = stages.map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stage.members[owner] && stage.members[debtor]);
  if (!relevant.length) return false;
  try {
    return relevant.every(({ stage, index }) => {
      const claims = stage.counter ? ['본소', '반소'] as const : ['본소'] as const;
      return claims.every(claim => {
        const routes = resolveRuleRoutes(stages, index, owner, undefined, claim).filter(r => r.debtor === debtor);
        return routes.length > 0 && routes.every(r => burden(r.rule, r.rule.left.includes(owner)).n === BigInt(0));
      });
    });
  } catch {
    // Missing or conflicting orders cannot establish a zero recovery amount.
    return false;
  }
}

// Missing expenses remain unknown unless every applicable order establishes
// that this respondent cannot recover from this applicant at any stage.
export function settleCosts(
  parties: Party[],
  main: ReturnType<typeof reviewCosts>,
  application: ReturnType<typeof reviewApplicationCosts>,
  stages: Stage[] = [],
) {
  const total = (owner: string, debtor: string) => main.lines
    .filter(l => l.owner === owner && l.debtor === debtor)
    .reduce((sum, l) => add(sum, l.amount), nothing);
  return parties.filter(p => p.group === '신청인').flatMap(a =>
    parties.filter(b => b.group === '피신청인' && [...main.lines, ...application.lines].some(l =>
      (l.owner === a.id && l.debtor === b.id) || (l.owner === b.id && l.debtor === a.id),
    )).map(b => {
      const forward = total(a.id, b.id);
      const reverse = total(b.id, a.id);
      const net = subtract(forward, reverse);
      const applicationAmount = application.lines.filter(l => l.owner === a.id && l.debtor === b.id)
        .reduce((sum, l) => add(sum, l.amount), nothing);
      const combinedAmount = add(net, applicationAmount);
      const respondentRecoveryExcluded = !main.ownerTotals.has(b.id) && cannotRecover(stages, b.id, a.id);
      let missing = '';
      if (main.errors.length || application.errors.length) missing = '비용과 부담 주문의 입력 오류를 확인하세요.';
      else if (!main.ownerTotals.has(a.id)) missing = '신청인 지출 비용을 입력하세요. 반영할 비용이 없으면 0원을 입력하세요.';
      else if (!main.ownerTotals.has(b.id) && !respondentRecoveryExcluded) missing = '피신청인 지출 비용을 입력하세요. 반영할 비용이 없으면 0원을 입력하세요.';
      const negative = combinedAmount.n < BigInt(0);
      const exactPayable = absoluteAmount(combinedAmount);
      const payable = truncateWon(exactPayable);
      return { a, b, forward, reverse, net, applicationAmount, combinedAmount, missing,
        applicantEntered: main.ownerTotals.has(a.id), respondentEntered: main.ownerTotals.has(b.id), respondentRecoveryExcluded,
        negative, payer: negative ? a : b, receiver: negative ? b : a,
        payable, discarded: subtract(exactPayable, payable) };
    }),
  );
}
