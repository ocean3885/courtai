import { isReferenced, type LitigationDraft, type Party } from './litigation-costs-draft';

export type MainInstance = '제1심' | '항소심' | '상고심';
export type SetupResult = { ok: true; draft: LitigationDraft } | { ok: false; error: string };
const ranks: Record<string, number> = { 제1심: 1, 항소심: 2, 환송심: 2, 상고심: 3, 재상고심: 3 };
export function registeredInstance(d: LitigationDraft): MainInstance | null {
  const rank = Math.max(0, ...d.stages.map(s => ranks[s.type] || 0));
  return rank === 3 ? '상고심' : rank === 2 ? '항소심' : rank === 1 ? '제1심' : null;
}

/** Only empty, unreferenced upper stages can be removed by the quick setup. */
export function configureMainStages(d: LitigationDraft, target: MainInstance, ids: string[]): SetupResult {
  const desired = ranks[target];
  const removed = d.stages.filter(s => (ranks[s.type] || 0) > desired);
  if (removed.some(s => isReferenced(d, s.id) || [s.number, s.appealScope, s.changes].some(v => v.trim()))) {
    return { ok: false, error: '상위 심급에 사건 정보 또는 연결된 비용·주문·대리 관계가 있어 변경하지 않았습니다. 심급·청구 변동에서 기존 범위를 확인하세요.' };
  }
  const needed: string[] = ['제1심', ...(desired >= 2 ? ['항소심'] : []), ...(desired >= 3 ? ['상고심'] : []), '확정신청'];
  const missing = needed.filter(type => !d.stages.some(s => s.type === type));
  if (ids.length < missing.length || ids.slice(0, missing.length).some(id => !id || d.stages.some(s => s.id === id)) || new Set(ids.slice(0, missing.length)).size !== missing.length) {
    return { ok: false, error: '절차 식별자를 확인하세요.' };
  }
  return { ok: true, draft: { ...d, stages: [
    ...d.stages.filter(s => !removed.some(r => r.id === s.id)),
    ...missing.map((type, index) => ({ id: ids[index], type, number: type === '확정신청' ? d.meta.number : '',
      partyIds: d.parties.map(p => p.id), appealScope: '', changes: '' })),
  ] } };
}

/** Application role never determines who claims against whom in the main action. */
export function addSetupParty(d: LitigationDraft, party: Party, claimId: string): SetupResult {
  if (d.parties.length >= 500 || !party.id || d.parties.some(p => p.id === party.id)) return { ok: false, error: '당사자 수 또는 식별자를 확인하세요.' };
  if (d.claims.length === 0 && (!claimId || d.claims.some(c => c.id === claimId))) return { ok: false, error: '청구 식별자를 확인하세요.' };
  const main = d.claims.find(c => c.kind === '본소');
  const claimant = party.mainRole === '원고', opponent = party.mainRole === '피고';
  const claims = d.claims.length === 0 ? [{ id: claimId, kind: '본소', title: '본소 청구',
    claimantIds: claimant ? [party.id] : [], opponentIds: opponent ? [party.id] : [], value: '', relation: '' }]
    : d.claims.map(c => c.id === main?.id ? { ...c,
      claimantIds: claimant ? [...new Set([...c.claimantIds, party.id])] : c.claimantIds,
      opponentIds: opponent ? [...new Set([...c.opponentIds, party.id])] : c.opponentIds } : c);
  // New parties in an existing appeal need explicit participation confirmation.
  const stages = d.stages.map(s => ['제1심', '확정신청'].includes(s.type)
    ? { ...s, partyIds: [...new Set([...s.partyIds, party.id])] } : s);
  return { ok: true, draft: { ...d, parties: [...d.parties, party], claims, stages } };
}

/** Keep user-entered application stage numbers; sync only blank or previously linked ones. */
export function updateCaseMeta(d: LitigationDraft, patch: Partial<LitigationDraft['meta']>): LitigationDraft {
  return { ...d, meta: { ...d.meta, ...patch }, stages: patch.number === undefined ? d.stages : d.stages.map(s =>
    s.type === '확정신청' && (!s.number || s.number === d.meta.number) ? { ...s, number: patch.number! } : s) };
}
