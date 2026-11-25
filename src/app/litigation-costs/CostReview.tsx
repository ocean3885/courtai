'use client';

import { useState } from 'react';
import { type Cost, type Party, type Stage } from './caseInput';
import { money, type Amount, type CalculationStep } from './costReview';
import { calculateLitigationCosts, type LitigationCalculation } from './litigationCalculation';
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

function CalculationDetails({ steps, amount }: { steps: CalculationStep[]; amount: Amount }) {
  if (!steps.length) {
    return <span className="text-slate-600 font-sans">{money(amount)} (전액 부담)</span>;
  }

  const lastStep = steps[steps.length - 1];

  return (
    <details className="group cursor-pointer">
      <summary className="font-sans text-xs text-blue-700 hover:text-blue-900 list-none flex items-center gap-1">
        <span className="font-semibold">{lastStep.label}: {lastStep.factor.n.toString()}/{lastStep.factor.d.toString()}</span>
        <span className="text-slate-400 group-open:rotate-180 transition-transform text-[10px]">▼</span>
      </summary>
      <div className="mt-1.5 space-y-1 rounded bg-slate-50 p-2 text-xs text-slate-700 border border-slate-200">
        {steps.map((step, i) => (
          <div key={i} className="leading-relaxed">
            <span className="font-medium text-slate-800">{step.label}</span>: {money(step.input)} × {step.factor.n.toString()}/{step.factor.d.toString()}
            {' = '}<strong className="text-slate-900">{money(step.amount)}</strong>
          </div>
        ))}
        <div className="border-t border-slate-200 pt-1 text-slate-500 text-[11px]">중간 절사 없이 계산하며 최종 지급액에서만 1원 미만을 버립니다.</div>
      </div>
    </details>
  );
}

type Settlement = LitigationCalculation['settlements'][number];

function SettlementDetails({ row, label }: { row: Settlement; label: (p: Party) => string }) {
  return <details className="group text-left">
    <summary aria-label={label(row.a) + ' · ' + label(row.b) + ' 계산 상세'} className="cursor-pointer whitespace-nowrap text-sm font-semibold text-blue-700 hover:text-blue-900">계산 상세</summary>
    <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <div><dt>A · 신청인 본안 회수액</dt><dd className="mt-1 break-all font-medium tabular-nums">{row.applicantEntered ? money(row.forward) : '비용 미입력'}</dd></div>
      <div><dt>B · 피신청인 본안 회수액</dt><dd className="mt-1 break-all font-medium tabular-nums">{row.respondentEntered || row.respondentRecoveryExcluded ? money(row.reverse) : '비용 미입력'}{row.respondentRecoveryExcluded && ' (판결 주문상 상환 없음)'}</dd></div>
      {!row.missing && <>
        <div className="border-t border-slate-200 pt-2"><dt>본안 정산액 · A − B</dt><dd className="mt-1 break-all tabular-nums">{money(row.net)}</dd></div>
        <div><dt>확정신청비용 부담액</dt><dd className="mt-1 break-all tabular-nums">{money(row.applicationAmount)}</dd></div>
        <div><dt>본안 정산액 + 확정신청비용</dt><dd className="mt-1 break-all tabular-nums">{money(row.combinedAmount)}</dd></div>
        <div className="border-t border-slate-200 pt-2"><dt>최종 지급액에서만 1원 미만 버림</dt><dd className="mt-1 break-all">절사액 {money(row.discarded)}</dd></div>
      </>}
      {row.missing && <div className="text-amber-800">{row.missing}</div>}
    </dl>
  </details>;
}

