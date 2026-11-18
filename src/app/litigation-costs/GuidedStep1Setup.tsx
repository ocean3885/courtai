'use client';

import { useState } from 'react';
import { isReferenced, type LitigationDraft } from '@/lib/litigation-costs-draft';
import { addSetupParty, configureMainStages, registeredInstance, type MainInstance } from '@/lib/litigation-costs-basic-setup';
import { primary, secondary } from './form-controls';

const instances: { value: MainInstance; label: string }[] = [
  { value: '제1심', label: '1심 사건 구성' }, { value: '항소심', label: '항소심까지 구성' }, { value: '상고심', label: '상고심까지 구성' },
];
export function GuidedStep1Setup({ draft, onChange }: {
  draft: LitigationDraft; onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const [newApplicantRole, setNewApplicantRole] = useState<'원고' | '피고' | null>(null);
  const [message, setMessage] = useState('');
  const instance = registeredInstance(draft);
  const applicantRole = newApplicantRole || (draft.parties.find(p => p.applicationRole === '신청인')?.mainRole === '피고' ? '피고' : '원고');
  const counterclaim = draft.claims.some(c => c.kind === '반소');

  const canStart = !draft.parties.length && !draft.claims.length && !draft.stages.length;
  function startBasic(role: '원고' | '피고') {
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
    onChange(old => {
      if (old.parties.length || old.claims.length || old.stages.length) return old;
      const first = addSetupParty(old, { id: ids[0], name: '', mainRole: role, applicationRole: '신청인' }, ids[2]);
      if (!first.ok) return old;
      const second = addSetupParty(first.draft, { id: ids[1], name: '', mainRole: role === '원고' ? '피고' : '원고', applicationRole: '피신청인' }, ids[2]);
      if (!second.ok) return old;
      const stages = configureMainStages(second.draft, '제1심', ids.slice(3));
      return stages.ok ? stages.draft : old;
    });
    setMessage('아래에 신청인과 피신청인의 이름을 입력하세요.');
  }
  function configure(target: MainInstance) {
    const ids = Array.from({ length: 4 }, () => crypto.randomUUID());
    const result = configureMainStages(draft, target, ids);
    if (!result.ok) { setMessage(result.error); return; }
    onChange(old => { const latest = configureMainStages(old, target, ids); return latest.ok ? latest.draft : old; });
    setMessage('본안 심급과 확정신청 절차를 구성했습니다. 심급·청구 변동에서 사건번호와 참여 범위를 확인하세요.');
  }
  function addParty(applicationRole: '신청인' | '피신청인') {
    const mainRole = applicationRole === '신청인' ? applicantRole : applicantRole === '원고' ? '피고' : '원고';
    const party = { id: crypto.randomUUID(), name: '', mainRole, applicationRole }, claimId = crypto.randomUUID();
    const result = addSetupParty(draft, party, claimId);
    if (!result.ok) { setMessage(result.error); return; }
    onChange(old => { const latest = addSetupParty(old, party, claimId); return latest.ok ? latest.draft : old; });
    setMessage('아래 전체 당사자 목록에 추가했습니다. 성명과 본안·신청 지위를 확인하세요.');
  }
  function toggleCounterclaim(checked: boolean) {
    if (checked) {
      const main = draft.claims.find(c => c.kind === '본소');
      if (!main?.claimantIds.length || !main.opponentIds.length) { setMessage('본소의 청구자·상대방을 먼저 등록하세요.'); return; }
      const id = crypto.randomUUID();
      onChange(old => old.claims.some(c => c.kind === '반소') ? old : { ...old, claims: [...old.claims,
        { id, kind: '반소', title: '반소 청구', claimantIds: [...main.opponentIds], opponentIds: [...main.claimantIds], value: '', relation: '' }] });
      setMessage('본소의 상대방 관계를 기준으로 반소를 추가했습니다. 실제 반소 당사자 범위를 아래에서 확인하세요.');
    } else {
      const counters = draft.claims.filter(c => c.kind === '반소');
      if (counters.some(c => isReferenced(draft, c.id) || c.value || c.relation)) { setMessage('반소에 입력값 또는 연결된 비용·주문이 있어 보존했습니다. 청구 관계에서 연결을 확인하세요.'); return; }
      onChange(old => ({ ...old, claims: old.claims.filter(c => c.kind !== '반소' || isReferenced(old, c.id) || c.value || c.relation) }));
      setMessage('연결된 자료가 없는 반소를 제거했습니다.');
    }
  }
  return <div data-testid="guided-step1" className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5">
    {canStart && <div><h3 className="font-semibold">1심 본소 · 신청인과 피신청인 각 1명</h3>
      <p className="my-2 text-sm text-slate-600">누가 신청했나요? 선택하면 본소와 두 절차의 당사자가 함께 등록됩니다.</p>
      <div className="flex flex-wrap gap-2">{(['원고', '피고'] as const).map(role => <button key={role} type="button" className={primary} onClick={() => startBasic(role)}>{role}가 신청</button>)}</div></div>}
    <details><summary className="cursor-pointer text-sm font-semibold">심급·당사자 추가 또는 변경</summary><div className="mt-3 space-y-3">
    <fieldset className="min-w-0 rounded-lg border border-slate-200 bg-white p-3.5"><legend className="px-1 text-sm font-semibold">등록할 본안 심급</legend>
      <div className="flex flex-wrap gap-2">{instances.map(option => <label key={option.value} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="radio" name="guided-final-instance" checked={instance === option.value} onChange={() => configure(option.value)} />{option.label}</label>)}</div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">등록한 심급을 표시합니다. 확정 사실은 주문·자료로 별도 확인합니다. 최초 1심 사건도 직접 선택해 구성하세요.</p>
    </fieldset>
    <fieldset className="min-w-0 rounded-lg border border-slate-200 bg-white p-3.5"><legend className="px-1 text-sm font-semibold">새 신청인의 본안 지위</legend>
      <div className="flex flex-wrap gap-3">{(['원고','피고'] as const).map(role => <label key={role} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><input type="radio" name="guided-applicant-standing" checked={applicantRole === role} onChange={() => setNewApplicantRole(role)} />{role}</label>)}</div>
      <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={secondary} onClick={() => addParty('신청인')}>+ 신청인 추가</button><button type="button" className={secondary} onClick={() => addParty('피신청인')}>+ 피신청인 추가</button></div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">이름·본안 지위·이번 신청 지위는 아래 전체 당사자 목록 한 곳에서 편집합니다. 신청 대상이 아닌 본안 당사자도 유지하세요.</p>
    </fieldset>
    <details className="rounded-lg border border-slate-200 bg-white p-3.5"><summary className="cursor-pointer text-sm font-semibold">반소 등 추가 청구</summary><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={counterclaim} onChange={e => toggleCounterclaim(e.target.checked)} />반소(예비적 반소 포함) 병합 사건</label><p className="mt-2 text-xs leading-relaxed text-slate-500">환송·분리확정·심급별 참여는 심급·청구 변동에서, 대리인 선임은 대리인·비용에서, 제출 상태·상계는 배분·검토에서 확인합니다.</p></details>
    </div></details>
    {message && <p role="status" className="text-sm leading-relaxed text-blue-950">{message}</p>}
  </div>;
}
