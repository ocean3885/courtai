import { isApplicantSideParty, stageLevel, type Party, type Rule, type Stage } from './caseInput';
import { resolveRuleRoutes } from './costReview';

export function suggestedOrder(stage: Stage, parties: Party[], index: number, id: string): Rule {
  const people = parties.filter(p => stage.members[p.id]);
  return {
    id,
    left: people.filter(isApplicantSideParty).map(p => p.id),
    right: people.filter(p => !isApplicantSideParty(p)).map(p => p.id),
    mode: '2측 전부 부담', n: '1', d: '2',
    scope: stageLevel(stage, index) + ' 비용',
    claim: stage.counter ? '본소와 반소' : '',
    leftMethod: '균분', rightMethod: '균분',
  };
}

export function patchOrder(stage: Stage, rule: Rule, patch: Partial<Rule>): Rule[] {
  const updated = { ...rule, ...patch, id: rule.id };
  const existingConflicts = new Set(conflictingOrderPairs(stage, rule));
  if (conflictingOrderPairs(stage, updated).some(pair => !existingConflicts.has(pair))) return stage.rules;
  return stage.rules.some(r => r.id === rule.id)
    ? stage.rules.map(r => r.id === rule.id ? updated : r)
    : [...stage.rules, updated];
}

export function conflictingOrderPairs(stage: Stage, rule: Rule): string[] {
  const overlaps = (other: Rule) => !(
    (rule.claim === '본소' && other.claim === '반소') ||
    (rule.claim === '반소' && other.claim === '본소')
  );
  return rule.left.flatMap(left => rule.right.filter(right => stage.rules.some(other =>
    other.id !== rule.id && overlaps(other) && other.left.includes(left) && other.right.includes(right),
  )).map(right => left + ':' + right));
}

export function canSelectOrderParty(stage: Stage, rule: Rule, side: 'left' | 'right', id: string): boolean {
  if (rule[side].includes(id)) return true; // Existing selections must remain removable.
  return !conflictingOrderPairs(stage, { ...rule, [side]: [...rule[side], id] }).length;
}

export function orderDescription(rule: Rule): string {
  switch (rule.mode) {
    case '1측 전부 부담': return '신청인 측 전부 부담';
    case '2측 전부 부담': return '상대방 측 전부 부담';
    case '비율로 분담': {
      if (!/^\d+$/.test(rule.n) || !/^\d+$/.test(rule.d)) return '부담 비율 입력 확인 필요';
      const n = BigInt(rule.n), d = BigInt(rule.d);
      if (d === BigInt(0) || n > d) return '부담 비율 입력 확인 필요';
      return `신청인 측 ${n}/${d} · 상대방 측 ${d - n}/${d}`;
    }
    default: return rule.mode;
  }
}

export function orderIssues(stage: Stage, rule: Rule, parties: Party[]): string[] {
  const issues: string[] = [];
  if (!rule.left.length || !rule.right.length) issues.push('주문을 적용할 양측 당사자를 선택하세요.');
  const ids = [...rule.left, ...rule.right];
  if (new Set(ids).size !== ids.length) issues.push('주문 양측에 같은 당사자가 중복되어 있습니다.');
  if (conflictingOrderPairs(stage, rule).length) issues.push('다른 주문에 이미 지정된 신청인–상대방 관계가 중복되어 있습니다. 적용 당사자를 정리하세요.');
  if (ids.some(id => !stage.members[id] || !parties.some(p => p.id === id)))
    issues.push('주문 대상에 해당 심급의 비참여자가 있습니다. 적용 당사자를 다시 선택하세요.');
  if (rule.left.some(id => parties.some(p => p.id === id && !isApplicantSideParty(p))) ||
      rule.right.some(id => parties.some(p => p.id === id && isApplicantSideParty(p))))
    issues.push('주문 대상의 신청인 측·상대방 측 구분을 확인하세요.');
  if (rule.mode === '비율로 분담' &&
      (!/^\d+$/.test(rule.n) || !/^\d+$/.test(rule.d) || BigInt(rule.d) === BigInt(0) || BigInt(rule.n) > BigInt(rule.d)))
    issues.push('부담 분자는 0 이상, 분모 이하로 입력하고 분모는 0보다 크게 입력하세요.');
  return issues;
}

export type OrderSummaryRow = {
  stage: number;
  owner: string;
  opponent: string;
  source: number;
  rule: Rule;
  claim?: '본소' | '반소';
};

// Use the calculation engine's routing so the preview and actual calculation agree.
// Earlier relationships remain intact as the allocation denominator even after
// a later total-cost order replaces only some opponents' burden ratios.
export function summarizeOrders(stages: Stage[], parties: Party[]) {
  const rows: OrderSummaryRow[] = [];
  const issues = new Set<string>();
  stages.forEach((stage, index) => {
    stage.rules.forEach(rule => orderIssues(stage, rule, parties).forEach(issue =>
      issues.add(`${stageLevel(stage, index)}: ${issue}`)));
    const owners = parties.filter(p => isApplicantSideParty(p) && stage.members[p.id]);
    const claims: ('본소' | '반소' | undefined)[] = stage.counter ||
      stages.slice(index).some(s => s.rules.some(r => r.claim === '본소' || r.claim === '반소'))
      ? ['본소', '반소'] : [undefined];
    for (const owner of owners) {
      for (const claim of claims) {
        try {
          for (const route of resolveRuleRoutes(stages, index, owner.id, undefined, claim)) {
            rows.push({ stage: index, owner: owner.id, opponent: route.debtor, source: route.source, rule: route.rule, claim });
          }
        } catch (error) {
          issues.add(`${stageLevel(stage, index)}${claim ? ` ${claim}` : ''}: ${error instanceof Error ? error.message : '주문 적용 대상을 확인하세요.'}`);
          if (!stage.rules.length && index < stages.length - 1)
            issues.add(`${stageLevel(stage, index)} 주문 입력을 생략하려면 상급심 소송총비용 주문이 해당 비용의 전체 당사자 관계를 포함해야 합니다. 일부 관계만 포함되거나 상급심 비용만 정한 경우에는 종전 주문을 입력하세요.`);
        }
      }
    }
  });
  return { rows, issues: [...issues] };
}