export function CostReview({ parties, stages, applicationCosts, applicationCaseNumber, label }: Props) {
  const [showStatementModal, setShowStatementModal] = useState(false);
  const calculation = calculateLitigationCosts(parties, stages, applicationCosts);
  const { main, application, settlements } = calculation;
  const { lines, errors } = main;
  const report = buildSettlementReport(calculation);
  const name = (id: string) => label(parties.find(p => p.id === id)!);

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
            판결 주문의 부담 비율과 법정 한도 및 상계를 반영한 최종 정산 결과입니다. 중간 절사 없이 계산하고 최종 지급액에서만 1원 미만을 버립니다.
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
              {row.missing
                ? <p className="text-xs text-amber-800">{row.missing}</p>
                : <p className="break-words text-xs leading-relaxed tabular-nums text-slate-700" aria-label="상환액 산식">= {formula}</p>}
              <SettlementDetails row={row} label={label} />
            </li>;
          })}
        </ol>
        <p className="text-xs text-slate-500">산식은 원 단위이며, 최종 지급액에서만 1원 미만을 버립니다.</p>
      </div>}

      {(!!main.expenses.length || !!application.expenses.length) && (
        <details className="space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">인정 비용 총액 (부담률 적용 전)</summary>
          {calculation.errors.length ? <p>인정 비용 합계 입력 확인 필요</p> : <>
            <p>본안비용소계: 신청인 측 {calculation.mainTotals.applicant.toLocaleString('ko-KR')}원 · 상대방 측 {calculation.mainTotals.respondent.toLocaleString('ko-KR')}원</p>
            <p>신청비용소계: {calculation.applicationTotal.toLocaleString('ko-KR')}원</p>
            <p>합계: 신청인 측 {calculation.totals.applicant.toLocaleString('ko-KR')}원 · 상대방 측 {calculation.totals.respondent.toLocaleString('ko-KR')}원</p>
          </>}
          <p className="text-xs text-slate-500">관계별 정산액은 인정 비용에 배분·부담비율과 상계를 적용한 금액입니다.</p>
          <details className="text-xs text-slate-500"><summary className="cursor-pointer font-semibold">계산 기준</summary><p className="mt-2 leading-relaxed">{calculation.roundingDescription}</p></details>
        </details>
      )}

      {/* 4. 본안 소송비용 심급별 부담 내역 테이블 */}
      {!!lines.length && (
        <details className="space-y-3 rounded-lg border border-slate-200 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">본안 비용 계산 상세 <span className="ml-2 font-normal text-slate-500">{lines.length}개 항목</span></summary>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[540px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                <tr className="border-b border-slate-200">
                  {['심급·비목', '지출 당사자', '부담 당사자', '산출 근거 (부담률)', '부담액'].map((t) => (
                    <th key={t} className="p-3">
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => (
                  <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-medium text-slate-900">
                      {l.stage} · {l.kind}
                      <small className="mt-0.5 block text-xs font-normal text-slate-500">
                        {l.order} 적용
                      </small>
                    </td>
                    <td className="p-3 text-slate-700">{name(l.owner)}</td>
                    <td className="p-3 text-slate-700">{name(l.debtor)}</td>
                    <td className="p-3">
                      <CalculationDetails steps={l.steps} amount={l.amount} />
                    </td>
                    <td className="p-3 font-semibold tabular-nums text-slate-900 text-right">
                      {money(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* 5. 확정신청비용 부담 내역 테이블 */}
      {!!applicationCosts.length && (
        <details className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <summary className="cursor-pointer text-sm font-bold text-slate-900">확정신청비용 계산 상세</summary>
          {!!application.lines.length && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                  <tr>
                    {['비목', '지출 당사자', '부담 당사자', '산출 근거', '부담액'].map((t) => (
                      <th className="p-2.5" key={t}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {application.lines.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="p-2.5">
                        {l.kind}
                        <small className="block text-xs text-slate-500">{l.basis}</small>
                      </td>
                      <td className="p-2.5 text-slate-700">{name(l.owner)}</td>
                      <td className="p-2.5 text-slate-700">{name(l.debtor)}</td>
                      <td className="p-2.5">
                        <CalculationDetails steps={l.steps} amount={l.amount} />
                      </td>
                      <td className="p-2.5 font-semibold tabular-nums text-slate-900 text-right">
                        {money(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">
            신청비용도 중간 절사 없이 계산하여 본안 정산액에 더하고, 최종 지급액에서만 1원 미만을 버립니다.
          </p>
        </details>
      )}

      {/* 7. 소송비용계산서 모달 */}
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
