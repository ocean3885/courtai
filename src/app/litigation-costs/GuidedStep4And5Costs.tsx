'use client';

import { useState } from 'react';
import { amount, type Cost, type LitigationDraft } from '@/lib/litigation-costs-draft';
import { hasRespondentSetoff } from './GuidedStep1Setup';
import { Field, Select, primary, secondary } from './form-controls';

const digits = (v: string) => v.replace(/[,\s]/g, '');

const otherCostCategories = [
  '감정료(측량·시가·감정 등)',
  '증인여비',
  '당사자 기일출석비용',
  '검증비용',
  '기타 법원보관금 지출',
];

export function GuidedStep4And5Costs({ draft, onChange }: {
  draft: LitigationDraft;
  onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const mainStages = draft.stages.filter(s => s.type !== '확정신청');
  const [side, setSide] = useState<'applicant' | 'respondent'>('applicant');
  const [selectedStageId, setSelectedStageId] = useState('');
  const activeStage = mainStages.find(s => s.id === selectedStageId) || mainStages[0];
  const respondentEnabled = hasRespondentSetoff(draft);

  // 4-2 Stamp fee
  const [eFiling, setEFiling] = useState(true);
  const [stampPaid, setStampPaid] = useState('');

  // 4-3 Service fee
  const [serviceMode, setServiceMode] = useState<'split' | 'net'>('split');
  const [servicePaid, setServicePaid] = useState('');
  const [serviceRefund, setServiceRefund] = useState('0');
  const [serviceNet, setServiceNet] = useState('');

  // 4-4 Other court costs
  const [otherCategory, setOtherCategory] = useState(otherCostCategories[0]);
  const [otherMemo, setOtherMemo] = useState('');
  const [otherPaid, setOtherPaid] = useState('');
  const [otherRefund, setOtherRefund] = useState('0');

  // Step 5 Application costs
  const [appStamp, setAppStamp] = useState('900');
  const [appPriorService, setAppPriorService] = useState('0');
  const [appDecisionService, setAppDecisionService] = useState('5640');
  const [appSms, setAppSms] = useState('0');
  const [appScribeFee, setAppScribeFee] = useState('0');
  const [appDocFee, setAppDocFee] = useState('0');
  const [appDocNote, setAppDocNote] = useState('');

  const [feedback, setFeedback] = useState('');

  const sideParties = draft.parties
    .filter(p => p.applicationRole === (side === 'applicant' ? '신청인' : '피신청인'))
    .map(p => p.id);
  const sideLabel = side === 'applicant' ? '신청인' : '피신청인';

  const computedServiceNet = (() => {
    if (serviceMode === 'net') {
      return serviceNet && amount(serviceNet) !== null ? BigInt(serviceNet) : null;
    }
    const p = servicePaid && amount(servicePaid) !== null ? BigInt(servicePaid) : null;
    const r = serviceRefund && amount(serviceRefund) !== null ? BigInt(serviceRefund) : BigInt(0);
    if (p === null || r === null || r > p) return null;
    return p - r;
  })();

  const computedAppTotal = (() => {
    const items = [appStamp, appPriorService, appDecisionService, appSms, appScribeFee, appDocFee];
    return items.reduce((sum, v) => sum + (v && amount(v) !== null ? BigInt(v) : BigInt(0)), BigInt(0));
  })();

  function addOrUpdateCost(newCost: Omit<Cost, 'id'>) {
    onChange(old => {
      if (old.costs.length >= 500) return old;
      return {
        ...old,
        costs: [...old.costs, { ...newCost, id: crypto.randomUUID() }],
      };
    });
  }

  function addQuickAttorneyFee() {
    if (!activeStage) { setFeedback('Step 1·2에서 본안 심급을 먼저 등록하세요.'); return; }
    const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
    addOrUpdateCost({
      title: `${sideLabel} ${activeStage.type} 변호사보수`,
      kind: '변호사보수',
      stageId: activeStage.id,
      payerIds: sideParties,
      claimIds: mainClaim ? [mainClaim.id] : [],
      attorneyFee: {
        schedule: '2020-12-28',
        treatment: 'ordinary',
        litigationValue: mainClaim?.value || '',
      },
      claimed: '',
      refund: '0',
      recognized: '',
      evidence: '세금계산서·영수증·위임계약서',
      allocation: '직접 귀속',
      targetIds: draft.parties.map(p => p.id),
      reason: `${activeStage.type} 변호사보수 산입`,
      note: '',
    });
    setFeedback(`${sideLabel} ${activeStage.type} 변호사보수 항목을 추가했습니다. 아래 항목에서 착수금·성공보수와 상한 비교 배지를 확인하세요.`);
  }

  function addQuickStampFee() {
    if (!activeStage) { setFeedback('본안 심급을 먼저 선택하세요.'); return; }
    if (!stampPaid || amount(stampPaid) === null) { setFeedback('실제 납부한 인지액을 0 이상의 정수로 입력하세요.'); return; }
    const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
    addOrUpdateCost({
      title: `${sideLabel} ${activeStage.type} 인지대`,
      kind: '인지대',
      stageId: activeStage.id,
      payerIds: sideParties,
      claimIds: mainClaim ? [mainClaim.id] : [],
      claimed: stampPaid,
      refund: '0',
      recognized: stampPaid,
      evidence: `소장·상소장 인지 납부서 (${eFiling ? '전자소송 10% 할인 적용' : '서면 접수'})`,
      allocation: '직접 귀속',
      targetIds: draft.parties.map(p => p.id),
      reason: `${activeStage.type} 납부 인지액 (${eFiling ? '전자소송 10% 할인 반영' : '일반'})`,
      note: '',
    });
    setStampPaid('');
    setFeedback(`${sideLabel} ${activeStage.type} 인지대(${BigInt(stampPaid).toLocaleString('ko-KR')}원)를 비용 목록에 추가했습니다.`);
  }

  function addQuickServiceFee() {
    if (!activeStage) { setFeedback('본안 심급을 먼저 선택하세요.'); return; }
    if (computedServiceNet === null) { setFeedback('송달료 납부액과 환급액을 확인하세요 (환급액은 납부액을 초과할 수 없습니다).'); return; }
    const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
    const gross = serviceMode === 'net' ? String(computedServiceNet) : servicePaid;
    const ref = serviceMode === 'net' ? '0' : (serviceRefund || '0');
    addOrUpdateCost({
      title: `${sideLabel} ${activeStage.type} 송달료`,
      kind: '송달료',
      stageId: activeStage.id,
      payerIds: sideParties,
      claimIds: mainClaim ? [mainClaim.id] : [],
      claimed: gross,
      refund: ref,
      recognized: String(computedServiceNet),
      evidence: '송달료 납부·잔액환급 내역서',
      allocation: '직접 귀속',
      targetIds: draft.parties.map(p => p.id),
      reason: serviceMode === 'split'
        ? `납부 ${BigInt(gross).toLocaleString('ko-KR')}원 − 환급 ${BigInt(ref).toLocaleString('ko-KR')}원 = 실지출 ${computedServiceNet.toLocaleString('ko-KR')}원`
        : `송달료 실지출액 ${computedServiceNet.toLocaleString('ko-KR')}원`,
      note: '',
    });
    setServicePaid(''); setServiceRefund('0'); setServiceNet('');
    setFeedback(`${sideLabel} ${activeStage.type} 송달료(실지출 ${computedServiceNet.toLocaleString('ko-KR')}원)를 추가했습니다.`);
  }

  function addQuickOtherCost() {
    if (!activeStage) { setFeedback('본안 심급을 먼저 선택하세요.'); return; }
    const p = otherPaid && amount(otherPaid) !== null ? BigInt(otherPaid) : null;
    const r = otherRefund && amount(otherRefund) !== null ? BigInt(otherRefund) : BigInt(0);
    if (p === null || r === null || r > p) { setFeedback('기타 절차 비용의 납부액과 환급액을 확인하세요.'); return; }
    const net = p - r;
    const mainClaim = draft.claims.find(c => c.kind === '본소') || draft.claims[0];
    const kind = otherCategory.startsWith('감정료') ? '감정료' : otherCategory.startsWith('당사자') ? '당사자비용' : '기타';
    addOrUpdateCost({
      title: otherMemo.trim() ? `${sideLabel} ${activeStage.type} ${otherMemo.trim()}` : `${sideLabel} ${activeStage.type} ${otherCategory}`,
      kind,
      stageId: activeStage.id,
      payerIds: sideParties,
      claimIds: mainClaim ? [mainClaim.id] : [],
      claimed: String(p),
      refund: String(r),
      recognized: String(net),
      evidence: '법원보관금 출급계산서·영수증',
      allocation: '직접 귀속',
      targetIds: draft.parties.map(p => p.id),
      reason: `${otherCategory}${otherMemo.trim() ? ` (${otherMemo.trim()})` : ''}`,
      note: '',
    });
    setOtherMemo(''); setOtherPaid(''); setOtherRefund('0');
    setFeedback(`${otherCategory}(실지출 ${net.toLocaleString('ko-KR')}원) 항목을 추가했습니다.`);
  }

  function applyStep5ApplicationCosts() {
    if (computedAppTotal <= BigInt(0)) { setFeedback('확정신청 비용을 1원 이상 입력하세요.'); return; }
    onChange(old => {
      let appStage = old.stages.find(s => s.type === '확정신청');
      const nextStages = [...old.stages];
      if (!appStage) {
        appStage = {
          id: crypto.randomUUID(),
          type: '확정신청',
          number: old.meta.number || '',
          partyIds: old.parties.map(p => p.id),
          appealScope: '',
          changes: '',
        };
        nextStages.push(appStage);
      }
      const breakdown: string[] = [];
      if (amount(appStamp)) breakdown.push(`신청 인지대 ${BigInt(appStamp).toLocaleString('ko-KR')}원`);
      if (amount(appPriorService)) breakdown.push(`기발생 송달료 ${BigInt(appPriorService).toLocaleString('ko-KR')}원`);
      if (amount(appDecisionService)) breakdown.push(`결정정본 송달료 ${BigInt(appDecisionService).toLocaleString('ko-KR')}원`);
      if (amount(appSms)) breakdown.push(`SMS 발송료 ${BigInt(appSms).toLocaleString('ko-KR')}원`);
      if (amount(appScribeFee)) breakdown.push(`서기료·신청보수 ${BigInt(appScribeFee).toLocaleString('ko-KR')}원`);
      if (amount(appDocFee)) breakdown.push(`첨부서류 발급비 ${BigInt(appDocFee).toLocaleString('ko-KR')}원${appDocNote.trim() ? `(${appDocNote.trim()})` : ''}`);

      const applicants = old.parties.filter(p => p.applicationRole === '신청인').map(p => p.id);
      const totalStr = String(computedAppTotal);
      const existingAppCost = old.costs.find(c => c.stageId === appStage!.id && c.kind === '신청비용');
      const nextCosts = existingAppCost
        ? old.costs.map(c => c.id === existingAppCost.id
          ? {
            ...c,
            claimed: totalStr,
            refund: '0',
            recognized: totalStr,
            reason: breakdown.join(' + ') || c.reason,
            note: appDocNote.trim() || c.note,
          }
          : c)
        : [
          ...old.costs,
          {
            id: crypto.randomUUID(),
            title: '소송비용액 확정신청 비용',
            kind: '신청비용',
            stageId: appStage.id,
            payerIds: applicants,
            claimIds: [],
            claimed: totalStr,
            refund: '0',
            recognized: totalStr,
            evidence: '확정신청서 인지·송달료 납부서 및 발급 영수증',
            allocation: '직접 귀속',
            targetIds: old.parties.map(p => p.id),
            reason: breakdown.join(' + '),
            note: appDocNote.trim(),
          },
        ];
      return { ...old, stages: nextStages, costs: nextCosts };
    });
    setFeedback(`확정신청 비용 합계 ${computedAppTotal.toLocaleString('ko-KR')}원을 비용 목록에 반영했습니다.`);
  }

  return (
    <div className="mb-5 space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5" data-testid="guided-step4-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step 4 & Step 5 가이드 · 심급별 본안 지출 비용 및 확정신청 비용 빠른 입력</p>
          <p className="mt-1 text-xs text-slate-600">비목별 지출 비용을 입력해 아래 비용·증빙 목록에 바로 추가합니다. 추가된 항목은 아래 목록에서 상세 수정할 수 있습니다.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSide('applicant')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${side === 'applicant' ? 'border-blue-600 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            신청인 지출 비용
          </button>
          <button
            type="button"
            disabled={!respondentEnabled}
            title={!respondentEnabled ? 'Step 1에서 피신청인의 상계 의견서 제출을 체크하면 활성화됩니다.' : undefined}
            onClick={() => setSide('respondent')}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${side === 'respondent' ? 'border-blue-600 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
          >
            피신청인 지출 비용 {respondentEnabled ? '' : '(상계 미체크)'}
          </button>
        </div>
      </div>

      {mainStages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">대상 본안 심급:</span>
          {mainStages.map(stage => (
            <button
              key={stage.id}
              type="button"
              onClick={() => setSelectedStageId(stage.id)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${activeStage?.id === stage.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              {stage.type}
            </button>
          ))}
          <button type="button" className={secondary} onClick={addQuickAttorneyFee}>
            + {activeStage?.type || '심급'} 변호사보수 카드 추가 (4-1)
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 4-2 Stamp Fee */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-slate-900">4-2. 인지대 ({activeStage?.type || '심급 미선택'} · {sideLabel})</p>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-blue-900">
              <input type="checkbox" className="h-3.5 w-3.5 accent-blue-700" checked={eFiling} onChange={e => setEFiling(e.target.checked)} />
              전자소송 접수 (10% 할인 적용)
            </label>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="실제 납부한 인지액 (원)" type="money" value={stampPaid} onChange={v => setStampPaid(digits(v))} />
            </div>
            <button type="button" className={secondary} onClick={addQuickStampFee}>+ 인지대 추가</button>
          </div>
        </div>

        {/* 4-3 Service Fee */}
        <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">4-3. 송달료 ({activeStage?.type || '심급 미선택'} · {sideLabel})</p>
            <div className="flex gap-2 text-xs">
              <label className="flex cursor-pointer items-center gap-1">
                <input type="radio" name="service-fee-mode" checked={serviceMode === 'split'} onChange={() => setServiceMode('split')} />
                납부·환급 분리
              </label>
              <label className="flex cursor-pointer items-center gap-1">
                <input type="radio" name="service-fee-mode" checked={serviceMode === 'net'} onChange={() => setServiceMode('net')} />
                실지출 직접 입력
              </label>
            </div>
          </div>
          {serviceMode === 'split' ? (
            <div className="grid gap-2 sm:grid-cols-3 items-end">
              <Field label="최초 납부 송달료 (원)" type="money" value={servicePaid} onChange={v => setServicePaid(digits(v))} />
              <Field label="환급 송달료 (원)" type="money" value={serviceRefund} onChange={v => setServiceRefund(digits(v))} />
              <button type="button" className={secondary} onClick={addQuickServiceFee}>
                + 송달료 추가 {computedServiceNet !== null ? `(${computedServiceNet.toLocaleString('ko-KR')}원)` : ''}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="송달료 실지출액 (원)" type="money" value={serviceNet} onChange={v => setServiceNet(digits(v))} />
              </div>
              <button type="button" className={secondary} onClick={addQuickServiceFee}>+ 송달료 추가</button>
            </div>
          )}
        </div>
      </div>

      {/* 4-4 Other Court Procedure Costs */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3">
        <p className="text-xs font-bold text-slate-900">4-4. 기타 법원 절차 비용 (감정료, 증인여비 등)</p>
        <p className="rounded bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">
          ※ 법원 증거조사절차 외 임의 지출(사설 녹취록, 포렌식, 사설감정, 번역료 등)은 소송비용에 산입되지 않습니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
          <Select label="기타 비목 선택" value={otherCategory} options={otherCostCategories} onChange={setOtherCategory} />
          <Field label="세부 메모 (예: 1차 측량감정료)" value={otherMemo} onChange={setOtherMemo} />
          <Field label="기타 비용 납부액 (원)" type="money" value={otherPaid} onChange={v => setOtherPaid(digits(v))} />
          <Field label="기타 비용 환급액 (원)" type="money" value={otherRefund} onChange={v => setOtherRefund(digits(v))} />
          <button type="button" className={secondary} onClick={addQuickOtherCost}>+ 비용 항목 추가</button>
        </div>
      </div>

      {/* Step 5 Application Costs */}
      <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3" data-testid="guided-step5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-900">Step 5. 소송비용액 확정신청 비용 (신청인 측)</p>
            <p className="text-xs text-slate-500">본안 이후 확정결정 신청 단계에서 발생한 비용(기본 인지대 900원, 결정정본 송달료 등)을 합산해 반영합니다.</p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900">
            신청비용 합계: {computedAppTotal.toLocaleString('ko-KR')}원
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="5-1. 신청 인지대 (원)" type="money" value={appStamp} onChange={v => setAppStamp(digits(v))} hint="기본값 900원 (전자소송 기준)" />
          <Field label="5-1. 기발생 송달료 (원)" type="money" value={appPriorService} onChange={v => setAppPriorService(digits(v))} />
          <Field label="5-1. 결정정본 송달료 (원)" type="money" value={appDecisionService} onChange={v => setAppDecisionService(digits(v))} hint="예: 5,640원" />
          <Field label="5-1. SMS 발송료 (원)" type="money" value={appSms} onChange={v => setAppSms(digits(v))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3 items-end">
          <Field label="5-2. 서기료 / 확정신청 별도 보수 (원)" type="money" value={appScribeFee} onChange={v => setAppScribeFee(digits(v))} />
          <Field label="5-2. 첨부서류 발급비 (등기·초본 등, 원)" type="money" value={appDocFee} onChange={v => setAppDocFee(digits(v))} />
          <Field label="5-2. 발급 내역 비고" value={appDocNote} onChange={setAppDocNote} />
        </div>
        <div className="flex justify-end">
          <button type="button" className={primary} onClick={applyStep5ApplicationCosts}>
            확정신청 비용 반영 ({computedAppTotal.toLocaleString('ko-KR')}원)
          </button>
        </div>
      </div>

      {feedback && <p role="status" className="text-xs font-medium text-blue-800">{feedback}</p>}
    </div>
  );
}
