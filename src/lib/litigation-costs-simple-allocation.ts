import type { AllocationNode, AllocationPlan } from './litigation-costs-calculation-types';
import type { Cost, LitigationDraft, Ruling } from './litigation-costs-draft';

type PairNode = Extract<AllocationNode, { type: 'pair' }>;
export type SimpleAllocationContext =
  | { status: 'unavailable'; reason: string }
  | {
    status: 'ready'; cost: Cost; ownerId: string; otherId: string; claimId: string;
    application: boolean; rulings: Ruling[]; plan?: AllocationPlan; pair?: PairNode;
  };

// Only one-child equal splits are transparent. Weighted trees retain their scope
// and validation even when there is only one leaf; never silently flatten them.
function singlePair(root: AllocationNode): PairNode | null {
  const seen = new Set<string>();
  let node = root;
  while (true) {
    if (!node.id || seen.has(node.id) || seen.size >= 9) return null;
    seen.add(node.id);
    if (node.type === 'pair') return node;
    if (node.method !== 'equal' || node.branches.length !== 1 || !node.label.trim() ||
        !node.branches[0].id || !node.branches[0].label.trim()) return null;
    node = node.branches[0].node;
  }
}
const ratioValid = (n: string, d: string) => /^\d{1,16}$/.test(n) && /^\d{1,16}$/.test(d) &&
  BigInt(d) > BigInt(0) && BigInt(n) <= BigInt(d) && BigInt(d) <= BigInt(Number.MAX_SAFE_INTEGER);

export function getSimpleAllocationContext(d: LitigationDraft, costId: string): SimpleAllocationContext {
  const no = (reason: string): SimpleAllocationContext => ({ status: 'unavailable', reason });
  if (d.parties.length !== 2 || d.parties.some(p => !p.id) || new Set(d.parties.map(p => p.id)).size !== 2 ||
      d.parties.filter(p => p.applicationRole === '신청인').length !== 1 ||
      d.parties.filter(p => p.applicationRole === '피신청인').length !== 1) {
    return no('간편 입력은 신청인 1명·피신청인 1명인 사건에 적용합니다. 다수 당사자의 몫은 직접 배분하세요.');
  }
  const partyIds = d.parties.map(p => p.id);
  const claim = d.claims[0];
  if (d.claims.length !== 1 || claim.kind !== '본소' || claim.claimantIds.length !== 1 ||
      claim.opponentIds.length !== 1 || claim.claimantIds[0] === claim.opponentIds[0] ||
      ![...claim.claimantIds, ...claim.opponentIds].every(id => partyIds.includes(id))) {
    return no('간편 입력은 당사자 2명이 연결된 본소 1건에 적용합니다. 반소·복수 청구는 직접 배분하세요.');
  }
  const costs = d.costs.filter(c => c.id === costId), cost = costs[0];
  if (costs.length !== 1 || cost.payerIds.length !== 1 || !partyIds.includes(cost.payerIds[0])) {
    return no('비용의 지출·귀속 당사자 한 명을 먼저 선택하세요. 공동 귀속 비용은 직접 배분하세요.');
  }
  const stages = d.stages.filter(s => s.id === cost.stageId), stage = stages[0];
  if (stages.length !== 1 || !['제1심', '항소심', '상고심', '확정신청'].includes(stage.type) ||
      stage.partyIds.length !== 2 || new Set(stage.partyIds).size !== 2 || !partyIds.every(id => stage.partyIds.includes(id))) {
    return no('비용의 발생 절차와 두 당사자의 참여 범위를 먼저 확인하세요. 환송 등 복합 절차는 직접 배분하세요.');
  }
  const application = stage.type === '확정신청';
  if ((!application && (cost.claimIds.length !== 1 || cost.claimIds[0] !== claim.id)) ||
      (application && (cost.claimIds.length > 1 || cost.claimIds.some(id => id !== claim.id)))) {
    return no('비용의 관련 청구를 먼저 확인하세요. 본안 비용은 본소 1건에 연결해야 합니다.');
  }
  if (new Set(cost.targetIds).size !== cost.targetIds.length || cost.targetIds.some(id => !partyIds.includes(id))) {
    return no('기존 배분 대상에 중복되거나 삭제된 당사자가 있습니다. 직접 편집에서 연결을 확인하세요.');
  }
  const ownerId = cost.payerIds[0], otherId = partyIds.find(id => id !== ownerId)!;
  const claimId = cost.claimIds.length ? claim.id : '';
  const plans = d.calculation.plans.filter(p => p.costId === costId);
  if (plans.length > 1) return no('동일 비용의 계산 계획이 중복되어 있습니다. 직접 편집에서 확인하세요.');
  const plan = plans[0], pair = plan ? singlePair(plan.root) : undefined;
  if (plan && (!pair || (pair.ownerId && pair.ownerId !== ownerId) ||
      (pair.otherId && pair.otherId !== otherId) || (pair.claimId && pair.claimId !== claimId))) {
    return no('기존 계획에 분기·가중치 또는 다른 귀속 관계가 있습니다. 기존 경로를 보존하며 직접 편집합니다.');
  }
  const rulingCounts = new Map<string, number>();
  d.rulings.forEach(r => rulingCounts.set(r.id, (rulingCounts.get(r.id) || 0) + 1));
  const rulings = d.rulings.filter(r =>
    r.id && rulingCounts.get(r.id) === 1 &&
    r.payerIds.length === 1 && r.receiverIds.length === 1 && r.payerIds[0] !== r.receiverIds[0] &&
    [r.payerIds[0], r.receiverIds[0]].every(id => partyIds.includes(id)) &&
    r.stageIds.length > 0 && new Set(r.stageIds).size === r.stageIds.length &&
    r.stageIds.every(id => d.stages.some(s => s.id === id)) &&
    (r.stageIds.includes(cost.stageId) || application) &&
    new Set(r.claimIds).size === r.claimIds.length && r.claimIds.every(id => id === claim.id) &&
    (!claimId || r.claimIds.includes(claimId)) && r.text.trim() &&
    ratioValid(r.numerator, r.denominator) && ratioValid(r.reverseNumerator, r.reverseDenominator));
  return { status: 'ready', cost, ownerId, otherId, claimId, application, rulings, plan, pair: pair || undefined };
}

