'use client';

import { useState } from 'react';
import { amount, type LitigationDraft } from '@/lib/litigation-costs-draft';
import { Field, Select, primary } from './form-controls';

type BurdenMode = '각자 부담' | '전부 부담' | '비율/분수 부담' | '본소·반소 분리 부담';
type RatioUnit = 'percent' | 'fraction';
type CoPartyBurden = '각자 부담(분할/안분)' | '연대(합동) 부담';

const digits = (v: string) => v.replace(/[,\s]/g, '');

export function GuidedStep3Rulings({ draft, onChange }: {
  draft: LitigationDraft;
  onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const mainStages = draft.stages.filter(s => s.type !== '확정신청');
  const firstRuling = draft.rulings[0];
  const initialHasCounterRuling = draft.claims.some(c => c.kind === '반소')
    && draft.rulings.some(r => r.claimIds.length === 1);
  const initialIsFull = !firstRuling
    || ((firstRuling.numerator === '1' && firstRuling.denominator === '1' && firstRuling.reverseNumerator === '0')
      || (firstRuling.numerator === '0' && firstRuling.reverseNumerator === '1' && firstRuling.reverseDenominator === '1'));

  const [selectedStageId, setSelectedStageId] = useState('all');
  const [burdenMode, setBurdenMode] = useState<BurdenMode>(() =>
    initialHasCounterRuling ? '본소·반소 분리 부담' : firstRuling?.numerator === '0' && firstRuling?.reverseNumerator === '0' ? '각자 부담' : initialIsFull ? '전부 부담' : '비율/분수 부담'
  );
  const [fullBearer, setFullBearer] = useState<'피신청인(상대방) 전부 부담' | '신청인 전부 부담'>(() =>
    firstRuling && firstRuling.numerator === '0' && firstRuling.reverseNumerator === '1'
      ? '신청인 전부 부담'
      : '피신청인(상대방) 전부 부담'
  );
  const [ratioUnit, setRatioUnit] = useState<RatioUnit>(() =>
    firstRuling && firstRuling.denominator === '100' ? 'percent' : 'fraction'
  );
  const [applicantPct, setApplicantPct] = useState(() =>
    firstRuling && firstRuling.denominator === '100' ? firstRuling.reverseNumerator : '30'
  );
  const [appNum, setAppNum] = useState(() => firstRuling?.reverseNumerator || '1');
  const [appDen, setAppDen] = useState(() => firstRuling?.reverseDenominator || '3');
  const [mainClaimBearer, setMainClaimBearer] = useState<'원고 전부 부담' | '피고 전부 부담'>('피고 전부 부담');
  const [counterClaimBearer, setCounterClaimBearer] = useState<'원고 전부 부담' | '피고 전부 부담'>('원고 전부 부담');
  const [coPartyBurden, setCoPartyBurden] = useState<CoPartyBurden>('각자 부담(분할/안분)');
  const [msg, setMsg] = useState('');

  const pctNum = amount(applicantPct);
  const respondentPct = pctNum !== null && pctNum <= 100 ? String(100 - pctNum) : null;
  const fracN = amount(appNum), fracD = amount(appDen);
  const respondentFracNum = fracN !== null && fracD !== null && fracD > 0 && fracN <= fracD ? String(fracD - fracN) : null;

  const isMultiParty = draft.parties.length > 2;

  function applyGuidedRuling() {
    const applicants = draft.parties.filter(p => p.applicationRole === '신청인').map(p => p.id);
    const respondents = draft.parties.filter(p => p.applicationRole === '피신청인').map(p => p.id);
    const stageIds = selectedStageId === 'all'
      ? draft.stages.filter(s => s.type !== '확정신청').map(s => s.id)
      : [selectedStageId];
    const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
    const counterClaim = draft.claims.find(c => c.kind === '반소');

    if (!applicants.length || !respondents.length) {
      setMsg('Step 1에서 신청인과 피신청인을 먼저 등록하세요.');
      return;
    }

    if (!stageIds.length || !mainClaim || (burdenMode === '본소·반소 분리 부담' && !counterClaim)) {
      setMsg('적용할 본안 심급과 청구를 먼저 등록하세요. 본소·반소 분리 부담은 두 청구가 모두 필요합니다.'); return;
    }
    if ((burdenMode === '본소·반소 분리 부담' && draft.rulings.length > 0) ||
        (draft.rulings.length === 1 && draft.rulings[0].stageIds.some(id => !stageIds.includes(id)))) {
      setMsg('기존 부담 관계의 다른 심급·청구와 연결된 계산 계획을 보존해야 합니다. 아래 부담 관계 상세에서 범위별로 추가·수정하고 배분 계획의 연결을 확인하세요.'); return;
    }

    let numerator = '1', denominator = '1', reverseNumerator = '0', reverseDenominator = '1';
    let orderText = '';

    if (burdenMode === '각자 부담') {
      numerator = '0'; reverseNumerator = '0'; orderText = '소송비용은 각자 부담한다.';
    } else if (burdenMode === '전부 부담') {
      if (fullBearer === '피신청인(상대방) 전부 부담') {
        numerator = '1'; denominator = '1'; reverseNumerator = '0'; reverseDenominator = '1';
        orderText = '소송비용은 피신청인(상대방)이 부담한다.';
      } else {
        numerator = '0'; denominator = '1'; reverseNumerator = '1'; reverseDenominator = '1';
        orderText = '소송비용은 신청인이 부담한다.';
      }
    } else if (burdenMode === '비율/분수 부담') {
      if (ratioUnit === 'percent') {
        if (pctNum === null || pctNum > 100 || respondentPct === null) {
          setMsg('0~100 사이의 퍼센트(%) 정수를 입력하세요.');
          return;
        }
        numerator = respondentPct; denominator = '100';
        reverseNumerator = String(pctNum); reverseDenominator = '100';
        orderText = `소송비용 중 ${pctNum}%는 신청인이, 나머지 ${respondentPct}%는 피신청인이 각 부담한다.`;
      } else {
        if (fracN === null || fracD === null || fracD === 0 || fracN > fracD || respondentFracNum === null) {
          setMsg('유효한 분수(분자 ≤ 분모, 분모 > 0)를 입력하세요.');
          return;
        }
        numerator = respondentFracNum; denominator = String(fracD);
        reverseNumerator = String(fracN); reverseDenominator = String(fracD);
        orderText = `소송비용 중 ${fracN}/${fracD}은 신청인이, 나머지는 피신청인이 각 부담한다.`;
      }
    }

    if (coPartyBurden === '연대(합동) 부담') {
      orderText += ' (공동소송인 연대 부담 특약 검토)';
    }

    onChange(old => {
      if (burdenMode === '본소·반소 분리 부담' && mainClaim && counterClaim) {
        const appIsPlaintiff = old.parties.find(p => p.applicationRole === '신청인')?.mainRole !== '피고';
        const mainRespBears = (mainClaimBearer === '피고 전부 부담' && appIsPlaintiff) || (mainClaimBearer === '원고 전부 부담' && !appIsPlaintiff);
        const counterRespBears = (counterClaimBearer === '피고 전부 부담' && appIsPlaintiff) || (counterClaimBearer === '원고 전부 부담' && !appIsPlaintiff);
        return {
          ...old,
          rulings: [
            {
              id: crypto.randomUUID(),
              text: `본소로 인한 소송비용은 ${mainClaimBearer.replace(' 전부 부담', '')}가 부담한다.`,
              stageIds: stageIds.length ? stageIds : old.stages.map(s => s.id),
              claimIds: [mainClaim.id],
              payerIds: respondents,
              receiverIds: applicants,
              numerator: mainRespBears ? '1' : '0',
              denominator: '1',
              reverseNumerator: mainRespBears ? '0' : '1',
              reverseDenominator: '1',
              status: '검토함',
            },
            {
              id: crypto.randomUUID(),
              text: `반소로 인한 소송비용은 ${counterClaimBearer.replace(' 전부 부담', '')}가 부담한다.`,
              stageIds: stageIds.length ? stageIds : old.stages.map(s => s.id),
              claimIds: [counterClaim.id],
              payerIds: respondents,
              receiverIds: applicants,
              numerator: counterRespBears ? '1' : '0',
              denominator: '1',
              reverseNumerator: counterRespBears ? '0' : '1',
              reverseDenominator: '1',
              status: '검토함',
            },
          ],
        };
      }

      const claimIds = old.claims.map(c => c.id);
      const targetStageIds = stageIds.length ? stageIds : old.stages.map(s => s.id);
      if (old.rulings.length === 1) {
        return {
          ...old,
          rulings: [{
            ...old.rulings[0],
            text: orderText || old.rulings[0].text,
            stageIds: targetStageIds,
            claimIds: claimIds.length ? claimIds : old.rulings[0].claimIds,
            payerIds: respondents,
            receiverIds: applicants,
            numerator,
            denominator,
            reverseNumerator,
            reverseDenominator,
            status: '검토함',
          }],
        };
      }
      return {
        ...old,
        rulings: [
          ...old.rulings,
          {
            id: crypto.randomUUID(),
            text: orderText,
            stageIds: targetStageIds,
            claimIds,
            payerIds: respondents,
            receiverIds: applicants,
            numerator,
            denominator,
            reverseNumerator,
            reverseDenominator,
            status: '검토함',
          },
        ],
      };
    });
    setMsg('부담 비율 주문을 아래 부담 관계 목록에 반영했습니다.');
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5" data-testid="guided-step3">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step 3 가이드 · 판결 주문의 소송비용 부담 비율</p>
        <p className="mt-1 text-sm text-slate-600">판결문 주문의 부담 방식을 선택하면 정방향·역방향 분수 비율을 자동으로 계산하여 부담 관계에 설정합니다.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="text-sm font-medium text-slate-700">
            <label htmlFor="guided-ruling-stage" className="mb-2 block">3-1. 적용 심급 범위</label>
            <select
              id="guided-ruling-stage"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950"
              value={selectedStageId}
              onChange={e => setSelectedStageId(e.target.value)}
            >
              <option value="all">전체 본안 심급 (소송총비용 또는 동일 주문)</option>
              {mainStages.map(s => <option key={s.id} value={s.id}>{s.type} ({s.number || '사건번호 미입력'})</option>)}
            </select>
          </div>
          <Select
            label="3-1. 부담 방식 유형"
            value={burdenMode}
            options={['전부 부담', '비율/분수 부담', '각자 부담', '본소·반소 분리 부담']}
            onChange={v => setBurdenMode(v as BurdenMode)}
          />
        </div>

        {burdenMode === '전부 부담' && (
          <Select
            label="전부 부담 당사자"
            value={fullBearer}
            options={['피신청인(상대방) 전부 부담', '신청인 전부 부담']}
            onChange={v => setFullBearer(v as typeof fullBearer)}
          />
        )}

        {burdenMode === '비율/분수 부담' && (
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold text-slate-700">입력 단위:</span>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-800">
                <input type="radio" name="ratio-unit" checked={ratioUnit === 'percent'} onChange={() => setRatioUnit('percent')} />
                퍼센트(%)
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-800">
                <input type="radio" name="ratio-unit" checked={ratioUnit === 'fraction'} onChange={() => setRatioUnit('fraction')} />
                분수(분자/분모)
              </label>
            </div>

            {ratioUnit === 'percent' ? (
              <div className="grid items-end gap-4 sm:grid-cols-2">
                <Field
                  label="신청인 측 부담 비율 (%)"
                  type="money"
                  value={applicantPct}
                  onChange={v => setApplicantPct(digits(v))}
                />
                <div className="rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm">
                  <span className="block text-xs text-slate-500">피신청인 측 부담 비율 (100% − 신청인비율 자동 계산)</span>
                  <strong className="mt-1 block text-base font-bold tabular-nums text-blue-900">
                    {respondentPct !== null ? `${respondentPct}% (${respondentPct}/100)` : '0~100 사이 숫자를 입력하세요'}
                  </strong>
                </div>
              </div>
            ) : (
              <div className="grid items-end gap-4 sm:grid-cols-3">
                <Field label="신청인 부담 분자" type="money" value={appNum} onChange={v => setAppNum(digits(v))} />
                <Field label="전체 부담 분모" type="money" value={appDen} onChange={v => setAppDen(digits(v))} />
                <div className="rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm">
                  <span className="block text-xs text-slate-500">피신청인(상대방) 부담 분수 (자동 계산)</span>
                  <strong className="mt-1 block text-base font-bold tabular-nums text-blue-900">
                    {respondentFracNum !== null ? `${respondentFracNum} / ${appDen}` : '분자·분모를 확인하세요'}
                  </strong>
                </div>
              </div>
            )}
          </div>
        )}

        {burdenMode === '본소·반소 분리 부담' && (
          <div className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2">
            <Select
              label="본소 비용 부담자"
              value={mainClaimBearer}
              options={['피고 전부 부담', '원고 전부 부담']}
              onChange={v => setMainClaimBearer(v as typeof mainClaimBearer)}
            />
            <Select
              label="반소 비용 부담자"
              value={counterClaimBearer}
              options={['원고 전부 부담', '피고 전부 부담']}
              onChange={v => setCounterClaimBearer(v as typeof counterClaimBearer)}
            />
          </div>
        )}

        {isMultiParty && (
          <fieldset className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <legend className="px-1 text-xs font-semibold text-slate-700">3-2. 공동소송인 간 부담 특약</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {(['각자 부담(분할/안분)', '연대(합동) 부담'] as const).map(opt => (
                <label key={opt} className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-800">
                  <input type="radio" name="coparty-burden" checked={coPartyBurden === opt} onChange={() => setCoPartyBurden(opt)} />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-500">적용 후 아래 부담 관계 상세 목록에서 당사자 쌍별 비율이나 주문 원문을 개별 수정할 수 있습니다.</p>
          <button type="button" className={primary} onClick={applyGuidedRuling}>
            부담 비율 설정 반영
          </button>
        </div>
        {msg && <p role="status" className="text-xs font-medium text-blue-800">{msg}</p>}
      </div>
    </div>
  );
}
