import {
  isApplicantSideParty,
  stageLevel,
  type Cost,
  type CostClaim,
  type MemberValueType,
  type Party,
  type RecordedValue,
  type Rule,
  type Stage,
  type ValueMode,
} from './caseInput';
import { ordinaryFeeLimit } from './ordinaryFee';
import { relationAmounts } from './relationValues';

export type Amount = { n: bigint; d: bigint };
const zero = BigInt(0);
const one = BigInt(1);
export function fraction(n: bigint, d = one): Amount {
  let a = n < zero ? -n : n,
    b = d;
  while (b) [a, b] = [b, a % b];
  return { n: n / a, d: d / a };
}
export const add = (a: Amount, b: Amount) => fraction(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a: Amount, b: Amount) => add(a, { n: -b.n, d: b.d });
export const product = (a: Amount, b: Amount) => fraction(a.n * b.n, a.d * b.d);
export const nothing = fraction(zero);
export const money = (a: Amount) =>
  a.d === one
    ? a.n.toLocaleString('ko-KR') + '원'
    : a.n.toLocaleString('ko-KR') + '/' + a.d.toLocaleString('ko-KR') + '원';
const ratio = (a: Amount) => a.n + '/' + a.d;
export type CalculationMode = '단계별10원' | '정밀';
export type CalculationStep = {
  label: string; input: Amount; factor: Amount; raw: Amount; amount: Amount; discarded: Amount;
};

// Identity factors do not create an allocation step: an expense of 961 won
// stays 961 won when no division or partial burden is applied.
export function calculateSteps(value: Amount, factors: { label: string; factor: Amount }[], mode: CalculationMode = '단계별10원') {
  let amount = value;
  const steps: CalculationStep[] = [];
  for (const { label, factor } of factors) {
    if (factor.n === factor.d) continue;
    const raw = product(amount, factor);
    const used = mode === '단계별10원' ? fraction(raw.n / raw.d / BigInt(10) * BigInt(10)) : raw;
    steps.push({ label, input: amount, factor, raw, amount: used, discarded: subtract(raw, used) });
    amount = used;
  }
  const exactAmount = factors.reduce((acc, step) => product(acc, step.factor), value);
  return { amount, exactAmount, steps,
    formula: steps.length ? steps.map(s => `${s.label}: ${money(s.input)} × ${ratio(s.factor)} = ${money(s.raw)}${mode === '단계별10원' ? ` → ${money(s.amount)} (10원 미만 버림)` : ''}`).join(' → ') : money(value),
  };
}
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
  if (!s.counter || !s.mainValueTarget || (s.mainValueTarget === '신청인측') === isApplicantSideParty(p)) {
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
  if (s.counter && (s.counterFeeMode || cost.claim)) {
    const claim = cost.claim || '공통';
    const owners = (cost.shared ? cost.ids : [cost.payer]).filter(Boolean);
    if (!owners.length) return null;
    const claimValue = (counter: boolean) => {
      const whole = counter ? counterEffectiveValue(s, parties) : stageEffectiveValue(s, parties);
      if (!s.mainValueTarget) return whole;
      const targetApplicantSide = counter ? s.mainValueTarget === '피신청인측' : s.mainValueTarget === '신청인측';
      const useIndividual = counter ? s.useCounterIndividualValues : s.useIndividualValues;
      if (useIndividual && owners.every(id => {
        const p = parties.find(p => p.id === id);
        return p && isApplicantSideParty(p) === targetApplicantSide;
      })) {
        if (owners.some(id => stageMemberValue(s, id, counter) === null)) return null;
        return combineStageMemberValues(s, owners, sideValueMode(s, targetApplicantSide, counter), counter);
      }
      return whole;
    };
    if (claim === '본소') return claimValue(false);
    if (claim === '반소') return claimValue(true);
    const main = claimValue(false), counter = claimValue(true);
    if (main === null || counter === null || !s.counterFeeMode) return null;
    return combinePartyValues([main, counter], s.counterFeeMode);
  }
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
  const mode = sideValueMode(s, isApplicantSide);
  const ownerValues = owners.map((id) => stageMemberValue(s, id));
  if (ownerValues.every((v): v is bigint => v !== null)) {
    return combineStageMemberValues(s, owners, mode);
  }
  if (s.useIndividualValues === true && (cost.shared || ownerValues.some(v => v !== null))) return null;
  if (s.mainValueTarget && (s.mainValueTarget === '신청인측') !== isApplicantSide) {
    return manualValue ?? stageEffectiveValue(s, parties);
  }
  return sideEffectiveValue(s, parties, isApplicantSide) ?? manualValue ?? stageEffectiveValue(s, parties);
}

