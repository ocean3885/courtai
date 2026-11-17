'use client';

import { useState } from 'react';
import type { LitigationDraft } from '@/lib/litigation-costs-draft';
import { applySimpleAllocation, type SimpleAllocationContext } from '@/lib/litigation-costs-simple-allocation';
import { Choice, Field, primary } from './form-controls';

type ReadyContext = Extract<SimpleAllocationContext, { status: 'ready' }>;
export function SimpleAllocationEditor({ draft, context, onChange }: {
  draft: LitigationDraft; context: ReadyContext; onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const [rulingId, setRulingId] = useState(context.pair?.rulingId || (context.rulings.length === 1 ? context.rulings[0].id : ''));
  const [applicationBasis, setApplicationBasis] = useState(context.plan?.applicationBasis || '');
  const [message, setMessage] = useState('');
  const name = (id: string) => draft.parties.find(p => p.id === id)?.name || '표시명 미입력';
  const ruling = context.rulings.find(r => r.id === rulingId);
  const appliedRuling = context.rulings.find(r => r.id === context.pair?.rulingId);
  const completePair = context.pair?.ownerId === context.ownerId && context.pair?.otherId === context.otherId && context.pair?.claimId === context.claimId && appliedRuling;
  const needsBasis = context.application && ruling && !ruling.stageIds.includes(context.cost.stageId);
  const selection = { rulingId, applicationBasis };
  const check = applySimpleAllocation(draft, context.cost.id, selection, 'preview');
  function apply() {
    const nodeId = crypto.randomUUID();
    const result = applySimpleAllocation(draft, context.cost.id, selection, nodeId);
    if (!result.ok) { setMessage(result.error); return; }
    onChange(old => {
      const latest = applySimpleAllocation(old, context.cost.id, selection, nodeId);
      return latest.ok ? latest.draft : old;
    });
    setMessage('간편 배분 계획을 적용했습니다. 계산 결과와 부담 비율을 확인하세요.');
  }
  return <div data-testid="simple-allocation" className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-3 sm:p-4">
    <div><h4 className="font-semibold text-blue-950">1대1 본소 간편 배분</h4><p className="mt-1 text-sm leading-relaxed text-slate-600">비용에서 선택한 귀속자·청구를 가져옵니다. 부담 관계를 확인하고 적용하면 전액 귀속 계획과 배분 대상이 함께 설정됩니다. 선택·준용 근거는 적용 버튼을 눌러야 초안과 계산에 반영됩니다.</p></div>
    <dl className="grid gap-3 text-sm sm:grid-cols-3">
      <div><dt className="text-slate-500">비용 귀속자</dt><dd className="mt-1 font-semibold">{name(context.ownerId)}</dd></div>
      <div><dt className="text-slate-500">비용을 부담할 상대방</dt><dd className="mt-1 font-semibold">{name(context.otherId)}</dd></div>
      <div><dt className="text-slate-500">귀속 청구</dt><dd className="mt-1 font-semibold">{draft.claims.find(c => c.id === context.claimId)?.title || '청구 없음 · 확정신청 비용'}</dd></div>
    </dl>
    <Choice label="적용 부담 관계" value={ruling ? rulingId : ''} empty="부담 관계를 선택하세요" items={context.rulings.map(r => {
      const direct = r.receiverIds[0] === context.ownerId;
      return { id: r.id, name: `관계 ${draft.rulings.indexOf(r) + 1} · 상대방 부담 ${direct ? `${r.numerator}/${r.denominator}` : `${r.reverseNumerator}/${r.reverseDenominator}`}${r.stageIds.includes(context.cost.stageId) ? '' : ' · 신청비용 준용'}${r.status === '검토함' ? '' : ' · 효력 미확인'}` };
    })} onChange={value => { setRulingId(value); setMessage(''); }} />
    {ruling && <div className="space-y-2 rounded-lg bg-white p-3 text-sm leading-relaxed text-slate-700"><p className="font-semibold text-blue-950">선택한 주문의 이 비용 부담: {name(context.otherId)} · {ruling.receiverIds[0] === context.ownerId ? `${ruling.numerator}/${ruling.denominator}` : `${ruling.reverseNumerator}/${ruling.reverseDenominator}`}</p><p className="whitespace-pre-wrap break-words">{ruling.text}</p></div>}
    {!context.rulings.length && <p role="alert" className="text-sm leading-relaxed text-amber-900">적용 가능한 부담 관계가 없습니다. 비용 부담 주문 목차에서 당사자·적용 심급·청구와 양방향 비율을 확인하세요.</p>}
    {context.application && <Field label="신청비용 부담 재판 준용 근거" multiline value={applicationBasis} onChange={value => { setApplicationBasis(value); setMessage(''); }} hint={needsBasis ? '필수 · 선택한 주문은 다른 절차의 주문입니다. 신청비용에 적용하는 근거를 직접 확인해 입력하세요.' : '확정신청 절차 자체의 부담 주문이 적용되면 별도의 준용 근거는 선택 사항입니다.'} />}
    {context.cost.kind === '변호사보수' && !context.cost.attorneyFee && !context.plan?.basisGroupId && <p className="text-sm leading-relaxed text-amber-900">수동 인정액을 사용하는 변호사보수는 아래 보수 산정 기초 그룹도 연결해야 계산할 수 있습니다.</p>}
    {context.plan && <p data-testid="simple-allocation-current" className="text-sm leading-relaxed text-blue-900">{completePair ? `현재 적용된 계획: ${name(context.ownerId)} 비용 전액 귀속 · 부담 관계 ${draft.rulings.indexOf(appliedRuling) + 1}` : '현재 계획의 연결이 미완성입니다. 부담 관계를 확인하고 간편 배분 계획을 적용하세요.'}</p>}
    <p className="text-xs leading-relaxed text-slate-500">부담 비율·상계 방식·절사 설정과 인정액은 기존 입력을 사용합니다. 여러 후보가 있으면 자동으로 선택하지 않습니다.</p>
    {!check.ok && <p className="text-sm leading-relaxed text-amber-900">{check.error}</p>}
    <button type="button" className={`${primary} disabled:cursor-not-allowed disabled:opacity-40`} disabled={!check.ok} onClick={apply}>간편 배분 계획 적용</button>
    {message && <p role="status" className="text-sm leading-relaxed text-blue-900">{message}</p>}
  </div>;
}
