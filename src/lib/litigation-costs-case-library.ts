import definitions from './fixtures/litigation-costs-cases.json';
import { blankDraft, type Claim, type LitigationDraft, type Party } from './litigation-costs-draft';
import type { AllocationBranch, AllocationNode, AllocationWeight } from './litigation-costs-calculation-types';
import type { CalculationResult } from './litigation-costs-calculator';

type CaseRule = {
  id: string; applicantId: string; respondentId: string; forward: string[]; reverse: string[];
  claimIds: string[]; stageIds: string[]; payerIds?: string[]; note?: string;
};
type CaseCost = {
  id: string; title: string; kind: string; stageId: string; recognized: string;
  basis: { claimId: string; amount: string }[];
  owners: { ownerId: string; weight: string; routes: { otherId: string; claimId: string; ruleId: string; weight: string }[] }[];
};
export type ReferenceCase = {
  id: string; title: string; category: '기본' | '특수'; shape: string; provenance: '원문 사례' | '구조 재구성';
  sourcePages: string; sourceDocument: string; order: string; note: string; limitations: string;
  parties: Party[]; claims: Claim[]; stages: { id: string; type: string; partyIds: string[] }[];
  rules: CaseRule[]; costs: CaseCost[]; sourceAmounts: { applicantId: string; respondentId: string; net: string }[];
  rounding: { unit: '1' | '10'; timing: 'direction' | 'net' }; setoff: 'mutual' | 'applicantOnly';
  expectedStatus: 'preview' | 'blocked'; expectedError: string;
};
// 프로젝트에 포함한 검증 자료. 사용자 입력·업로드에 이 형식 단언을 사용하지 않는다.
export const referenceCases = definitions as ReferenceCase[];
export function findReferenceCase(id: string | undefined) { return referenceCases.find(c => c.id === id); }

/** 실무서의 인정액과 명시적 배분을 입력 형식으로 옮긴다. 보수 한도를 산정하지 않는다. */
export function referenceCaseDraft(id: string): LitigationDraft {
  const entry = findReferenceCase(id);
  if (!entry) throw new Error('알 수 없는 검증 사례입니다.');
  return draftFromReferenceCase(entry);
}

