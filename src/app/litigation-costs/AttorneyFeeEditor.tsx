'use client';

import { useId, useState } from 'react';
import { getCostRecognition } from '@/lib/litigation-costs-attorney-fee';
import { amount, type Cost } from '@/lib/litigation-costs-draft';
import { Field, Select } from './form-controls';

const digits = (v: string) => v.replace(/[,\s]/g, '');

export function AttorneyFeeEditor({ cost, stageName, initialValue, onChange }: {
  cost: Cost; stageName: string; initialValue: string; onChange: (patch: Partial<Cost>) => void;
}) {
  const outputId = useId();
  const [retainer, setRetainer] = useState('');
  const [paidSuccess, setPaidSuccess] = useState('');
  const [promisedSuccess, setPromisedSuccess] = useState('');
  const result = getCostRecognition(cost);

  function updateBreakdown(nextRetainer: string, nextPaid: string, nextPromised: string) {
    const r = digits(nextRetainer), p = digits(nextPaid), pr = digits(nextPromised);
    setRetainer(r); setPaidSuccess(p); setPromisedSuccess(pr);
    if (!r && !p && !pr) return;
    const nums = [r, p, pr].map(x => (x && amount(x) !== null ? BigInt(x) : BigInt(0)));
    const total = nums[0] + nums[1] + nums[2];
    const parts: string[] = [];
    if (nums[0] > BigInt(0)) parts.push(`착수금 ${nums[0].toLocaleString('ko-KR')}원`);
    if (nums[1] > BigInt(0)) parts.push(`기지급 성공보수 ${nums[1].toLocaleString('ko-KR')}원`);
    if (nums[2] > BigInt(0)) parts.push(`지급예정 성공보수 ${nums[2].toLocaleString('ko-KR')}원`);
    onChange({
      claimed: String(total),
      note: parts.length ? `보수 내역: ${parts.join(' + ')}` : cost.note,
    });
  }

  const badgeText = result.status === 'ready' && result.attorneyFee
    ? `[규칙 상한: ${BigInt(result.attorneyFee.limitAmount).toLocaleString('ko-KR')}원 / 입력액: ${BigInt(result.attorneyFee.netPaid).toLocaleString('ko-KR')}원 → 산입액: ${BigInt(result.recognized).toLocaleString('ko-KR')}원]`
    : null;

  const hasEvidence = cost.evidence.trim().length > 0;

  return <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-attorney-cost={cost.id}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-semibold text-slate-800">{stageName || '발생 절차를 선택하세요'} · 변호사보수 (Step 4-1)</p>
      {badgeText && (
        <span data-testid="attorney-fee-badge" className="rounded-full border border-blue-300 bg-blue-100/80 px-3 py-1 text-xs font-bold tabular-nums text-blue-950">
          {badgeText}
        </span>
      )}
    </div>
    <Select label="변호사보수 산정 방식" value={cost.attorneyFee ? '소가·실비로 자동 계산' : '직원 인정액 직접 입력'} options={['소가·실비로 자동 계산', '직원 인정액 직접 입력']} onChange={value => onChange({ attorneyFee: value === '소가·실비로 자동 계산' ? { schedule: '2020-12-28', treatment: 'ordinary', litigationValue: initialValue } : undefined })} />
    {cost.attorneyFee && <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="심급별 보수 산정 소가 (원)" type="money" value={cost.attorneyFee.litigationValue} onChange={litigationValue => onChange({ attorneyFee: { ...cost.attorneyFee!, litigationValue: digits(litigationValue) } })} />
        <Field label="변호사보수 실비 (원)" type="money" value={cost.claimed} onChange={claimed => onChange({ claimed: digits(claimed) })} hint="착수금·성공보수 합계를 직접 입력하거나 아래 세부 내역으로 합산합니다." />
        <Field label="보수 환급액 (원)" type="money" value={cost.refund} onChange={refund => onChange({ refund: digits(refund) })} hint="환급 반영 순액을 실비로 입력했다면 0원을 입력합니다." />
      </div>
      <div className="rounded-lg border border-slate-200 bg-white/80 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">착수금·성공보수 세부 합산 입력 (선택 · 입력 시 실비 합계에 자동 반영)</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="착수금 실제 지급액 (원)" type="money" value={retainer} onChange={v => updateBreakdown(v, paidSuccess, promisedSuccess)} />
          <Field label="기지급 성공보수액 (원)" type="money" value={paidSuccess} onChange={v => updateBreakdown(retainer, v, promisedSuccess)} />
          <Field label="지급 예정 성공보수 약정액 (원)" type="money" value={promisedSuccess} onChange={v => updateBreakdown(retainer, paidSuccess, v)} hint="위임계약서 기준" />
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-700"
            checked={hasEvidence}
            onChange={e => onChange({ evidence: e.target.checked ? (cost.evidence.trim() || '세금계산서·영수증·위임계약서 첨부 확인') : '' })}
          />
          소명자료(세금계산서·영수증·계약서) 첨부 확인
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium text-slate-700">적용 별표</p><p className="text-sm leading-relaxed text-slate-600">2020.12.28. 시행 · 대법원규칙 제2936호</p></div><Select label="보수 산입 유형" value={cost.attorneyFee.treatment === 'half' ? '제5조 1/2 산입' : '일반 본안'} options={['일반 본안', '제5조 1/2 산입']} onChange={value => onChange({ attorneyFee: { ...cost.attorneyFee!, treatment: value === '일반 본안' ? 'ordinary' : 'half' } })} /></div>
      <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="attorney-fee-calculation">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label id={`${outputId}-label`} htmlFor={outputId} className="block text-sm font-semibold text-slate-800">자동 산입액 (보수규칙 제3조 상한 비교)</label>
          {badgeText && <span className="text-xs font-semibold tabular-nums text-blue-700">{badgeText}</span>}
        </div>
        <output id={outputId} aria-labelledby={`${outputId}-label`} className="mt-2 block text-xl font-bold tabular-nums text-blue-800">{result.status === 'ready' ? `${BigInt(result.recognized).toLocaleString('ko-KR')}원` : '입력 확인 필요'}</output>
        {result.status === 'ready' ? <ol className="mt-3 space-y-1 text-sm leading-relaxed text-slate-600">{result.attorneyFee?.formula.map(line => <li key={line} className="break-words">{line}</li>)}</ol> : <ul className="mt-3 space-y-1 text-sm text-amber-900">{result.errors.map(error => <li key={error}>{error}</li>)}</ul>}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">입력 소가가 자동 보수의 기준입니다. 배분용 가액·수동 산정 그룹과 구분하며 산입액을 계산서와 상계에 반영합니다. 다른 시기 별표·제6조 재량 조정은 직접 입력으로 검토합니다. <a className="underline" href="https://www.law.go.kr/법령/변호사보수의소송비용산입에관한규칙" target="_blank" rel="noopener noreferrer">적용 규칙 보기</a></p>
    </>}
  </div>;
}
