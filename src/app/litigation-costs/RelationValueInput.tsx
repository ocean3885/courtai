'use client';

import { useState } from 'react';
import { type Member, type Party, type Stage } from './caseInput';
import { relationOpponents, relationValueIssue } from './relationValues';

type Props = {
  stage: Stage; party: Party; parties: Party[]; counter: boolean; enabled: boolean;
  label: (party: Party) => string; change: (patch: Partial<Member>) => void;
};

export function RelationValueInput({ stage, party, parties, counter, enabled, label, change }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const member = stage.members[party.id];
  const key = counter ? 'counterRelationValues' : 'relationValues';
  const total = (counter ? member.counterValue : member.value) || '';
  const opponents = relationOpponents(stage, party, parties);
  const canEdit = enabled && opponents.length > 1 && /^\d{1,16}$/.test(total);
  const issue = relationValueIssue(draft, opponents.map(p => p.id), total);
  const sum = opponents.reduce((sum, p) => sum + (/^\d{1,16}$/.test(draft[p.id] || '') ? BigInt(draft[p.id]) : BigInt(0)), BigInt(0));
  const title = `${label(party)}${counter ? ' 반소' : ''} 관계별 소가 입력`;
  return <>
    <button type="button" aria-label={title} disabled={!canEdit}
      title={!canEdit ? '개별소가를 입력하고 해당 심급의 상대방을 2명 이상 선택하세요.' : undefined}
      className="mt-1 w-full rounded border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      onClick={() => { setDraft({ ...member[key] }); setOpen(true); }}>
      관계별 소가 {member[key] ? '수정' : '입력'}
    </button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={title} onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} className="max-h-[85vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-600">개별소가를 상대방별로 나누어 입력하세요. 이 당사자의 본안 비용을 ‘소가 비율 안분’할 때 사용합니다. 신청비용의 균분에는 적용하지 않습니다.</p>
        <p className="text-sm text-slate-700">개별소가: {/^\d{1,16}$/.test(total) ? BigInt(total).toLocaleString('ko-KR') : '미입력'}원</p>
        {opponents.map((opponent, index) => <label key={opponent.id} className="block space-y-1 text-sm text-slate-700">
          <span>{label(opponent)}에 대한 소가 (원)</span>
          <input type="text" inputMode="numeric" autoFocus={index === 0} value={draft[opponent.id] ?? ''} placeholder="해당 금액이 없으면 0"
            className="h-10 w-full rounded border border-slate-300 px-3 text-right tabular-nums"
            onChange={e => setDraft({ ...draft, [opponent.id]: e.target.value.replace(/\D/g, '') })} />
        </label>)}
        <p className="text-sm font-semibold text-blue-900">관계별 합계: {sum.toLocaleString('ko-KR')}원</p>
        {issue && <p role="status" className="text-xs text-amber-800">{issue}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          {member[key] && <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs"
            onClick={() => { change({ [key]: undefined }); setOpen(false); }}>관계별 입력 해제</button>}
          <button type="button" className="rounded border border-slate-300 px-3 py-2 text-xs" onClick={() => setOpen(false)}>취소</button>
          <button type="button" disabled={!!issue || !canEdit} className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            onClick={() => {
              change({ [key]: Object.fromEntries(opponents.map(p => [p.id, draft[p.id]])) });
              setOpen(false);
            }}>관계별 소가 반영</button>
        </div>
      </div>
    </div>}
  </>;
}