export type SimpleAllocationSelection = { rulingId: string; applicationBasis: string };
export type SimpleAllocationResult = { ok: true; draft: LitigationDraft } | { ok: false; error: string };

// Explicit apply is atomic: synchronize the executable plan and cost scope,
// retaining original amounts, evidence, notes, basis group and existing tree.
export function applySimpleAllocation(d: LitigationDraft, costId: string, selection: SimpleAllocationSelection, nodeId: string): SimpleAllocationResult {
  const context = getSimpleAllocationContext(d, costId);
  if (context.status === 'unavailable') return { ok: false, error: context.reason };
  const ruling = context.rulings.find(r => r.id === selection.rulingId);
  if (!ruling) return { ok: false, error: '적용할 부담 관계를 선택하세요. 주문의 당사자·심급·청구·양방향 비율도 확인하세요.' };
  if (context.application && !ruling.stageIds.includes(context.cost.stageId) && !selection.applicationBasis.trim()) {
    return { ok: false, error: '신청비용에 다른 절차의 부담 주문을 적용하려면 준용 근거를 입력하세요.' };
  }
  if (!context.plan && !nodeId) return { ok: false, error: '계산 계획 식별자를 만들지 못했습니다.' };
  const pair: PairNode = { id: context.pair?.id || nodeId, type: 'pair', ownerId: context.ownerId,
    otherId: context.otherId, claimId: context.claimId, rulingId: ruling.id };
  function replaceLeaf(node: AllocationNode): AllocationNode {
    if (node.type === 'pair') return pair;
    return { ...node, branches: node.branches.map(branch => ({ ...branch, node: replaceLeaf(branch.node) })) };
  }
  const plan: AllocationPlan = {
    costId, basisGroupId: context.plan?.basisGroupId || '', applicationBasis: selection.applicationBasis,
    root: context.plan ? replaceLeaf(context.plan.root) : pair,
  };
  return { ok: true, draft: { ...d,
    costs: d.costs.map(c => c.id === costId ? { ...c, targetIds: [context.ownerId, context.otherId],
      allocation: '직접 귀속', reason: c.reason || '비용 귀속자에게 전액 귀속한 뒤 선택한 부담 주문의 비율 적용' } : c),
    calculation: { ...d.calculation, plans: context.plan
      ? d.calculation.plans.map(p => p.costId === costId ? plan : p)
      : [...d.calculation.plans, plan] },
  } };
}
