'use client';

import { useState } from 'react';
import { type Cost, type Party, type Stage } from './caseInput';
import { money, type Amount, type CalculationStep } from './costReview';
import { calculateLitigationCosts } from './litigationCalculation';
import { CostStatementModal } from './CostStatementModal';

type Props = {
  parties: Party[];
  stages: Stage[];
  applicationCosts: Cost[];
  applicationCaseNumber?: string;
  label: (p: Party) => string;
};

const heading = 'mb-2.5 text-sm font-bold text-slate-900';

function CalculationDetails({ steps, exactAmount, amount }: { steps: CalculationStep[]; exactAmount: Amount; amount: Amount }) {
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
            {' = '}{money(step.raw)} → <strong className="text-slate-900">{money(step.amount)}</strong>
            <span className="ml-1 text-slate-400 text-[11px]">(10원 미만 버림)</span>
            <span className="ml-1 text-slate-500">절사액 {money(step.discarded)}</span>
          </div>
        ))}
        {exactAmount.n * amount.d !== amount.n * exactAmount.d && (
          <div className="border-t border-slate-200 pt-1 text-slate-500 text-[11px]">
            절사 전 정밀값: {money(exactAmount)} (최종 합계는 단계별 절사액 반영)
          </div>
        )}
      </div>
    </details>
  );
}

export function CostReview({ parties, stages, applicationCosts, applicationCaseNumber, label }: Props) {
  const [showStatementModal, setShowStatementModal] = useState(false);
  const calculation = calculateLitigationCosts(parties, stages, applicationCosts);
  const { main, application, settlements } = calculation;
  const { lines, errors } = main;
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
            판결 주문의 부담 비율과 법정 한도 및 상계를 반영한 최종 정산 결과입니다. 각 배분 단계에서 10원 미만을 버리고 합산합니다.
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

      {(!!main.expenses.length || !!application.expenses.length) && (
        <div className="space-y-2 text-sm">
          <h3 className={heading}>인정 비용 총액 (부담률 적용 전)</h3>
          {calculation.errors.length ? <p>인정 비용 합계 입력 확인 필요</p> : <>
            <p>본안비용소계: 신청인 측 {calculation.mainTotals.applicant.toLocaleString('ko-KR')}원 · 상대방 측 {calculation.mainTotals.respondent.toLocaleString('ko-KR')}원</p>
            <p>신청비용소계: {calculation.applicationTotal.toLocaleString('ko-KR')}원</p>
            <p>합계: 신청인 측 {calculation.totals.applicant.toLocaleString('ko-KR')}원 · 상대방 측 {calculation.totals.respondent.toLocaleString('ko-KR')}원</p>
          </>}
          <p className="text-xs text-slate-500">아래 관계별 정산액은 인정 비용에 배분·부담비율과 상계를 적용한 금액입니다.</p>
          <p className="text-xs text-slate-500">{calculation.roundingDescription}</p>
        </div>
      )}

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

      {settlements.map(row => (
        <div key={row.a.id + ':' + row.b.id} className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <h3 className="text-base font-semibold text-slate-900">{label(row.a)} ↔ {label(row.b)}</h3>
          {row.missing ? <p className="text-sm text-amber-800">{row.missing}</p> : <>
            <p className="text-sm text-slate-700">{label(row.payer)}이(가) {label(row.receiver)}에게 지급할 최종 금액</p>
            <p className="text-3xl font-extrabold text-blue-950 tabular-nums">{money(row.payable)}</p>
            <p className="text-xs text-slate-600">본안 정산액 {money(row.net)} + 확정신청비용 {money(row.applicationAmount)} · 단계별 절사 반영</p>
          </>}
        </div>
      ))}

      {/* 4. 본안 소송비용 심급별 부담 내역 테이블 */}
      {!!lines.length && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className={heading}>본안 소송비용 심급별 부담 내역</h3>
            <span className="text-xs text-slate-500">총 {lines.length}개 항목</span>
          </div>
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
                      <CalculationDetails steps={l.steps} exactAmount={l.exactAmount} amount={l.amount} />
                    </td>
                    <td className="p-3 font-semibold tabular-nums text-slate-900 text-right">
                      {money(l.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. 확정신청비용 부담 내역 테이블 */}
      {!!applicationCosts.length && (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">확정신청비용 부담 내역</h3>
            <span className="text-xs text-slate-500">인지대·송달료·발급비</span>
          </div>
          {!!application.lines.length && (
            <div className="overflow-x-auto rounded border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
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
                        <CalculationDetails steps={l.steps} exactAmount={l.exactAmount} amount={l.amount} />
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
            신청비용도 각 배분 및 부담률 적용 단계에서 10원 미만을 버린 뒤 합산합니다.
          </p>
        </div>
      )}

      {/* 6. 당사자별 상환 및 상계 정산 상세 카드 */}
      {(!!lines.length || !!application.lines.length) && (
        <div className="space-y-3">
          <h3 className={heading}>당사자별 상환 및 상계 정산 내역</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {settlements.map(
              ({
                a,
                b,
                forward,
                reverse,
                missing,
                applicationAmount,
                respondentEntered,
                respondentRecoveryExcluded,
                applicantEntered,
                payer,
                receiver,
                payable,
              }) => {
                return (
                  <div
                    key={a.id + b.id}
                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <strong className="text-slate-900 font-bold">
                        {name(a.id)} ↔ {name(b.id)}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {missing ? '입력 확인 필요' : '입력 비용 자동 상계'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>(+) 신청인 인정액 ({name(b.id)} → {name(a.id)})</span>
                        <span className="font-medium text-slate-900 tabular-nums">{applicantEntered ? money(forward) : '비용 미입력'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>(-) 피신청인 상계액 ({name(a.id)} → {name(b.id)})</span>
                        <span className="font-medium text-slate-900 tabular-nums">
                          {respondentEntered || respondentRecoveryExcluded ? money(reverse) : '비용 미입력'}
                          {respondentRecoveryExcluded && ' (판결 주문상 상환 없음)'}
                        </span>
                      </div>
                      {!!applicationCosts.length && (
                        <div className="flex justify-between">
                          <span>(+) 확정신청비용 부담액</span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {application.errors.length ? '확인 필요' : money(applicationAmount)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      {missing ? (
                        <p className="font-medium text-amber-800 text-xs">{missing}</p>
                      ) : (
                        <div className="flex justify-between items-baseline">
                          <span className="font-semibold text-slate-900 text-xs">{label(payer)} → {label(receiver)}</span>
                          <span className="text-base font-bold text-blue-900 tabular-nums">
                            {money(payable)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
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
