'use client';

import { useId } from 'react';
import { getCostRecognition } from '@/lib/litigation-costs-attorney-fee';
import type { Cost } from '@/lib/litigation-costs-draft';
import { Field, Select } from './form-controls';

export function AttorneyFeeEditor({ cost, stageName, initialValue, onChange }: {
  cost: Cost; stageName: string; initialValue: string; onChange: (patch: Partial<Cost>) => void;
}) {
  const outputId = useId();
  const result = getCostRecognition(cost);
  return <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-attorney-cost={cost.id}>
    <Select label="변호사보수 산정 방식" value={cost.attorneyFee ? '소가·실비로 자동 계산' : '직원 인정액 직접 입력'} options={['소가·실비로 자동 계산', '직원 인정액 직접 입력']} onChange={value => onChange({ attorneyFee: value === '소가·실비로 자동 계산' ? { schedule: '2020-12-28', treatment: 'ordinary', litigationValue: initialValue } : undefined })} />
    {cost.attorneyFee && <>
      <p className="text-sm font-semibold text-slate-800">{stageName || '발생 절차를 선택하세요'} · 변호사보수</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="심급별 보수 산정 소가 (원)" type="money" value={cost.attorneyFee.litigationValue} onChange={litigationValue => onChange({ attorneyFee: { ...cost.attorneyFee!, litigationValue: litigationValue.replace(/[,\s]/g, '') } })} />
        <Field label="변호사보수 실비 (원)" type="money" value={cost.claimed} onChange={claimed => onChange({ claimed: claimed.replace(/[,\s]/g, '') })} hint="해당 심급에 지급했거나 지급의무가 발생한 보수의 증빙 금액을 입력합니다." />
        <Field label="보수 환급액 (원)" type="money" value={cost.refund} onChange={refund => onChange({ refund: refund.replace(/[,\s]/g, '') })} hint="환급 반영 순액을 실비로 입력했다면 0원을 입력합니다." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-sm font-medium text-slate-700">적용 별표</p><p className="text-sm leading-relaxed text-slate-600">2020.12.28. 시행 · 대법원규칙 제2936호</p></div><Select label="보수 산입 유형" value={cost.attorneyFee.treatment === 'half' ? '제5조 1/2 산입' : '일반 본안'} options={['일반 본안', '제5조 1/2 산입']} onChange={value => onChange({ attorneyFee: { ...cost.attorneyFee!, treatment: value === '일반 본안' ? 'ordinary' : 'half' } })} /></div>
      <div className="rounded-lg border border-slate-200 bg-white p-4" data-testid="attorney-fee-calculation">
        <label id={`${outputId}-label`} htmlFor={outputId} className="block text-sm font-semibold text-slate-800">자동 산입액</label>
        <output id={outputId} aria-labelledby={`${outputId}-label`} className="mt-2 block text-xl font-bold tabular-nums text-blue-800">{result.status === 'ready' ? `${BigInt(result.recognized).toLocaleString('ko-KR')}원` : '입력 확인 필요'}</output>
        {result.status === 'ready' ? <ol className="mt-3 space-y-1 text-sm leading-relaxed text-slate-600">{result.attorneyFee?.formula.map(line => <li key={line} className="break-words">{line}</li>)}</ol> : <ul className="mt-3 space-y-1 text-sm text-amber-900">{result.errors.map(error => <li key={error}>{error}</li>)}</ul>}
      </div>
      <p className="text-xs leading-relaxed text-slate-500">입력 소가가 자동 보수의 기준입니다. 배분용 가액·수동 산정 그룹과 구분하며 산입액을 계산서와 상계에 반영합니다. 다른 시기 별표·제6조 재량 조정은 직접 입력으로 검토합니다. <a className="underline" href="https://www.law.go.kr/법령/변호사보수의소송비용산입에관한규칙" target="_blank" rel="noopener noreferrer">적용 규칙 보기</a></p>
    </>}
  </div>;
}
