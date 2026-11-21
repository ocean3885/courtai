import { stageLevel, type ApplicationPolicy, type Cost, type Party, type Stage } from './caseInput';
import { ApplicationCostAllocation } from './ApplicationCostAllocation';

type Props = {
  policy: ApplicationPolicy; stages: Stage[]; parties: Party[];
  label: (p: Party) => string; change: (policy: ApplicationPolicy) => void;
};
const control = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';

export function ApplicationBurdenPolicy({ policy, stages, parties, label, change }: Props) {
  const owners = parties.filter(p => p.group === '신청인').map(p => p.id);
  const synthetic: Cost = {
    id: 'application-policy', payer: owners[0] || '', ids: owners, shared: owners.length > 1,
    kind: '', paid: '', refund: '0', method: '', evidence: '', title: '',
    application: {
      ...policy.allocation,
      opponentIds: policy.allocation?.opponentIds ?? parties.filter(p => p.group === '피신청인').map(p => p.id),
    },
  };
  return <div className="space-y-3 rounded-lg border border-blue-300 bg-blue-50/40 p-3" role="group" aria-label="신청비용 공통 부담기준">
    <h3 className="font-bold text-slate-900">신청비용 공통 부담기준</h3>
    <label className="block text-sm">신청비용 부담기준
      <select className={control} value={policy.mode} onChange={e => change({ ...policy, mode: e.target.value as ApplicationPolicy['mode'] })}>
        <option>판결 기준</option><option>별도 기준</option>
      </select>
    </label>
    {policy.mode === '판결 기준' && <>
      <label className="block text-sm">연결할 판결 심급
        <select className={control} value={policy.stageId || stages[0]?.id || ''} onChange={e => change({ ...policy, stageId: e.target.value })}>
          {!stages.length && <option value="">심급을 추가하세요</option>}
          {policy.stageId && !stages.some(s => s.id === policy.stageId) && <option value={policy.stageId}>삭제된 심급 · 다시 선택하세요</option>}
          {stages.map((s, i) => <option key={s.id} value={s.id}>{stageLevel(s, i)}</option>)}
        </select>
      </label>
      {(stages.some(s => s.counter) || policy.claim) && <label className="block text-sm">연결할 판결 청구
        <select className={control} value={policy.claim || ''} onChange={e => change({ ...policy, claim: (e.target.value || undefined) as ApplicationPolicy['claim'] })}>
          <option value="">본소·반소 공통 주문</option><option>본소</option><option>반소</option>
        </select>
      </label>}
      <p className="text-xs text-slate-600">선택한 심급의 판결 부담비율을 연결합니다. 이후 소송총비용 주문이 있으면 해당 상대방의 변경된 비율을 따릅니다. 본소·반소 주문이 다르면 적용할 청구를 한 번 선택하세요.</p>
    </>}
    <ApplicationCostAllocation policyEditor showRates={policy.mode === '별도 기준'} cost={synthetic} parties={parties} label={label}
      update={patch => change({ ...policy, allocation: patch.application })} />
    <p className="text-xs text-slate-600">공통 기준은 모든 신청비용에 적용합니다. 특정 비용만 다르면 해당 비용의 공통 기준 선택을 해제하세요.</p>
  </div>;
}
