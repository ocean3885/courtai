import {
  isApplicantSideParty,
  stageLevel,
  type Cost,
  type MemberValueType,
  type Party,
  type RecordedValue,
  type Rule,
  type Stage,
  type ValueMode,
} from './caseInput';
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
const parseNatural = (s: string | undefined): bigint | null =>
  s && /^\d{1,16}$/.test(s) ? BigInt(s) : null;

export function combinePartyValues(values: bigint[], mode: ValueMode = '합산'): bigint {
  if (!values.length) return zero;
  return mode === '흡수'
    ? values.reduce((a, b) => (a > b ? a : b), zero)
    : values.reduce((a, b) => a + b, zero);
}

export function sideValueMode(s: Stage, isApplicantSide: boolean, counter = false): ValueMode {
  if (counter) return s.counterValueMode || '합산';
  return (isApplicantSide ? s.applicantValueMode : s.opponentValueMode) || s.valueMode || '합산';
}

function bundleMemberValue(s: Stage, row: RecordedValue, id: string, counter: boolean): bigint | null {
  return parseNatural(row.amount) ?? (!counter && s.useIndividualValues === undefined ? parseNatural(s.members[id]?.value) : null);
}

function individualMemberValue(s: Stage, id: string, counter: boolean): bigint | null {
  if (counter) return s.useCounterIndividualValues ? parseNatural(s.members[id]?.counterValue) : null;
  // Stages created before the checkbox used their individual values by default.
  return s.useIndividualValues === false ? null : parseNatural(s.members[id]?.value);
}

export function stageMemberValue(s: Stage, id: string, counter = false): bigint | null {
  const bundle = (counter ? s.counterValues : s.mainValues)?.find((row) => row.ids.includes(id));
  return bundle ? bundleMemberValue(s, bundle, id, counter) : individualMemberValue(s, id, counter);
}

export function allocationMemberValue(s: Stage, p: Party): bigint | null {
  if (!s.mainValueTarget || (s.mainValueTarget === '신청인측') === isApplicantSideParty(p)) {
    return stageMemberValue(s, p.id);
  }
  return s.counter ? stageMemberValue(s, p.id, true) : null;
}

export function combineStageMemberValues(
  s: Stage,
  memberIds: string[],
  defaultMode: ValueMode = '합산',
  counter = false
): bigint | null {
  const bundledRows = (counter ? s.counterValues : s.mainValues) || [];
  const handledByBundle = new Set<string>();
  let bundleSum = zero;
  let bundleMax = zero;
  let hasAnyValue = false;

  for (const row of bundledRows) {
    const overlappingIds = row.ids.filter((id) => memberIds.includes(id));
    if (!overlappingIds.length) continue;
    overlappingIds.forEach((id) => handledByBundle.add(id));
    const amount =
      overlappingIds.map((id) => bundleMemberValue(s, row, id, counter)).find((v) => v !== null) ?? null;
    if (amount !== null) {
      hasAnyValue = true;
      bundleSum += amount;
      if (amount > bundleMax) bundleMax = amount;
    }
  }

  const validEntries: { val: bigint; type: MemberValueType }[] = [];
  for (const id of memberIds) {
    if (handledByBundle.has(id)) continue;
    const val = individualMemberValue(s, id, counter);
    if (val === null) continue;
    const type = (!counter && s.members[id]?.valueType) || (defaultMode === '흡수' ? '흡수' : '개별');
    validEntries.push({ val, type });
  }
  if (!validEntries.length && !hasAnyValue) return null;

  let individualSum = zero;
  let common1Max = zero;
  let common2Max = zero;
  let absorbedMax = zero;

  for (const entry of validEntries) {
    if (entry.type === '개별') {
      individualSum += entry.val;
    } else if (entry.type === '공통') {
      if (entry.val > common1Max) common1Max = entry.val;
    } else if (entry.type === '공통2') {
      if (entry.val > common2Max) common2Max = entry.val;
    } else if (entry.type === '흡수') {
      if (entry.val > absorbedMax) absorbedMax = entry.val;
    }
  }

  if (defaultMode === '흡수') {
    const maxUnbundled = [individualSum, common1Max, common2Max, absorbedMax].reduce(
      (a, b) => (a > b ? a : b),
      zero
    );
    return bundleMax >= maxUnbundled ? bundleMax : maxUnbundled;
  }

  const baseSum = bundleSum + individualSum + common1Max + common2Max;
  return baseSum >= absorbedMax ? baseSum : absorbedMax;
}

export function sideEffectiveValue(s: Stage, parties: Party[], isApplicantSide: boolean, counter = false): bigint | null {
  const mode = sideValueMode(s, isApplicantSide, counter);
  const sideIds = parties
    .filter((p) => isApplicantSideParty(p) === isApplicantSide && s.members[p.id])
    .map((p) => p.id);
  return combineStageMemberValues(s, sideIds, mode, counter);
}

export function stageEffectiveValue(s: Stage, parties: Party[]): bigint | null {
  if (s.mainValueTarget) {
    return sideEffectiveValue(s, parties, s.mainValueTarget === '신청인측') ??
      (s.useIndividualValues === true ? null : parseNatural(s.value));
  }
  const appTotal = sideEffectiveValue(s, parties, true);
  const respTotal = sideEffectiveValue(s, parties, false);

  if (appTotal !== null && respTotal !== null) return appTotal >= respTotal ? appTotal : respTotal;
  if (appTotal !== null) return appTotal;
  if (respTotal !== null) return respTotal;
  return s.useIndividualValues === true ? null : parseNatural(s.value);
}

