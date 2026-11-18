import { levels, type Cost, type Party, type Rule, type Stage } from './caseInput';
import { ordinaryFeeLimit } from './ordinaryFee';

type Amount = { n: bigint; d: bigint };
const zero = BigInt(0);
const one = BigInt(1);
function fraction(n: bigint, d = one): Amount {
  let a = n < zero ? -n : n,
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
export const add = (a: Amount, b: Amount) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a: Amount, b: Amount) => add(a, { n: -b.n, d: b.d });
const product = (a: Amount, b: Amount) => fraction(a.n * b.n, a.d * b.d);
export const nothing = fraction(zero);
export const money = (a: Amount) =>
  a.d === one
    ? a.n.toLocaleString('ko-KR') + '원'
    : a.n.toLocaleString('ko-KR') + '/' + a.d.toLocaleString('ko-KR') + '원';
const ratio = (a: Amount) => a.n + '/' + a.d;
function integer(s: string | undefined, label: string) {
  if (!s || !/^\d{1,16}$/.test(s)) throw Error(label + '을 확인하세요.');
  return BigInt(s);
}
export function expenseNet(c: Cost) {
  const net = integer(c.paid, '납부액') - integer(c.refund, '환급액');
  if (net < zero) throw Error('환급액이 납부액을 초과합니다.');
  return net;
}
function basis(cost: Cost, s: Stage, parties: Party[]) {
  const net = expenseNet(cost);
  const simpleFee = cost.kind === '변호사보수' && parties.length === 2 && !s.counter && !cost.shared;
  if (cost.recognized) {
    const reviewed = integer(cost.recognized, '검토 인정액');
    if (reviewed > net) throw Error('검토 인정액이 실지출액을 초과합니다.');
    if (simpleFee && reviewed > ordinaryFeeLimit(integer(s.value, '본소 소가')))
      throw Error('보수 인정액이 일반 본안 한도를 초과합니다.');
    return reviewed;
  }
  if (cost.kind !== '변호사보수') return net;
  if (!simpleFee) throw Error('보수의 증빙 검토 인정액을 입력하세요.');
  const limit = ordinaryFeeLimit(integer(s.value, '본소 소가'));
  return limit < net ? limit : net;
}
function weights(ids: string[], method: string, s: Stage) {
  if (!ids.length || ids.some((id) => !s.members[id])) throw Error('해당 심급의 대상 당사자를 확인하세요.');
  if (ids.length === 1) return [fraction(one)];
  if (method !== '균분' && method !== '소가 비율') throw Error('여러 당사자 사이의 안분 기준을 선택하세요.');
  const values = ids.map((id) => (method === '균분' ? one : integer(s.members[id].value, '당사자 소가')));
  const sum = values.reduce((a, b) => a + b, zero);
  if (!sum) throw Error('대상 당사자의 소가 합계가 0원입니다.');
  return values.map((n) => fraction(n, sum));
}
function burden(rule: Rule, ownerOnLeft: boolean) {
  switch (rule.mode) {
    case '각자 부담':
      return nothing;
    case '1측 전부 부담':
      return fraction(ownerOnLeft ? zero : one);
    case '2측 전부 부담':
      return fraction(ownerOnLeft ? one : zero);
    case '비율로 분담': {
      const n = integer(rule.n, '부담 분자'),
        d = integer(rule.d, '분모');
      if (!d || n > d) throw Error('부담 비율을 확인하세요.');
      return fraction(ownerOnLeft ? d - n : n, d);
    }
    default:
      throw Error('부담 방식을 선택하세요.');
  }
}
const includesOwner = (r: Rule, id: string) => r.left.includes(id) || r.right.includes(id);
function effectiveRule(stages: Stage[], index: number, id: string, selected?: string) {
  let rules = stages[index].rules.filter((r) => includesOwner(r, id));
  if (selected) {
    rules = rules.filter((r) => r.id === selected);
    if (!rules.length) throw Error('선택한 부담 관계에 비용 귀속자가 포함되는지 확인하세요.');
  }
  let source = index;
  for (let i = index + 1; i < stages.length; i++) {
    const later = stages[i].rules.filter((r) => r.scope === '소송총비용' && includesOwner(r, id));
    if (!later.length) continue;
    // A narrower later judgment cannot replace the whole earlier group allocation.
    const ids = (r: Rule) => [...r.left, ...r.right].sort().join('|');
    if (
      !rules.length &&
      (later.length !== 1 || ids(later[0]) !== Object.keys(stages[index].members).sort().join('|'))
    ) {
      throw Error('종전 심급의 비용 범위와 소송총비용 주문의 대상 당사자를 확인하세요.');
    }
    if (rules.length && (rules.length !== 1 || later.length !== 1 || ids(rules[0]) !== ids(later[0]))) {
      throw Error('소송총비용 주문의 당사자 범위가 달라 개별 배분 검토가 필요합니다.');
    }
    rules = later;
    source = i;
  }
  if (rules.length !== 1)
    throw Error(
      rules.length
        ? '적용 가능한 부담 관계가 여러 개입니다. 비용별 범위를 검토하세요.'
        : '이 비용에 적용할 부담 관계를 입력하세요.'
    );
  if (!rules[0].left.length || !rules[0].right.length) throw Error('부담 관계 양측 당사자를 선택하세요.');
  if (stages[index].counter || stages[source].counter) {
    if (rules[0].claim !== '본소와 반소') throw Error('본소·반소의 개별 비용 배분을 검토하세요.');
  }
  return { rule: rules[0], source };
}
type Line = {
  stage: string;
  kind: string;
  owner: string;
  debtor: string;
  amount: Amount;
  formula: string;
  order: string;
};
export function reviewCosts(stages: Stage[], parties: Party[]) {
  const lines: Line[] = [],
    errors: string[] = [];
  const ownerTotals = new Map<string, Amount>();
  stages.forEach((s, index) =>
    s.costs.forEach((c) => {
      try {
        const value = fraction(basis(c, s, parties));
        const owners = c.shared ? c.ids : [c.payer];
        if (c.shared && owners.length < 2) throw Error('공동 지출의 귀속 당사자를 두 명 이상 선택하세요.');
        const shares = weights(owners, c.method, s);
        for (const [j, owner] of owners.entries()) {
          const owned = product(value, shares[j]);
          ownerTotals.set(owner, add(ownerTotals.get(owner) ?? nothing, owned));
          const { rule, source } = effectiveRule(stages, index, owner, c.ruleId);
          const left = rule.left.includes(owner);
          const debtors = left ? rule.right : rule.left;
          const rate = burden(rule, left);
          const parts =
            rate.n === zero
              ? debtors.map(() => fraction(one))
              : weights(debtors, left ? rule.rightMethod : rule.leftMethod, s);
          debtors.forEach((debtor, k) => {
            const factors = [shares[j], rate, parts[k]];
            lines.push({
              stage: levels[index],
              kind: c.title || c.kind,
              owner,
              debtor,
              amount: factors.reduce(product, value),
              order: levels[source] + ' · ' + rule.scope,
              formula: [money(value), ...factors.filter((f) => f.n !== f.d).map(ratio)].join(' × '),
            });
          });
        }
      } catch (e) {
        errors.push(
          levels[index] +
            ' · ' +
            (parties.find((p) => p.id === c.payer)?.name || '이름 미입력') +
            ' · ' +
            c.kind +
            ' — ' +
            (e as Error).message
        );
      }
    })
  );
  return { lines: errors.length ? [] : lines, errors, ownerTotals };
}
