export type Valuation = {
  id: string; label: string; stageId: string; claimId: string; partyId: string; opponentId: string;
  purpose: '배분 가중치' | '보수 소가' | '인지 불복액'; kind: '청구' | '항소' | '부대항소'; amount: string;
};
export type BasisGroup = {
  id: string; label: string; stageId: string; mandateId: string; claimIds: string[];
  valueIds: string[]; method: '합산' | '최다액'; note: string;
};
export type AllocationWeight = { kind: 'value' | 'group' | 'fraction'; refId: string; numerator: string; denominator: string };
export type AllocationNode =
  | { id: string; type: 'pair'; ownerId: string; otherId: string; claimId: string; rulingId: string }
  | { id: string; type: 'split'; label: string; method: 'equal' | 'weighted'; branches: AllocationBranch[] };
export type AllocationBranch = { id: string; label: string; weight: AllocationWeight; node: AllocationNode };
export type AllocationPlan = { costId: string; basisGroupId: string; applicationBasis: string; root: AllocationNode };
export type CalculationInput = {
  values: Valuation[]; groups: BasisGroup[]; plans: AllocationPlan[];
  rounding: { unit: '1' | '10' | ''; timing: 'direction' | 'net' | '' };
  setoff: 'unreviewed' | 'mutual' | 'applicantOnly';
};
export function emptyCalculation(): CalculationInput {
  return { values: [], groups: [], plans: [], rounding: { unit: '', timing: '' }, setoff: 'unreviewed' };
}
export function emptyPair(id: string): AllocationNode {
  return { id, type: 'pair', ownerId: '', otherId: '', claimId: '', rulingId: '' };
}

// 저장 형식 검증과 계산 전의 관계·산식 검증을 분리한다.
export function isCalculationInput(x: unknown): x is CalculationInput {
  const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  const text = (v: unknown) => typeof v === 'string' && v.length <= 20000;
  const fields = (v: unknown, keys: string[]) => obj(v) && keys.every(k => text(v[k]));
  const list = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 500 && v.every(text);
  const rows = (v: unknown, check: (r: unknown) => boolean) => Array.isArray(v) && v.length <= 500 && v.every(check);
  if (!obj(x) || !obj(x.rounding) || !['', '1', '10'].includes(String(x.rounding.unit)) ||
      !['', 'direction', 'net'].includes(String(x.rounding.timing)) || !['unreviewed', 'mutual', 'applicantOnly'].includes(String(x.setoff))) return false;
  if (!rows(x.values, v => fields(v, ['id', 'label', 'stageId', 'claimId', 'partyId', 'opponentId', 'purpose', 'kind', 'amount']) &&
      obj(v) && ['배분 가중치', '보수 소가', '인지 불복액'].includes(String(v.purpose)) && ['청구', '항소', '부대항소'].includes(String(v.kind)))) return false;
  if (!rows(x.groups, g => fields(g, ['id', 'label', 'stageId', 'mandateId', 'method', 'note']) && obj(g) &&
      list(g.claimIds) && list(g.valueIds) && ['합산', '최다액'].includes(String(g.method)))) return false;
  function node(v: unknown, depth: number, budget: { count: number }): boolean {
    budget.count++;
    if (depth > 8 || budget.count > 256 || !obj(v) || !text(v.id)) return false;
    if (v.type === 'pair') return fields(v, ['ownerId', 'otherId', 'claimId', 'rulingId']);
    return v.type === 'split' && fields(v, ['label']) && ['equal', 'weighted'].includes(String(v.method)) &&
      Array.isArray(v.branches) && v.branches.length <= 50 && v.branches.every(b => obj(b) && fields(b, ['id', 'label']) &&
        fields(b.weight, ['kind', 'refId', 'numerator', 'denominator']) && obj(b.weight) &&
        ['value', 'group', 'fraction'].includes(String(b.weight.kind)) && node(b.node, depth + 1, budget));
  }
  return rows(x.plans, p => obj(p) && fields(p, ['costId', 'basisGroupId', 'applicationBasis']) && node(p.root, 0, { count: 0 }));
}
