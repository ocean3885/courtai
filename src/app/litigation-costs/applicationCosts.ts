import { stageLevel, type ApplicationPolicy, type Cost, type Party, type Stage } from './caseInput';
import { add, burden, calculateSteps, expenseNet, fraction, nothing, product, resolveRuleRoutes, type Amount, type CalculationMode, type CalculationStep } from './costReview';

const natural = (value: string | undefined, label: string) => {
  if (!value || !/^\d{1,16}$/.test(value)) throw Error(label + '을 확인하세요.');
  return BigInt(value);
};
export const applicationOwners = (c: Cost) => (c.shared ? c.ids : [c.payer]).filter(Boolean);

function shares(ids: string[], method: string, values?: Record<string, string>): Amount[] {
  if (ids.length === 1) return [fraction(BigInt(1))];
  if (method !== '균분' && method !== '직접 비율') throw Error('배분 기준을 확인하세요.');
  const weights = ids.map(id => method === '균분' ? BigInt(1) : natural(values?.[id], '배분 비율'));
  const sum = weights.reduce((a, b) => a + b, BigInt(0));
  if (!sum) throw Error('배분 비율 합계는 0보다 커야 합니다.');
  return weights.map(n => fraction(n, sum));
}

export type ApplicationLine = {
  costId: string; kind: string; owner: string; debtor: string; amount: Amount; formula: string; basis: string;
  exactAmount: Amount; steps: CalculationStep[];
};

export function reviewApplicationCosts(costs: Cost[], parties: Party[], stages: Stage[] = [], policy?: ApplicationPolicy, mode: CalculationMode = '단계별10원') {
  const lines: ApplicationLine[] = [], errors: string[] = [];
  const ownerTotals = new Map<string, Amount>();
  for (const c of costs) {
    try {
      const owners = applicationOwners(c);
      const common = policy && c.application?.useCommon !== false;
      const allocation = common ? {
        ...policy.allocation,
        opponentIds: policy.allocation?.opponentIds ?? parties.filter(p => p.group === '피신청인').map(p => p.id),
        ownerWeights: c.application?.ownerWeights,
      } : c.application;
      const opponents = allocation?.opponentIds || [];
      if (!owners.length || (c.shared && owners.length < 2) || new Set(owners).size !== owners.length || owners.some(id => !parties.some(p => p.id === id && p.group === '신청인')))
        throw Error('신청비용 귀속 신청인을 선택하세요.');
      const net = expenseNet(c);
      const recognized = c.recognized ? natural(c.recognized, '신청비용 인정액') : net;
      if (recognized > net) throw Error('신청비용 인정액이 납부액에서 환급액을 뺀 금액을 초과합니다.');
      if (!opponents.length || new Set(opponents).size !== opponents.length || opponents.some(id => !parties.some(p => p.id === id && p.group === '피신청인')))
        throw Error('신청비용을 배분할 피신청인을 선택하세요.');
      const ownerShares = shares(owners, c.method || '균분', allocation?.ownerWeights);
      const opponentShares = shares(opponents, allocation?.opponentMethod || '균분', allocation?.opponentWeights);
      const pending: ApplicationLine[] = [];
      owners.forEach((owner, i) => {
        const index = policy?.stageId ? stages.findIndex(s => s.id === policy.stageId) : 0;
        const judgment = common && policy.mode === '판결 기준';
        if (judgment && !stages[index]) throw Error('신청비용에 연결할 판결의 심급을 선택하세요.');
        if (judgment && policy.claim === '반소' && !stages[index].counter)
          throw Error('선택한 판결 심급에 반소가 없습니다. 신청비용의 적용 청구를 확인하세요.');
        const routes = judgment ? resolveRuleRoutes(stages, index, owner, undefined, policy.claim) : [];
        opponents.forEach((debtor, j) => {
          const route = routes.find(r => r.debtor === debtor);
          if (judgment && !route) throw Error('선택한 판결 기준에 신청비용 대상 상대방이 없습니다. 적용 심급·청구·당사자를 확인하세요.');
          const liveRate = route ? burden(route.rule, route.rule.left.includes(owner)) : undefined;
          const rate = liveRate ? { n: String(liveRate.n), d: String(liveRate.d) } : allocation?.rates?.[owner]?.[debtor];
          const n = natural(rate?.n, '신청비용 부담 분자'), d = natural(rate?.d, '신청비용 부담 분모');
          if (!d || n > d) throw Error('신청비용 부담률은 0 이상 1 이하로 입력하세요.');
          const calculation = calculateSteps(fraction(recognized), [
            { label: '공동비용 귀속', factor: ownerShares[i] },
            { label: '상대방별 배분', factor: opponentShares[j] },
            { label: '부담률 적용', factor: fraction(n, d) },
          ], mode);
          const basis = route ? stageLevel(stages[route.source], route.source) + ' · ' + route.rule.scope : common ? '신청비용 공통 · 별도 기준' : '이 비용 개별 기준';
          pending.push({ costId: c.id, kind: c.title || c.kind, owner, debtor, basis,
            ...calculation,
          });
        });
      });
      lines.push(...pending);
      owners.forEach((owner, i) => ownerTotals.set(owner, add(ownerTotals.get(owner) || nothing, product(fraction(recognized), ownerShares[i]))));
    } catch (error) {
      errors.push((c.title || c.kind) + ' — ' + (error as Error).message);
    }
  }
  return { lines: errors.length ? [] : lines, errors, ownerTotals };
}