export function draftFromReferenceCase(entry: ReferenceCase): LitigationDraft {
  const id = entry.id;
  const d = blankDraft();
  d.referenceCaseId = id;
  d.meta = {
    title: `${id} · ${entry.title}`, court: '검증 사례 법원', number: '사례카확○○', applicationDate: '', requested: '',
    scopeNote: `${entry.provenance} · ${entry.sourceDocument} · ${entry.sourcePages}${entry.provenance === '원문 사례' ? '쪽' : ''}. ${entry.limitations}`,
  };
  d.parties = entry.parties.map(p => ({ ...p }));
  d.claims = entry.claims.map(c => ({ ...c, claimantIds: [...c.claimantIds], opponentIds: [...c.opponentIds] }));
  d.stages = entry.stages.map(s => ({ ...s, partyIds: [...s.partyIds], number: `${id}-${s.id}`, appealScope: '검증 자료에 명시한 참여·배분 범위', changes: '' }));
  d.rulings = entry.rules.map(r => ({
    id: r.id, text: `${entry.order}${r.note ? ` ${r.note}` : ''} (자료의 주문 요약·관계별 비율; 실제 주문의 적용 범위는 별도 검토)`,
    stageIds: [...r.stageIds], claimIds: [...r.claimIds], payerIds: r.payerIds ? [...r.payerIds] : [r.respondentId], receiverIds: [r.applicantId],
    numerator: r.forward[0], denominator: r.forward[1], reverseNumerator: r.reverse[0], reverseDenominator: r.reverse[1], status: '미확인',
  }));
  d.review.notes = `${entry.note} ${entry.limitations}`.trim();
  if (entry.setoff === 'applicantOnly') {
    d.review.setoff = id === 'B09' ? '제111조 제2항 예외 검토' : '개별 검토 필요';
    // S01은 자료의 피고 지출액만 제시한 예시이며 미제출 사실을 추정하지 않는다.
    if (id === 'B09') d.review.responseState = '기간 내 미제출';
  }
  d.calculation.rounding = { ...entry.rounding };
  d.calculation.setoff = entry.setoff;
  let nextId = 0;
  const uid = (prefix: string) => `${id}-${prefix}-${++nextId}`;
  const valueCache = new Map<string, string>();
  function value(stageId: string, claimId: string, partyId: string, amount: string, purpose: '배분 가중치' | '보수 소가') {
    const key = JSON.stringify([stageId, claimId, partyId, amount, purpose]);
    const found = valueCache.get(key);
    if (found) return found;
    const valueId = uid('value');
    const party = d.parties.find(p => p.id === partyId)?.name;
    const claim = d.claims.find(c => c.id === claimId)?.kind;
    d.calculation.values.push({ id: valueId, label: `${d.stages.find(s => s.id === stageId)?.type} ${claim} ${party || '전체'} ${purpose}`, stageId, claimId, partyId, opponentId: '', purpose, kind: '청구', amount });
    valueCache.set(key, valueId);
    return valueId;
  }
  const equalWeight = (): AllocationWeight => ({ kind: 'fraction', refId: '', numerator: '1', denominator: '1' });
  for (const cost of entry.costs) {
    const ownerIds = cost.owners.map(o => o.ownerId);
    const claimIds = [...new Set(cost.owners.flatMap(o => o.routes.map(r => r.claimId)))];
    d.costs.push({
      id: cost.id, title: cost.title, kind: cost.kind, stageId: cost.stageId, payerIds: ownerIds, claimIds,
      claimed: cost.recognized, refund: '0', recognized: cost.recognized,
      evidence: `${entry.sourceDocument} · ${entry.sourcePages}${entry.provenance === '원문 사례' ? '쪽' : ''}`,
      allocation: '개별 검토', targetIds: [...new Set([...ownerIds, ...cost.owners.flatMap(o => o.routes.map(r => r.otherId))])],
      reason: '자료에 명시한 귀속 가중치 → 관계별 배분 → 해당 부담 비율. 신청비용은 이 사례에서 선택한 경로만 반영.',
      note: '자료의 환급 후 인정액. 현행 보수 한도 자동 산정값이 아닙니다.',
    });
    let basisGroupId = '';
    if (cost.kind === '변호사보수') {
      const mandateId = uid('mandate');
      d.mandates.push({ id: mandateId, name: `${cost.title} 대리 범위`, partyIds: [...ownerIds], stageIds: [cost.stageId], claimIds: [...claimIds], start: '', end: '', endReason: '', agreed: '', paid: '', evidence: '사례 자료의 공동대리·인정액을 전사. 선임일·계약서 등은 별도 자료 없음.' });
      basisGroupId = uid('group');
      d.calculation.groups.push({
        id: basisGroupId, label: `${cost.title} 소가 기초`, stageId: cost.stageId, mandateId, claimIds: [...claimIds],
        valueIds: cost.basis.map(b => value(cost.stageId, b.claimId, '', b.amount, '보수 소가')), method: '합산',
        note: '사례 자료가 채택한 보수 산정 기초. 합산 여부·중복 청구의 법률상 적정성을 자동 판단하지 않음.',
      });
    }
    const ownerEqual = cost.owners.every(o => o.weight === '1');
    const branches: AllocationBranch[] = cost.owners.map(owner => {
      const routeEqual = owner.routes.every(r => r.weight === '1');
      const routes: AllocationBranch[] = owner.routes.map(route => ({
        id: uid('route'), label: `${d.parties.find(p => p.id === route.otherId)?.name} · ${d.claims.find(c => c.id === route.claimId)?.kind}`,
        weight: routeEqual ? equalWeight() : { kind: 'value', refId: value(cost.stageId, route.claimId, route.otherId, route.weight, '배분 가중치'), numerator: '', denominator: '' },
        node: { id: uid('pair'), type: 'pair', ownerId: owner.ownerId, otherId: route.otherId, claimId: route.claimId, rulingId: route.ruleId },
      }));
      const node: AllocationNode = { id: uid('routes'), type: 'split', label: '관계별 배분', method: routeEqual ? 'equal' : 'weighted', branches: routes };
      return {
        id: uid('owner'), label: d.parties.find(p => p.id === owner.ownerId)?.name || owner.ownerId,
        weight: ownerEqual ? equalWeight() : { kind: 'value', refId: value(cost.stageId, claimIds[0], owner.ownerId, owner.weight, '배분 가중치'), numerator: '', denominator: '' }, node,
      };
    });
    d.calculation.plans.push({ costId: cost.id, basisGroupId,
      applicationBasis: d.stages.find(s => s.id === cost.stageId)?.type === '확정신청' ? '해당 사례가 채택한 신청비용 부담 경로. 일반 규칙으로 확정하지 않으며 실제 사건에서 별도 검토.' : '',
      root: { id: uid('owners'), type: 'split', label: '지출 비용의 당사자별 귀속', method: ownerEqual ? 'equal' : 'weighted', branches },
    });
  }
  return d;
}

export function matchesReferenceCase(draft: LitigationDraft): boolean {
  return !!findReferenceCase(draft.referenceCaseId) && JSON.stringify(draft) === JSON.stringify(referenceCaseDraft(draft.referenceCaseId!));
}
export function compareReferenceAmounts(entry: ReferenceCase, result: CalculationResult) {
  if (result.status !== 'preview') return [];
  return entry.sourceAmounts.map(source => {
    const row = result.rows.find(r => r.applicantId === source.applicantId && r.respondentId === source.respondentId);
    return { ...source, computed: row?.net ?? null, difference: row ? String(BigInt(row.net) - BigInt(source.net)) : null };
  });
}