export function expenseNet(c: Cost) {
  const net = integer(c.paid, c.kind === '변호사보수' ? '변호사보수액' : '납부액') - integer(c.refund, '환급액');
  if (net < zero) throw Error('환급액이 납부액을 초과합니다.');
  return net;
}
export type ReviewedExpense = {
  cost: Cost;
  owners: string[];
  paid: bigint;
  refund: bigint;
  net: bigint;
  recognized: bigint;
  feeBasis: bigint | null;
  feeLimit: bigint | null;
};
function reviewExpense(cost: Cost, s: Stage, parties: Party[]): ReviewedExpense {
  const net = expenseNet(cost);
  const feeBasis = cost.kind === '변호사보수' ? resolveFeeBasisValue(cost, s, parties) : null;
  const feeLimit = feeBasis === null ? null : ordinaryFeeLimit(feeBasis);
  if (cost.kind === '변호사보수' && s.counter && (s.counterFeeMode || cost.claim) && feeBasis === null)
    throw Error('보수 대리 범위에 해당하는 본소·반소 소가와 합산·다액흡수 기준을 확인하세요.');
  let recognized = net;
  if (cost.recognized) {
    const reviewed = integer(cost.recognized, '검토 인정액');
    if (reviewed > net) throw Error(cost.kind === '변호사보수' ? '검토 인정액이 입력한 변호사보수액을 초과합니다.' : '검토 인정액이 실지출액을 초과합니다.');
    if (feeLimit !== null && reviewed > feeLimit)
      throw Error('보수 인정액이 일반 본안 한도를 초과합니다.');
    recognized = reviewed;
  } else if (cost.kind === '변호사보수') {
    if (feeLimit === null) throw Error('당사자 소가 또는 보수의 증빙 검토 인정액을 입력하세요.');
    recognized = feeLimit < net ? feeLimit : net;
  }
  return { cost, owners: (cost.shared ? cost.ids : [cost.payer]).filter(Boolean),
    paid: BigInt(cost.paid), refund: BigInt(cost.refund), net, recognized, feeBasis, feeLimit };
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
export function burden(rule: Rule, ownerOnLeft: boolean) {
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
type SpecificClaim = '본소' | '반소';
export function needsClaimAllocation(stages: Stage[], index: number, ownerIds?: string[]): boolean {
  return stages.some((s, i) => i >= index && s.rules.some(r =>
    (i === index || r.scope === '소송총비용') && (r.claim === '본소' || r.claim === '반소') &&
    (!ownerIds?.length || ownerIds.some(id => includesOwner(r, id)))
  ));
}

export function inferredCostClaim(c: Cost, s: Stage, parties: Party[]): CostClaim | undefined {
  if (c.claim) return c.claim;
  if (!s.counter) return '본소';
  if (c.kind !== '인지대') return '공통';
  const owners = (c.shared ? c.ids : [c.payer]).filter(Boolean);
  const claims = owners.map(id => {
    const m = s.members[id];
    if (m?.counterRole === '반소원고') return '반소';
    if (m?.role === '원고') return '본소';
    const p = parties.find(p => p.id === id);
    if (s.mainValueTarget && p)
      return (s.mainValueTarget === '신청인측') === isApplicantSideParty(p) ? '본소' : '반소';
    return undefined;
  });
  return claims.length && claims[0] && claims.every(c => c === claims[0]) ? claims[0] : undefined;
}

function claimPortions(c: Cost, stages: Stage[], index: number, parties: Party[]): { claim?: SpecificClaim; weight: Amount; label: string }[] {
  const s = stages[index];
  const separate = needsClaimAllocation(stages, index, c.shared ? c.ids : [c.payer]);
  const claim = inferredCostClaim(c, s, parties);
  if (!separate) return [{ claim: claim === '본소' || claim === '반소' ? claim : undefined, weight: fraction(one), label: '' }];
  if (!claim) throw Error('인지대가 본소·반소 중 어느 청구의 비용인지 선택하세요.');
  if (claim !== '공통') return [{ claim, weight: fraction(one), label: claim }];
  const split = c.claimSplit || (c.kind === '변호사보수' ? '소가 비율' : '균분');
  if (split === '균분') return [
    { claim: '본소' as const, weight: fraction(one, BigInt(2)), label: '본소 · 공통비용 균분' },
    { claim: '반소' as const, weight: fraction(one, BigInt(2)), label: '반소 · 공통비용 균분' },
  ];
  const main = stageEffectiveValue(s, parties), counter = counterEffectiveValue(s, parties);
  if (main === null || counter === null || main + counter === zero)
    throw Error('공통비용의 본소·반소 소가 비율을 계산할 소가를 확인하세요.');
  return [
    { claim: '본소' as const, weight: fraction(main, main + counter), label: '본소 · 공통비용 소가 비율' },
    { claim: '반소' as const, weight: fraction(counter, main + counter), label: '반소 · 공통비용 소가 비율' },
  ].filter(p => p.weight.n !== zero);
}

type RuleRoute = { debtor: string; rule: Rule; source: number; baseRule: Rule };

function oppositeIds(rule: Rule, owner: string): string[] {
  if (!rule.left.length || !rule.right.length) throw Error('부담 관계 양측 당사자를 선택하세요.');
  if (new Set([...rule.left, ...rule.right]).size !== rule.left.length + rule.right.length)
    throw Error('부담 관계에 중복된 당사자가 있습니다.');
  return rule.left.includes(owner) ? rule.right : rule.left;
}

export function resolveRuleRoutes(stages: Stage[], index: number, id: string, selected?: string, claim?: SpecificClaim): RuleRoute[] {
  const matches = (r: Rule, s: Stage) => includesOwner(r, id) &&
    (!claim || r.claim === claim || r.claim === '본소와 반소' || (!s.counter && !r.claim));
  let baseRules = stages[index].rules.filter((r) => matches(r, stages[index]));
  if (selected) {
    baseRules = baseRules.filter((r) => r.id === selected);
    if (!baseRules.length) throw Error('선택한 부담 관계에 비용 귀속자가 포함되는지 확인하세요.');
  }
  const originalMembers = Object.keys(stages[index].members);
  let baseSource = index;
  // Without an earlier order, the first total-cost order must explain the full
  // original relationship. A partial later order cannot invent the missing part.
  if (!baseRules.length) {
    for (let i = index + 1; i < stages.length; i++) {
      const later = stages[i].rules.filter(r => r.scope === '소송총비용' && matches(r, stages[i]));
      if (!later.length) continue;
      const covered = new Set(later.flatMap(r => [...r.left, ...r.right]));
      if (covered.size !== originalMembers.length || originalMembers.some(id => !covered.has(id)))
        throw Error('종전 심급의 비용 범위와 소송총비용 주문의 대상 당사자를 확인하세요.');
      baseRules = later;
      baseSource = i;
      break;
    }
  }
  if (!baseRules.length) throw Error('이 비용에 적용할 부담 관계를 입력하세요.');
  const validate = (r: Rule, source: number) => {
    if ((stages[index].counter || stages[source].counter) && !claim && r.claim !== '본소와 반소')
      throw Error('부담 관계의 적용 청구를 확인하세요.');
    if ([...r.left, ...r.right].some(id => !originalMembers.includes(id)))
      throw Error('부담 관계에 해당 비용 발생 심급의 참여자가 아닌 당사자가 포함되어 있습니다.');
    if ([...r.left, ...r.right].some(id => !stages[source].members[id]))
      throw Error('부담 관계의 해당 심급 참여자를 확인하세요.');
    return oppositeIds(r, id);
  };
  const routes = new Map<string, RuleRoute>();
  for (const rule of baseRules) {
    for (const debtor of validate(rule, baseSource)) {
      if (routes.has(debtor)) throw Error('같은 상대방에 적용할 부담 관계가 겹칩니다. 비용의 적용 관계를 선택하거나 주문 범위를 정리하세요.');
      routes.set(debtor, { debtor, rule, source: baseSource, baseRule: rule });
    }
  }
  for (let i = baseSource + 1; i < stages.length; i++) {
    const later = stages[i].rules.filter(r => r.scope === '소송총비용' && matches(r, stages[i]));
    const seen = new Set<string>();
    for (const rule of later) {
      for (const debtor of validate(rule, i)) {
        const original = routes.get(debtor);
        if (!original) {
          if (selected) continue; // An explicitly restricted cost keeps its scope.
          throw Error('소송총비용 주문에 종전 비용의 배분 대상 외 당사자가 포함되어 있습니다. 비용 범위를 확인하세요.');
        }
        if (seen.has(debtor)) throw Error('같은 상대방의 소송총비용 주문이 겹칩니다. 상급심 주문 범위를 정리하세요.');
        seen.add(debtor);
        routes.set(debtor, { ...original, rule, source: i });
      }
    }
  }
  return [...routes.values()];
}

function opponentMethod(routes: RuleRoute[], owner: string, cost: Cost): string | undefined {
  if (cost.opponentMethod) return cost.opponentMethod;
  if (routes.length === 1) return '균분';
  const methods = new Set([...new Set(routes.map(r => r.baseRule))].flatMap(r => {
    const method = r.left.includes(owner) ? r.rightMethod : r.leftMethod;
    return method ? [method === '소가 비율' ? '안분' : method] : [];
  }));
  return methods.size === 1 ? [...methods][0] : undefined;
}

export function opponentAllocationGroups(cost: Cost, stages: Stage[], index: number, parties: Party[]) {
  const groups: { owner: string; claim?: SpecificClaim; ids: string[]; method?: string; multipleRules: boolean; laterOrder: boolean }[] = [];
  try {
    const portions = claimPortions(cost, stages, index, parties);
    for (const owner of (cost.shared ? cost.ids : [cost.payer]).filter(Boolean)) {
      for (const p of portions) {
        const selected = p.claim === '본소' ? cost.mainRuleId || cost.ruleId : p.claim === '반소' ? cost.counterRuleId || cost.ruleId : cost.ruleId;
        const routes = resolveRuleRoutes(stages, index, owner, selected, p.claim);
        groups.push({ owner, claim: p.claim, ids: routes.map(r => r.debtor), method: opponentMethod(routes, owner, cost), multipleRules: new Set(routes.map(r => r.baseRule)).size > 1, laterOrder: routes.some(r => r.source > index) });
      }
    }
  } catch {
    // Incomplete inputs are explained by reviewCosts; the editor remains usable.
  }
  return groups;
}
type Line = {
  costId: string;
  stageId: string;
  stage: string;
  kind: string;
  owner: string;
  debtor: string;
  amount: Amount;
  formula: string;
  order: string;
  exactAmount: Amount;
  steps: CalculationStep[];
};
export function reviewCosts(stages: Stage[], parties: Party[], mode: CalculationMode = '단계별10원') {
  const lines: Line[] = [],
    errors: string[] = [];
  const ownerTotals = new Map<string, Amount>();
  const expenses: (ReviewedExpense & { stageId: string })[] = [];
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
        const expense = reviewExpense(c, s, parties);
        const value = fraction(expense.recognized);
        if (c.shared && owners.length < 2) throw Error('공동 지출의 귀속 당사자를 두 명 이상 선택하세요.');
        const shares = weights(owners, c.method, s, parties);
        const portions = claimPortions(c, stages, index, parties);
        const pending: Line[] = [];
        const pendingTotals = new Map<string, Amount>();
        for (const [j, owner] of owners.entries()) {
          const owned = product(value, shares[j]);
          pendingTotals.set(owner, owned);
          for (const portion of portions) {
            const selected = portion.claim === '본소' ? c.mainRuleId || c.ruleId : portion.claim === '반소' ? c.counterRuleId || c.ruleId : c.ruleId;
            const routes = resolveRuleRoutes(stages, index, owner, selected, portion.claim);
            const method = opponentMethod(routes, owner, c);
            const allZero = routes.every(r => burden(r.rule, r.rule.left.includes(owner)).n === zero);
            if (!allZero && routes.length > 1 && !method)
              throw Error('상대방 전체의 비용 배분 기준(균분/안분)을 선택하세요.');
            const counterpartIds = routes.map(r => r.debtor);
            const ownerParty = parties.find(p => p.id === owner);
            const counterRelations = portion.claim === '반소' || (!portion.claim && Boolean(s.counter && s.mainValueTarget && ownerParty &&
              (s.mainValueTarget === '신청인측') !== isApplicantSideParty(ownerParty)));
            const related = !allZero && method !== '균분' ? relationAmounts(s, parties, owner, counterpartIds, counterRelations) : null;
            const relatedSum = related?.reduce((sum, n) => sum + n, zero);
            if (related && !relatedSum) throw Error('안분할 관계별 소가 합계가 0원입니다.');
            const parts = allZero ? routes.map(() => fraction(one)) : related
              ? related.map(n => fraction(n, relatedSum!)) : weights(counterpartIds, method || '', s, parties);
            routes.forEach(({ debtor, rule, source }, k) => {
              const rate = burden(rule, rule.left.includes(owner));
              const calculation = calculateSteps(value, [
                { label: '본소·반소 배분', factor: portion.weight },
                { label: '공동비용 귀속', factor: shares[j] },
                { label: related ? '상대방별 배분 (관계별 소가)' : '상대방별 배분', factor: parts[k] },
                { label: '부담률 적용', factor: rate },
              ], mode);
              pending.push({
                costId: c.id,
                stageId: s.id,
                stage: stageLevel(s, index),
                kind: (c.title || c.kind) + (portion.label ? ' · ' + portion.label : ''),
                owner,
                debtor,
                ...calculation,
                order: stageLevel(stages[source], source) + ' · ' + rule.scope,
              });
            });
          }
        }
        lines.push(...pending);
        pendingTotals.forEach((amount, owner) => ownerTotals.set(owner, add(ownerTotals.get(owner) ?? nothing, amount)));
        expenses.push({ ...expense, stageId: s.id });
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
  return { lines: errors.length ? [] : lines, errors, ownerTotals, expenses };
}
