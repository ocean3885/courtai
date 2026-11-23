'use client';

import React, { useState } from 'react';
import {
  type Cost,
  type Party,
  type Stage,
  stageLevel,
} from './caseInput';
import { money } from './costReview';
import { isApplicantSideParty } from './caseInput';
import { calculateLitigationCosts, describeOrder, expenseRemark, type LitigationCalculation } from './litigationCalculation';

type Props = {
  parties: Party[];
  stages: Stage[];
  applicationCosts: Cost[];
  applicationCaseNumber?: string;
  label: (p: Party) => string;
  onClose: () => void;
  calculation?: LitigationCalculation;
};

function formatWon(n: bigint | number): string {
  return BigInt(n).toLocaleString('ko-KR');
}

export function CostStatementModal({
  parties,
  stages,
  applicationCosts,
  applicationCaseNumber,
  label,
  onClose,
  calculation: suppliedCalculation,
}: Props) {
  const [caseNumberOverride, setCaseNumber] = useState<string | null>(null);
  const caseNumber = caseNumberOverride ?? applicationCaseNumber ?? '';
  const [isEditingCaseNumber, setIsEditingCaseNumber] = useState(false);

  const calculation = suppliedCalculation ?? calculateLitigationCosts(parties, stages, applicationCosts);
  const { main, application, settlements, stageResults } = calculation;
  const applicants = parties.filter(p => p.group === '신청인');
  const respondents = parties.filter(p => p.group === '피신청인');
  const others = parties.filter(p => p.group === '신청외');
  const name = (id: string) => { const p = parties.find(p => p.id === id); return p ? label(p) : '당사자 확인 필요'; };
  const invalid = calculation.errors.length > 0;
  const printBlocked = invalid || !settlements.length || settlements.some(row => row.missing);
  const cell = 'border border-black p-1.5';
  const totalRow = (title: string, applicant: bigint, respondent: bigint, remark = '') => (
    <tr className="bg-slate-50 font-bold">
      <td colSpan={2} className={cell}>{title}</td>
      <td className={cell + ' text-right'}>{invalid ? '확인 필요' : formatWon(applicant)}</td>
      <td className={cell + ' text-right'}>{invalid ? '확인 필요' : formatWon(respondent)}</td>
      <td className={cell + ' text-xs font-normal'}>{remark}</td>
    </tr>
  );

  // 사건번호 모음
  const mainCaseNumbers = stages
    .flatMap((s) => [
      s.number?.trim() ? `${s.number.trim()}${s.counter ? '(본소)' : ''}` : '',
      s.counter && s.counterNumber?.trim() ? `${s.counterNumber.trim()}(반소)` : '',
    ])
    .filter(Boolean)
    .join(', ');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          body *:not(:has(#cost-statement-printable)):not(#cost-statement-printable):not(#cost-statement-printable *) {
            display: none !important;
          }
          body *:has(#cost-statement-printable) {
            display: block !important;
            position: static !important;
            overflow: visible !important;
            max-height: none !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
          }
          #cost-statement-printable, #cost-statement-printable * {
            visibility: visible;
          }
          #cost-statement-printable {
            position: static;
            width: auto;
            max-width: none;
            min-height: 0;
            margin: 0;
            padding: 0;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          #cost-statement-printable tr {
            break-inside: avoid;
          }
          .calculation-trace[open] {
            break-before: page;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-300">
        {/* 상단 툴바 (화면 전용) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-slate-800">📄 소송비용계산서 양식 미리보기</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">법원 표준 서식</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={printBlocked}
              title={printBlocked ? '비용과 부담 주문의 입력을 완료하세요.' : undefined}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              🖨️ PDF 인쇄 / 저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 안내 배너 (화면 전용) */}
        <div className="no-print flex flex-wrap items-center justify-between gap-1.5 border-b border-blue-100 bg-blue-50/70 px-4 py-2 text-xs text-blue-900">
          <span>인쇄 대화상자에서 대상 프린터를 <strong>&apos;PDF로 저장&apos;</strong>으로 선택하시면 실제 법원 소송비용계산서 PDF 파일로 다운로드됩니다.</span>
          <span className="text-slate-500 font-normal">A4 기준</span>
        </div>

        {/* 문서 본문 영역 (출력 대상) */}
        <div className="flex-1 overflow-y-auto bg-slate-100/50 p-3 sm:p-6 md:p-10">
          <div
            id="cost-statement-printable"
            className="mx-auto min-h-[297mm] max-w-[210mm] border border-slate-200 bg-white p-4 font-serif text-slate-900 shadow-sm sm:p-8 md:p-12"
            style={{ fontFamily: "'Batang', 'Apple SD Gothic Neo', serif" }}
          >
            {/* 1. 문서 제목 */}
            <div className="mb-8 text-center">
              <h1 className="pl-[0.25em] text-xl font-bold tracking-[0.25em] text-black sm:pl-[0.5em] sm:text-2xl sm:tracking-[0.5em]">
                소 송 비 용 계 산 서
              </h1>
            </div>

            {/* 2. 사건 및 당사자 정보 */}
            <div className="space-y-1.5 text-sm leading-relaxed mb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-bold">
                  {isEditingCaseNumber ? (
                    <input
                      type="text"
                      className="border border-blue-500 rounded px-1.5 py-0.5 text-sm font-serif"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      onBlur={() => setIsEditingCaseNumber(false)}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => setIsEditingCaseNumber(true)}
                      className="cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded border border-dashed border-transparent hover:border-slate-300 no-print-border"
                      title="클릭하여 사건번호 변경"
                    >
                      {caseNumber || '사건번호 입력'}
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="font-semibold">신청인 : </span>
                <span>
                  {applicants.map(label).join(', ') || '신청인'}
                  {mainCaseNumbers && ` (${mainCaseNumbers})`}
                </span>
              </div>

              {respondents.length > 0 && (
                <div>
                  <span className="font-semibold">피신청인 : </span>
                  <span>{respondents.map(label).join(', ')}</span>
                </div>
              )}

              {!!others.length && <div>신청외 : {others.map(label).join(', ')}</div>}

              {/* 심급별 소가 */}
              <div className="pt-1">
                {stageResults.map(({ stage: s, level: sLevel, mainValue: soga, counterValue: counterSoga, value: combined }, idx) => {
                  const printedLevel = { '1심': '제1심', '항소심': '제2심', '상고심': '제3심' }[sLevel];
                  return (
                    <span key={s.id} className="mr-3">
                      {printedLevel} 소가 : {combined === null ? '입력 확인 필요' : `${formatWon(combined)}원`}
                      {s.counter && (
                        <span className="text-xs text-slate-600">
                          {' '}(본소 {soga === null ? '미입력' : formatWon(soga)} / 반소 {counterSoga === null ? '미입력' : formatWon(counterSoga)}
                          {s.counterFeeMode && ` · ${s.counterFeeMode === '흡수' ? '흡수' : '합산'}`})
                        </span>
                      )}
                      {idx < stages.length - 1 && ', '}
                    </span>
                  );
                })}
              </div>

              {/* 소송비용부담 주문 bullet */}
              <div className="pt-1 space-y-0.5">
                {stages.map((s, idx) => {
                  const sLevel = stageLevel(s, idx);
                  const rules = s.rules || [];
                  return rules.map((r, rIdx) => {
                    const desc = sLevel + ' · ' + describeOrder(r, parties, label);
                    return (
                      <div key={`${s.id}-${rIdx}`} className="text-slate-800">
                        • &ldquo;{desc}&rdquo;
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            {!!calculation.errors.length && <div role="alert" className="mb-4 border border-amber-400 p-3 text-sm">
              <p>입력 확인 필요</p>
              {calculation.errors.map((error, index) => <p key={index}>{error}</p>)}
            </div>}

            <div className="mb-6">
              <h2 className="font-bold text-sm">1. 총 소송비용 (인정액 · 부담률 적용 전)</h2>
              <p className="mb-2 text-xs">단위: 원. 비용별 인정액의 합계이며, 배분·부담률·상계 적용 결과는 아래 관계별 정산액에 표시합니다.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse border border-black text-xs" aria-label="인정 비용 총액">
                <thead><tr className="bg-slate-50">
                  {['심급', '비목', '신청인 측', '상대방 측', '산출 근거·귀속 당사자'].map(title => <th key={title} className={cell}>{title}</th>)}
                </tr></thead>
                <tbody>
                  {stageResults.map(({ stage, level, expenses, totals }) => <React.Fragment key={stage.id}>
                    {expenses.map(expense => {
                      const applicantSide = expense.owners.some(id => parties.some(p => p.id === id && isApplicantSideParty(p)));
                      return <tr key={expense.cost.id}>
                        <td className={cell}>{level}</td>
                        <td className={cell}>{expense.cost.title || expense.cost.kind}</td>
                        <td className={cell + ' text-right'}>{applicantSide ? formatWon(expense.recognized) : ''}</td>
                        <td className={cell + ' text-right'}>{!applicantSide ? formatWon(expense.recognized) : ''}</td>
                        <td className={cell}><div>{expense.owners.map(name).join(', ')}</div>{expenseRemark(expense)}</td>
                      </tr>;
                    })}
                    {totalRow(level + ' 소계', totals.applicant, totals.respondent)}
                  </React.Fragment>)}
                  {totalRow('본안비용소계', calculation.mainTotals.applicant, calculation.mainTotals.respondent)}
                  {application.expenses.map(expense => <tr key={expense.cost.id}>
                    <td className={cell}>소송비용 확정신청</td>
                    <td className={cell}>{expense.cost.title || expense.cost.kind}</td>
                    <td className={cell + ' text-right'}>{formatWon(expense.recognized)}</td>
                    <td className={cell}>-</td>
                    <td className={cell}><div>{expense.owners.map(name).join(', ')}</div>{expenseRemark(expense)}</td>
                  </tr>)}
                  {totalRow('신청비용소계', calculation.applicationTotal, BigInt(0))}
                  {totalRow('합계', calculation.totals.applicant, calculation.totals.respondent, '본안비용 ＋ 신청비용')}
                </tbody>
              </table>
              </div>
            </div>

            <div className="border border-black p-4 mb-8 bg-slate-50/60 space-y-4">
              <h2 className="text-base font-bold text-black">2. 당사자별 최종 정산액</h2>
              {!settlements.length && <p>비용과 부담 주문의 입력을 확인하세요.</p>}
              {settlements.map(row => <div key={row.a.id + ':' + row.b.id}>
                <h3 className="text-sm font-bold">{label(row.a)} ↔ {label(row.b)}</h3>
                {row.missing ? <p className="text-sm">최종 정산액 입력 확인 필요: {row.missing}</p> : <>
                  <p className="text-sm">{label(row.payer)}이(가) {label(row.receiver)}에게 지급할 금액</p>
                  <p className="text-lg font-bold">금 {money(row.payable)}</p>
                  <p className="text-xs">신청인 본안 회수액 {money(row.forward)} − 피신청인 본안 회수액 {money(row.reverse)} = 본안 정산액 {money(row.net)}</p>
                  <p className="text-xs">본안 정산액 {money(row.net)} + 확정신청비용 {money(row.applicationAmount)} = {money(row.combinedAmount)}</p>
                  <p className="text-xs">최종 지급액에서만 1원 미만 버림 · 절사액 {money(row.discarded)}</p>
                </>}
              </div>)}
            </div>

            <details className="calculation-trace mb-6 text-xs">
              <summary className="cursor-pointer font-bold">3. 배분·절사 산출 근거 (펼쳐서 인쇄 가능)</summary>
              <p className="my-2">{calculation.roundingDescription}</p>
              {[...main.lines.map(line => ({ ...line, basis: line.stage + ' 발생 비용 · ' + line.order + ' 적용' })), ...application.lines].map((line, index) => (
                <div key={index} className="mb-3 break-inside-avoid border-b border-slate-200 pb-2">
                  <strong>{line.kind} · {line.basis} · {name(line.owner)} → {name(line.debtor)}: {money(line.amount)}</strong>
                  {!line.steps.length && <p>배분 및 부담률 1 · {money(line.amount)}</p>}
                  {line.steps.map((step, i) => <p key={i}>
                    {step.label}: {money(step.input)} × {String(step.factor.n)}/{String(step.factor.d)} = {money(step.amount)}
                  </p>)}
                  <p>중간 절사 없는 정밀값 {money(line.exactAmount)}</p>
                </div>
              ))}
            </details>

            {/* 5. 각주 (Footnotes) */}
            <div className="border-t border-slate-300 pt-3 text-[11px] text-slate-600 leading-relaxed space-y-1">
              <div>
                1) 변호사보수액은 대법원규칙에 의하여 산정된 금액과 실제 지급한(또는 지급할) 금액 중 적은 금액을 소송비용으로 인정한다(민사소송법 제109조 제1항, 변호사보수의 소송비용 산입에 관한 규칙 제3조 제1항).
              </div>
              <div>
                2) 소송비용액확정신청비용의 분담비율은 본안 확정 판결의 소송비용부담 재판에서의 비율에 따라 산정한다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
