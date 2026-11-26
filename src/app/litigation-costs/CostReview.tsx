'use client';

import { useState } from 'react';
import { isApplicantSideParty, type Cost, type Party, type Stage } from './caseInput';
import { money, type Amount, type ReviewedExpense } from './costReview';
import { calculateLitigationCosts, expenseRemark, type LitigationCalculation } from './litigationCalculation';
import { CostStatementModal } from './CostStatementModal';
import { buildSettlementReport } from './settlementReport';

type Props = {
  parties: Party[];
  stages: Stage[];
  applicationCosts: Cost[];
  applicationCaseNumber?: string;
  label: (p: Party) => string;
};

const heading = 'mb-2.5 text-sm font-bold text-slate-900';

type Settlement = LitigationCalculation['settlements'][number];

function readableWon(amount: Amount): string {
  if (amount.d === BigInt(1)) return money(amount);
  const wholeWon = amount.n / amount.d;
  if (wholeWon === BigInt(0)) return amount.n < BigInt(0) ? '음수 · 1원 미만' : '1원 미만';
  return `약 ${wholeWon.toLocaleString('ko-KR')}원`;
}

function SettlementDetails({ rows, formula, label }: { rows: Settlement[]; formula: string; label: (p: Party) => string }) {
  const row = rows[0];
  const recipients = rows.map(item => label(item.receiver)).join(', ');
  return <details className="group text-left">
    <summary aria-label={rows.map(item => label(item.a) + ' · ' + label(item.b)).join(', ') + ' 계산 상세'} className="cursor-pointer whitespace-nowrap text-sm font-semibold text-blue-700 hover:text-blue-900">계산 상세</summary>
    {rows.length > 1 && <p className="mt-2 text-xs text-slate-600">아래 금액은 각 당사자 관계별 금액입니다.</p>}
    <p className="mt-2 break-words rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-relaxed tabular-nums text-slate-800" aria-label="상환액 산식">상환액 산식 = {formula}</p>
    <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div><dt>A · 피신청인이 신청인에게 부담할 본안비용</dt><dd className="mt-1 break-all font-medium tabular-nums">{readableWon(row.forward)}</dd></div>
      <div><dt>B · 신청인이 피신청인에게 부담할 본안비용</dt><dd className="mt-1 break-all font-medium tabular-nums">{readableWon(row.reverse)}{row.respondentRecoveryExcluded && ' (판결 주문상 상환 없음)'}</dd></div>
      <div className="border-t border-slate-200 pt-2"><dt>본안 차액 · A − B (신청인 기준)</dt><dd className="mt-1 break-all tabular-nums">{readableWon(row.net)}</dd></div>
      <div><dt>C · 확정신청비용 중 피신청인 부담액</dt><dd className="mt-1 break-all tabular-nums">{readableWon(row.applicationAmount)}</dd></div>
      <div><dt>정산 차액 · A − B + C (신청인 기준)</dt><dd className="mt-1 break-all tabular-nums">{readableWon(row.combinedAmount)}{row.negative && ' (신청인 지급 방향)'}</dd></div>
      <div className="border-t border-slate-200 pt-2"><dt>최종 지급액에서만 1원 미만 버림</dt><dd className="mt-1 break-all tabular-nums">{row.payable.n === BigInt(0) ? '지급할 금액 없음' : `${label(row.payer)} → ${recipients} ${rows.length > 1 ? '각 ' : ''}${money(row.payable)}`} · 절사액 {readableWon(row.discarded)}</dd></div>
    </dl>
    <p className="mt-2 text-xs text-slate-500">중간 금액은 보기 쉽게 원 미만을 생략한 참고값입니다. 표시값끼리 계산하면 차이가 날 수 있으며, 실제 정산은 생략 전 정밀값으로 계산합니다.</p>
  </details>;
}