export function counterEffectiveValue(s: Stage, parties: Party[]): bigint | null {
  if (!s.counter) return null;
  if (!s.useCounterIndividualValues) return parseNatural(s.counterValue);
  return s.mainValueTarget ? sideEffectiveValue(s, parties, s.mainValueTarget === '피신청인측', true) : null;
}

export function resolveFeeBasisValue(cost: Cost, s: Stage, parties: Party[]): bigint | null {
  if (
    s.useIndividualValues === undefined && s.value && !s.valueMode && !s.applicantValueMode &&
    !s.opponentValueMode && !cost.shared && parties.length === 2
  ) {
    const explicitStageVal = parseNatural(s.value);
    if (explicitStageVal !== null) return explicitStageVal;
  }
  const owners = (cost.shared ? cost.ids : [cost.payer]).filter(Boolean);
  if (!owners.length) return null;
  const ownerParty = parties.find((p) => p.id === owners[0]);
  const isApplicantSide = ownerParty ? isApplicantSideParty(ownerParty) : true;
  const manualValue = s.useIndividualValues === true ? null : parseNatural(s.value);
  if (s.mainValueTarget && (s.mainValueTarget === '신청인측') !== isApplicantSide) {
    return manualValue ?? stageEffectiveValue(s, parties);
  }
  const mode = sideValueMode(s, isApplicantSide);
  const ownerValues = owners.map((id) => stageMemberValue(s, id));
  if (ownerValues.every((v): v is bigint => v !== null)) {
    return combineStageMemberValues(s, owners, mode);
  }
  return sideEffectiveValue(s, parties, isApplicantSide) ?? manualValue ?? stageEffectiveValue(s, parties);
}

export function expenseNet(c: Cost) {
  const net = integer(c.paid, '납부액') - integer(c.refund, '환급액');
  if (net < zero) throw Error('환급액이 납부액을 초과합니다.');
  return net;
}
function basis(cost: Cost, s: Stage, parties: Party[]) {
  const net = expenseNet(cost);
  const feeBasis = cost.kind === '변호사보수' ? resolveFeeBasisValue(cost, s, parties) : null;
  if (cost.recognized) {
    const reviewed = integer(cost.recognized, '검토 인정액');
    if (reviewed > net) throw Error('검토 인정액이 실지출액을 초과합니다.');
    if (feeBasis !== null && reviewed > ordinaryFeeLimit(feeBasis))
      throw Error('보수 인정액이 일반 본안 한도를 초과합니다.');
    return reviewed;
  }
  if (cost.kind !== '변호사보수') return net;
  if (feeBasis === null) throw Error('당사자 소가 또는 보수의 증빙 검토 인정액을 입력하세요.');
  const limit = ordinaryFeeLimit(feeBasis);
  return limit < net ? limit : net;
}
function weights(ids: string[], method: string, s: Stage, parties: Party[]) {
  if (!ids.length || ids.some((id) => !s.members[id])) throw Error('해당 심급의 대상 당사자를 확인하세요.');
  if (ids.length === 1) return [fraction(one)];
  if (method !== '균분' && method !== '소가 비율' && method !== '안분')
    throw Error('여러 당사자 사이의 기준(균분/안분)을 선택하세요.');
  const values = ids.map((id) => {
    if (method === '균분') return one;
    const party = parties.find((p) => p.id === id);
    const value = party ? allocationMemberValue(s, party) : null;
    if (value !== null) return value;
    throw Error('안분 대상의 공통소가를 입력하거나, 해당 청구의 개별소가 항목을 체크하고 개별 소가를 입력하세요.');
  });
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
  stages.forEach((s, index) => {
    const feeOwners = new Set<string>();
    s.costs.forEach((c) => {
      try {
        const owners = (c.shared ? c.ids : [c.payer]).filter(Boolean);
        if (!owners.length) throw Error('이 비용에 해당하는 당사자를 선택하세요.');
        if (c.kind === '변호사보수') {
          if (owners.some((id) => feeOwners.has(id))) {
            throw Error('같은 심급에서 동일 당사자의 변호사보수가 중복 입력되었습니다.');
          }
          owners.forEach((id) => feeOwners.add(id));
        }
        const value = fraction(basis(c, s, parties));
        if (c.shared && owners.length < 2) throw Error('공동 지출의 귀속 당사자를 두 명 이상 선택하세요.');
        const shares = weights(owners, c.method, s, parties);
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
              : weights(debtors, left ? rule.rightMethod : rule.leftMethod, s, parties);
          debtors.forEach((debtor, k) => {
            const factors = [shares[j], rate, parts[k]];
            lines.push({
              stage: stageLevel(s, index),
              kind: c.title || c.kind,
              owner,
              debtor,
              amount: factors.reduce(product, value),
              order: stageLevel(stages[source], source) + ' · ' + rule.scope,
              formula: [money(value), ...factors.filter((f) => f.n !== f.d).map(ratio)].join(' × '),
            });
          });
        }
      } catch (e) {
        errors.push(
          stageLevel(s, index) +
            ' · ' +
            ((c.shared ? c.ids : [c.payer])
              .filter(Boolean)
              .map((id) => parties.find((p) => p.id === id)?.name || '이름 미입력')
              .join(', ') || '당사자 미선택') +
            ' · ' +
            c.kind +
            ' — ' +
            (e as Error).message
        );
      }
    });
  });
  return { lines: errors.length ? [] : lines, errors, ownerTotals };
}
