'use client';

import { useState } from 'react';
import { type LitigationDraft } from '@/lib/litigation-costs-draft';
import { allocationWeightInput, safeMoneyInteger, sumMoneyInputs } from '@/lib/litigation-costs-money-input';
import { Field, primary, secondary } from './form-controls';

const digits = (v: string) => v.replace(/[,\s]/g, '');

type PartyRowVal = { primary: string; preliminary: string; absorbed: string };

export function GuidedStep2Values({ draft, onChange }: {
  draft: LitigationDraft;
  onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const mainStages = draft.stages.filter(s => s.type !== '확정신청');
  const [selectedStageId, setSelectedStageId] = useState('');
  const activeStage = mainStages.find(s => s.id === selectedStageId) || mainStages[0];

  const [hasClaimChange, setHasClaimChange] = useState(false);
  const [initialValue, setInitialValue] = useState('');
  const [finalValue, setFinalValue] = useState('');
  const [counterObjective, setCounterObjective] = useState<'합산' | '최다액'>('합산');
  const [appealVal, setAppealVal] = useState('');
  const [crossAppealVal, setCrossAppealVal] = useState('');
  const [partyAllocMode, setPartyAllocMode] = useState<'equal' | 'individual'>(() =>
    draft.calculation.values.some(v => v.purpose === '배분 가중치' && v.partyId) ? 'individual' : 'equal'
  );
  const [matrix, setMatrix] = useState<Record<string, Record<string, PartyRowVal>>>(() => {
    const initial: Record<string, Record<string, PartyRowVal>> = {};
    for (const stage of draft.stages) {
      initial[stage.id] = {};
      for (const p of draft.parties) {
        const found = draft.calculation.values.find(v => v.stageId === stage.id && v.purpose === '배분 가중치' && v.partyId === p.id);
        if (found) initial[stage.id][p.id] = { primary: found.amount, preliminary: '', absorbed: '' };
      }
    }
    return initial;
  });
  const [syncMsg, setSyncMsg] = useState('');

  const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
  const counterClaim = draft.claims.find(c => c.kind === '반소');
  const isMultiParty = draft.parties.filter(p => p.applicationRole === '신청인').length >= 2
    || draft.parties.filter(p => p.applicationRole === '피신청인').length >= 2
    || draft.parties.length > 2;

  const effectiveMainValue = hasClaimChange ? (finalValue || mainClaim?.value || '') : (mainClaim?.value || '');
  const counterVal = counterClaim?.value || '';

  const combinedStageValue = (() => {
    const inputs = counterClaim ? [effectiveMainValue, counterVal] : [effectiveMainValue];
    if (inputs.some(v => !safeMoneyInteger(v))) return null;
    if (counterClaim && counterObjective === '최다액') return BigInt(effectiveMainValue) >= BigInt(counterVal) ? BigInt(effectiveMainValue) : BigInt(counterVal);
    const total = sumMoneyInputs(inputs);
    return total.status === 'ready' ? BigInt(total.amount) : null;
  })();

  function updateMainClaimValue(val: string) {
    const clean = digits(val);
    onChange(old => {
      const target = old.claims.find(c => c.kind === '본소') || old.claims[0];
      if (!target) {
        return {
          ...old,
          claims: [{
            id: crypto.randomUUID(),
            kind: '본소',
            title: '본소 청구',
            claimantIds: old.parties.filter(p => p.mainRole === '원고').map(p => p.id),
            opponentIds: old.parties.filter(p => p.mainRole === '피고').map(p => p.id),
            value: clean,
            relation: '',
          }],
        };
      }
      return {
        ...old,
        claims: old.claims.map(c => c.id === target.id ? { ...c, value: clean } : c),
      };
    });
  }

  function updateCounterClaimValue(val: string) {
    const clean = digits(val);
    if (!counterClaim) return;
    onChange(old => ({
      ...old,
      claims: old.claims.map(c => c.id === counterClaim.id ? { ...c, value: clean } : c),
    }));
  }

  function applyStageValueToAttorneyFees() {
    if (!activeStage) return;
    if (combinedStageValue === null || (hasClaimChange && !safeMoneyInteger(initialValue))) { setSyncMsg('소가 입력을 확인하세요. 공란·잘못된 금액을 0원으로 반영하지 않습니다.'); return; }
    const valStr = String(combinedStageValue);
    onChange(old => {
      const changeSummary = [
        hasClaimChange ? `최초 소가 ${initialValue || '0'}원 → 최종 변경 소가 ${effectiveMainValue || '0'}원` : '',
        activeStage.type === '항소심' && (appealVal || crossAppealVal)
          ? `항소가 ${appealVal || '0'}원 / 부대항소가 ${crossAppealVal || '0'}원`
          : '',
      ].filter(Boolean).join(' · ');

      return {
        ...old,
        stages: old.stages.map(s => s.id === activeStage.id && changeSummary
          ? { ...s, appealScope: s.appealScope || changeSummary, changes: changeSummary }
          : s),
        costs: old.costs.map(cost => (
          cost.stageId === activeStage.id && cost.kind === '변호사보수' && cost.attorneyFee
            ? { ...cost, attorneyFee: { ...cost.attorneyFee, litigationValue: valStr } }
            : cost
        )),
      };
    });
    setSyncMsg(`${activeStage.type} 보수 산정 기준 소가(${combinedStageValue.toLocaleString('ko-KR')}원)를 반영했습니다.`);
  }

  function getRow(partyId: string): PartyRowVal {
    return matrix[activeStage?.id || '']?.[partyId] || { primary: '', preliminary: '', absorbed: '' };
  }

  function setRow(partyId: string, patch: Partial<PartyRowVal>) {
    const stageId = activeStage?.id || '';
    setMatrix(prev => ({ ...prev, [stageId]: { ...prev[stageId], [partyId]: { ...(prev[stageId]?.[partyId] || { primary: '', preliminary: '', absorbed: '' }), ...patch } } }));
  }

  const matrixRows = draft.parties.map(p => {
    const row = getRow(p.id);
    return { party: p, result: allocationWeightInput(row.primary, row.preliminary, row.absorbed) };
  });
  const matrixTotals = matrixRows.every(r => r.result.status === 'ready') ? matrixRows.reduce((acc, row) => {
    if (row.result.status !== 'ready') return acc;
    return { grossTotal: acc.grossTotal + BigInt(row.result.gross!), netTotal: acc.netTotal + BigInt(row.result.amount) };
  }, { grossTotal: BigInt(0), netTotal: BigInt(0) }) : null;

  function applyMatrixToCalculationValues() {
    const stageId = activeStage?.id || '';
    const claimId = mainClaim?.id || '';
    if (!stageId || !claimId) return;
    if (draft.parties.some(p => draft.calculation.values.filter(v => v.stageId === stageId && v.claimId === claimId && v.partyId === p.id && v.purpose === '배분 가중치').length > 1)) { setSyncMsg('같은 당사자·청구·심급에 여러 가중치가 있습니다. 계산용 가액에서 개별 검토하세요.'); return; }
    const invalid = matrixRows.find(row => row.result.status === 'blocked');
    if (invalid) { setSyncMsg(`${invalid.party.name || invalid.party.id}: 소가·중복 제외액을 확인하세요. 과다 제외나 잘못된 입력은 반영하지 않습니다.`); return; }
    const additions = matrixRows.map(row => ({ partyId: row.party.id, label: `${row.party.name || row.party.id} 안분 기준 소가`, amount: row.result.status === 'ready' ? row.result.amount : '', id: crypto.randomUUID() }));
    onChange(old => {
      const nextValues = [...old.calculation.values];
      for (const row of additions) {
        const index = nextValues.findIndex(v => v.stageId === stageId && v.claimId === claimId && v.partyId === row.partyId && v.purpose === '배분 가중치');
        if (index >= 0) nextValues[index] = { ...nextValues[index], amount: row.amount, label: row.label };
        else nextValues.push({ id: row.id, label: row.label, stageId, claimId, partyId: row.partyId, opponentId: '', purpose: '배분 가중치', kind: '청구', amount: row.amount });
      }
      if (nextValues.length > 500) return old;
      return { ...old, calculation: { ...old.calculation, values: nextValues } };
    });
    setSyncMsg('당사자별 안분 기준 소가를 반영했습니다. 0원도 저장하며 가중치 합계가 0이면 계산을 보류합니다.');
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5" data-testid="guided-step2">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step 2 가이드 · 심급별 소가 및 안분 기준</p>
        <p className="mt-1 text-sm text-slate-600">Step 1에서 선택된 심급과 반소 병합·당사자 수에 맞춰 소가 및 공동소송인 안분 매트릭스를 설정합니다.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-900">2-1. 심급별 소가 설정</p>
          {mainStages.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mainStages.map(stage => (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => { setSelectedStageId(stage.id); setSyncMsg(''); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${activeStage?.id === stage.id ? 'border-blue-600 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {stage.type} {stage.number ? `(${stage.number})` : ''}
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-700"
            checked={hasClaimChange}
            onChange={e => setHasClaimChange(e.target.checked)}
          />
          소송 도중 청구취지 변경(감축·확장) 있음
        </label>

        {!hasClaimChange ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="본소 소가 (원)"
              type="money"
              value={mainClaim?.value || ''}
              onChange={updateMainClaimValue}
              hint="청구취지 변경이 없는 경우 납부 인지대와 변호사보수 산정에 동일하게 사용합니다."
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="최초 소가 (납부 인지대 검증용, 원)"
              type="money"
              value={initialValue}
              onChange={v => setInitialValue(digits(v))}
              hint="소장·상소장 제출 당시 인지대 산정 기준 소가"
            />
            <Field
              label="최종 변경 소가 (변호사보수·안분 기준용, 원)"
              type="money"
              value={finalValue || mainClaim?.value || ''}
              onChange={v => { const clean = digits(v); setFinalValue(clean); updateMainClaimValue(clean); }}
              hint="보수규칙 제4조에 따라 변경된 최종 청구취지 기준"
            />
          </div>
        )}

        {counterClaim && (
          <div className="mt-4 space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3.5">
            <p className="text-xs font-bold text-blue-900">반소 병합 사건 추가 설정</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="반소(또는 예비적 반소) 소가 (원)"
                type="money"
                value={counterClaim.value}
                onChange={updateCounterClaimValue}
              />
              <fieldset>
                <legend className="mb-2 text-xs font-semibold text-slate-700">본소와 반소의 목적 동일 여부</legend>
                <div className="flex flex-wrap gap-2">
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${counterObjective === '합산' ? 'border-blue-400 bg-white font-semibold text-blue-950' : 'border-slate-200 bg-white/60 text-slate-700'}`}>
                    <input type="radio" name="counter-objective" checked={counterObjective === '합산'} onChange={() => setCounterObjective('합산')} />
                    목적 다름 - 소가 합산
                  </label>
                  <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs ${counterObjective === '최다액' ? 'border-blue-400 bg-white font-semibold text-blue-950' : 'border-slate-200 bg-white/60 text-slate-700'}`}>
                    <input type="radio" name="counter-objective" checked={counterObjective === '최다액'} onChange={() => setCounterObjective('최다액')} />
                    목적 동일 - 다액 기준
                  </label>
                </div>
              </fieldset>
            </div>
          </div>
        )}

        {activeStage?.type === '항소심' && (
          <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            <Field label="항소가 (2심 전용, 원)" type="money" value={appealVal} onChange={v => setAppealVal(digits(v))} />
            <Field label="부대항소가 (해당 시, 원)" type="money" value={crossAppealVal} onChange={v => setCrossAppealVal(digits(v))} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-600">
            산정 기준 소가 합계: <strong className="font-bold text-slate-950">{combinedStageValue === null ? '입력 확인 필요' : `${combinedStageValue.toLocaleString('ko-KR')}원`}</strong>
          </p>
          <button type="button" className={secondary} onClick={applyStageValueToAttorneyFees}>
            선택 심급 변호사보수 소가에 반영
          </button>
        </div>
        {syncMsg && <p role="status" className="mt-2 text-xs font-medium text-blue-800">{syncMsg}</p>}
      </div>

      {isMultiParty && (
        <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="guided-multiparty-matrix">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">2-2. 공동소송인별 안분 소가 (다수 당사자 사건)</p>
              <p className="text-xs text-slate-500">당사자가 2인 이상일 때 균등 배분 또는 당사자별 개별 소가 매트릭스를 설정합니다.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${partyAllocMode === 'equal' ? 'border-blue-400 bg-blue-50 font-semibold text-blue-950' : 'border-slate-200 text-slate-700'}`}>
                <input type="radio" name="party-alloc-mode" checked={partyAllocMode === 'equal'} onChange={() => setPartyAllocMode('equal')} />
                전원 동일(균등)
              </label>
              <label className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${partyAllocMode === 'individual' ? 'border-blue-400 bg-blue-50 font-semibold text-blue-950' : 'border-slate-200 text-slate-700'}`}>
                <input type="radio" name="party-alloc-mode" checked={partyAllocMode === 'individual'} onChange={() => setPartyAllocMode('individual')} />
                당사자별 개별 소가 입력
              </label>
            </div>
          </div>

          {partyAllocMode === 'individual' && (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-2">당사자 (지위)</th>
                      <th className="p-2">주위적청구 소가 (원)</th>
                      <th className="p-2">예비적청구 소가 (원)</th>
                      <th className="p-2">흡수(중복) 제외 소가 (원)</th>
                      <th className="p-2 text-right">안분 기준 소가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.parties.map(p => {
                      const row = getRow(p.id);
                      const calculated = allocationWeightInput(row.primary, row.preliminary, row.absorbed);
                      return (
                        <tr key={p.id} className="border-b border-slate-100">
                          <td className="p-2 font-medium text-slate-800">{p.name || '미입력'} ({p.mainRole}·{p.applicationRole})</td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${p.name || p.id} 주위적청구 소가`}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                              value={row.primary}
                              onChange={e => setRow(p.id, { primary: digits(e.target.value) })}
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${p.name || p.id} 예비적청구 소가`}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                              value={row.preliminary}
                              onChange={e => setRow(p.id, { preliminary: digits(e.target.value) })}
                            />
                          </td>
                          <td className="p-1.5">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${p.name || p.id} 흡수 제외 소가`}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs tabular-nums"
                              value={row.absorbed}
                              onChange={e => setRow(p.id, { absorbed: digits(e.target.value) })}
                            />
                          </td>
                          <td className="p-2 text-right font-semibold tabular-nums text-blue-900">
                            {calculated.status === 'ready' ? `${BigInt(calculated.amount).toLocaleString('ko-KR')}원` : '입력 확인 필요'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-xs">
                <div className="space-x-4">
                  <span>전체 소가 합계: <strong className="font-bold text-slate-900">{matrixTotals ? `${matrixTotals.grossTotal.toLocaleString('ko-KR')}원` : '입력 확인 필요'}</strong></span>
                  <span>안분 기준 총소가 (중복 제외): <strong className="font-bold text-blue-900">{matrixTotals ? `${matrixTotals.netTotal.toLocaleString('ko-KR')}원` : '입력 확인 필요'}</strong></span>
                </div>
                <button type="button" className={primary} onClick={applyMatrixToCalculationValues}>
                  배분 가중치 가액에 일괄 적용
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