export function CostReview({ parties, stages, applicationCosts, applicationCaseNumber, label }: Props) {
  const [showStatementModal, setShowStatementModal] = useState(false);
  if (stages.some(stage => stage.counter && stage.partialCounter)) {
    return <section id="cost-review" aria-label="소송비용 계산 및 상환액 산출"
      className="scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950">
      <h2 className="text-lg font-bold">소송비용 계산 및 상환액 산출</h2>
      <p className="mt-2">일부반소 당사자 선택은 저장됩니다. 해당 범위의 상환액 계산과 PDF 인쇄는 아직 지원하지 않아 결과를 표시하지 않습니다.</p>
    </section>;
  }
  const calculation = calculateLitigationCosts(parties, stages, applicationCosts);
  const { main, application, settlements } = calculation;
  const { lines, errors } = main;
  const report = buildSettlementReport(calculation);
  const hasExpenses = !!main.expenses.length || !!application.expenses.length;
  const stagesWithExpenses = calculation.stageResults.filter(result => result.expenses.length);
  const won = (amount: bigint) => `${amount.toLocaleString('ko-KR')}원`;
  const subtotal = (title: string, applicant: bigint, respondent: bigint, invalid: boolean, key = title) => (
    <tr key={key} className="bg-slate-50 font-semibold text-slate-900">
      <th scope="row" colSpan={2} className="border-t border-slate-200 px-3 py-2 text-left">{title}</th>
      <td className="whitespace-nowrap border-t border-slate-200 px-3 py-2 text-right tabular-nums">{invalid ? '확인 필요' : won(applicant)}</td>
      <td className="whitespace-nowrap border-t border-slate-200 px-3 py-2 text-right tabular-nums">{invalid ? '확인 필요' : won(respondent)}</td>
      <td className="border-t border-slate-200 px-3 py-2" />
    </tr>
  );
  const expenseRow = (expense: ReviewedExpense, scope: string, key: string) => {
    const applicantSide = expense.owners.some(id => parties.some(p => p.id === id && isApplicantSideParty(p)));
    const remark = expenseRemark(expense);
    return <tr key={key} className="border-t border-slate-100 align-top">
      <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{scope}</td>
      <th scope="row" className="px-3 py-2.5 text-left font-medium text-slate-900">{expense.cost.title || expense.cost.kind}</th>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{applicantSide ? won(expense.recognized) : '—'}</td>
      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{applicantSide ? '—' : won(expense.recognized)}</td>
      <td className="min-w-[260px] max-w-[440px] break-words px-3 py-2.5 text-xs leading-relaxed text-slate-600">{remark || '—'}</td>
    </tr>;
  };

  return (
    <section
      id="cost-review"
      className="scroll-mt-24 space-y-6 rounded-xl border border-slate-300 bg-white p-5 md:p-6 shadow-sm"
      aria-label="소송비용 계산 및 상환액 산출"
    >
      {/* 1. 메인 섹션 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">소송비용 계산 및 상환액 산출</h2>
          <p className="mt-1 text-xs text-slate-500">
            판결 주문의 부담 비율과 법정 한도 및 상계를 반영한 최종 정산 결과입니다.
          </p>
        </div>
        {(!!lines.length || !!application.lines.length) && (
          <button
            type="button"
            onClick={() => setShowStatementModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-xs hover:bg-blue-100 hover:text-blue-800 transition cursor-pointer"
          >
            📄 소송비용계산서 양식 보기 / PDF 인쇄
          </button>
        )}
      </div>

      {/* 2. 오류 및 안내 메시지 */}
      {!lines.length && !errors.length && !application.lines.length && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600 text-center">
          본안 지출 비용과 재판부 부담 주문을 입력하면 당사자별 상환액과 상세 산식이 자동으로 산출됩니다.
        </p>
      )}

      {!!errors.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-950">입력 확인 필요 ({errors.length}건)</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {!!application.errors.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-950">신청비용 입력 확인 필요</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {application.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {!!settlements.length && <div className="space-y-2" aria-label="최종 상환액 및 계산 내역">
        <h3 className={heading}>최종 상환액 및 계산 내역</h3>
        <ol className="divide-y divide-slate-200 rounded-lg border border-slate-200">
          {report.map(({ rows, formula }, index) => {
            const row = rows[0];
            const marker = index < 14 ? '가나다라마바사아자차카타파하'[index] : String(index + 1);
            const recipients = rows.map(item => label(item.receiver)).join(', ');
            return <li key={row.a.id + ':' + row.b.id} className="min-w-0 space-y-2 p-3 sm:px-4">
              <h4 className="break-words text-sm font-semibold leading-relaxed text-slate-900">
                {marker}. {row.missing
                  ? <>{label(row.b)} · {label(row.a)} <span className="text-amber-800">계산 미완료</span></>
                  : row.payable.n === BigInt(0)
                    ? <>{label(row.b)} · {label(row.a)} <span className="text-slate-600">지급할 금액 없음</span></>
                    : <>{label(row.payer)} → {recipients}에게 {rows.length > 1 ? '각 ' : ''}<strong className="tabular-nums text-blue-950">{money(row.payable)}</strong></>}
              </h4>
              {row.missing && <p className="text-xs text-amber-800">{row.missing}</p>}
              {!row.missing && <SettlementDetails rows={rows} formula={formula} label={label} />}
            </li>;
          })}
        </ol>
      </div>}

      {hasExpenses && <div className="space-y-2" aria-label="인정 비용 총액">
        <h3 className={heading}>인정 비용 내역 <span className="font-normal text-slate-500">(부담률 적용 전)</span></h3>
        <p className="text-xs text-slate-600">지출 비용 중 인정된 금액입니다. 실제 지급액은 위 최종 상환액에 표시됩니다.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[840px] text-sm" aria-label="심급·비목별 인정 비용">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th scope="col" className="px-3 py-2.5 text-left">심급</th>
                <th scope="col" className="px-3 py-2.5 text-left">비목</th>
                <th scope="col" className="px-3 py-2.5 text-right">신청인 측</th>
                <th scope="col" className="px-3 py-2.5 text-right">상대방 측</th>
                <th scope="col" className="px-3 py-2.5 text-left">산출 근거</th>
              </tr>
            </thead>
            <tbody>
              {stagesWithExpenses.flatMap(({ stage, level, expenses, totals }) => [
                ...expenses.map((expense, index) => expenseRow(expense, level, `${stage.id}:${expense.cost.id}:${index}`)),
                subtotal(`${level} 소계`, totals.applicant, totals.respondent, !!main.errors.length, `${stage.id}:subtotal`),
              ])}
              {stagesWithExpenses.length > 1 && subtotal('본안비용소계', calculation.mainTotals.applicant, calculation.mainTotals.respondent, !!main.errors.length)}
              {!!application.expenses.length && <>
                {application.expenses.map((expense, index) => expenseRow(expense, '확정신청', `application:${expense.cost.id}:${index}`))}
                {subtotal('신청비용소계', calculation.applicationTotal, BigInt(0), !!application.errors.length)}
              </>}
              {subtotal('인정 비용 합계', calculation.totals.applicant, calculation.totals.respondent, !!calculation.errors.length)}
            </tbody>
          </table>
        </div>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
          <strong className="mr-2 text-slate-800">계산 기준</strong>
          {calculation.roundingDescription}
        </p>
      </div>}

      {/* 소송비용계산서 모달 */}
      {showStatementModal && (
        <CostStatementModal
          parties={parties}
          stages={stages}
          applicationCosts={applicationCosts}
          applicationCaseNumber={applicationCaseNumber}
          calculation={calculation}
          label={label}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </section>
  );
}
