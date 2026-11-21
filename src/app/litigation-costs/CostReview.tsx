'use client';

import { useState } from 'react';
import { type ApplicationPolicy, type Cost, type Party, type Reviews, type Stage } from './caseInput';
import { add, money, nothing, reviewCosts, subtract, type Amount, type CalculationStep } from './costReview';
import { reviewApplicationCosts } from './applicationCosts';
import { CostStatementModal } from './CostStatementModal';

type Props = {
  parties: Party[];
  stages: Stage[];
  reviews: Reviews;
  applicationCosts: Cost[];
  applicationPolicy?: ApplicationPolicy;
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

export function CostReview({ parties, stages, reviews, applicationCosts, applicationPolicy, label }: Props) {
  const [showStatementModal, setShowStatementModal] = useState(false);
  const { lines, errors, ownerTotals } = reviewCosts(stages, parties);
  const application = reviewApplicationCosts(applicationCosts, parties, stages, applicationPolicy);

  const applicationTotal = (owner: string, debtor: string) =>
    application.lines
      .filter((l) => l.owner === owner && l.debtor === debtor)
      .reduce((sum, l) => add(sum, l.amount), nothing);

  const name = (id: string) => label(parties.find((p) => p.id === id)!);
  const total = (owner: string, debtor: string) =>
    lines
      .filter((l) => l.owner === owner && l.debtor === debtor)
      .reduce((sum, l) => add(sum, l.amount), nothing);

  const applicants = parties.filter((p) => p.group === '신청인');
  const pairs = applicants.flatMap((a) =>
    parties
      .filter(
        (b) =>
          b.group === '피신청인' &&
          [...lines, ...application.lines].some(
            (l) => (l.owner === a.id && l.debtor === b.id) || (l.owner === b.id && l.debtor === a.id)
          )
      )
      .map((b) => ({ a, b }))
  );

  const settlements = pairs.map(({ a, b }) => {
    const r = reviews[b.id];
    const forward = total(a.id, b.id);
    const reverse = total(b.id, a.id);
    const mutual = r?.treatment === '쌍방 비용 상계';
    const only = r?.treatment === '신청인 비용만 반영';
    let missing = '';

    if (!ownerTotals.has(a.id)) missing = '신청인 지출 비용을 확인하세요. 0원이면 금액에 0을 입력하세요.';
    else if (!['기간 내 제출', '기간 내 미제출'].includes(r?.submission || '') || (!mutual && !only))
      missing = '피신청인의 비용자료 제출 상태와 상계 방식을 확인하세요.';
    else if (mutual && r.submission !== '기간 내 제출')
      missing = '기간 내 미제출 상태에서 쌍방 상계를 적용할 수 있는지 검토하세요.';
    else if (only && r.submission !== '기간 내 미제출') missing = '신청인 비용만 반영할 근거를 확인하세요.';
    else if (r.zeroConfirmed && ownerTotals.get(b.id)?.n)
      missing = '피신청인의 지출 비용과 0원 확인이 일치하지 않습니다.';
    else if (mutual && !ownerTotals.has(b.id) && !r.zeroConfirmed)
      missing = '피신청인 비용을 입력하거나 0원임을 확인하세요.';

    const net = subtract(forward, mutual ? reverse : nothing);
    const negative = net.n < BigInt(0);
    const applicationAmount = applicationTotal(a.id, b.id);
    return {
      a,
      b,
      r,
      forward,
      reverse,
      mutual,
      only,
      missing,
      negative,
      net,
      applicationAmount,
      combinedAmount: add(net, applicationAmount),
    };
  });

  const allReviewed = settlements.length > 0 && settlements.every((row) => !row.missing && !row.negative);
  const combined = settlements.reduce((sum, row) => add(sum, row.net), nothing);
  const applicationSum = application.lines.reduce((sum, l) => add(sum, l.amount), nothing);
  const primarySettlement = settlements[0];

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

      {/* 3. [최상단 전진 배치] 최종 상환 결정 금액 하이라이트 카드 (Hero Summary Card) */}
      {(!!lines.length || !!application.lines.length) && primarySettlement && !errors.length && (
        <div className="rounded-xl border-2 border-blue-600/30 bg-gradient-to-br from-blue-50/80 to-indigo-50/40 p-5 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                최종 결정 주문액
              </span>
              <h3 className="mt-2 text-base font-semibold text-slate-800">
                {name(primarySettlement.b.id)}이(가) {name(primarySettlement.a.id)}에게 상환하여야 할 소송비용액
              </h3>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-blue-950 tabular-nums">
                  금 {allReviewed ? money(primarySettlement.combinedAmount) : money(add(primarySettlement.net, primarySettlement.applicationAmount))}
                </span>
                {primarySettlement.negative && (
                  <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    역방향 차액 (피신청인 부담 초과)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1.5 text-xs">
              <div className="inline-flex flex-wrap gap-2">
                <span className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-slate-700">
                  본안 정산액: <strong className="text-slate-900">{money(primarySettlement.net)}</strong>
                </span>
                {!!applicationCosts.length && (
                  <span className="rounded-md border border-blue-200 bg-white px-2.5 py-1 text-slate-700">
                    신청비용: <strong className="text-slate-900">{money(primarySettlement.applicationAmount)}</strong>
                  </span>
                )}
                {primarySettlement.mutual && (
                  <span className="rounded-md border border-purple-200 bg-purple-50 px-2.5 py-1 text-purple-800">
                    쌍방 상계 반영됨
                  </span>
                )}
              </div>
              <span className="text-slate-500 text-[11px]">10원 미만 단계별 절사 적용</span>
            </div>
          </div>
        </div>
      )}

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
                r,
                forward,
                reverse,
                only,
                missing,
                negative,
                net,
                applicationAmount,
                combinedAmount,
              }) => {
                const absNet = negative ? subtract(nothing, net) : net;
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
                        {only ? '신청인 비용만 반영' : r?.treatment === '쌍방 비용 상계' ? '쌍방 비용 상계' : '정산 대기'}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>(+) 신청인 인정액 ({name(b.id)} → {name(a.id)})</span>
                        <span className="font-medium text-slate-900 tabular-nums">{money(forward)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>(-) 피신청인 상계액 ({name(a.id)} → {name(b.id)})</span>
                        <span className="font-medium text-slate-900 tabular-nums">
                          {ownerTotals.has(b.id) || r?.zeroConfirmed ? money(reverse) : '귀속 비용 미확인'}
                          {only && ' (제외)'}
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
                          <span className="font-semibold text-slate-900 text-xs">최종 상환 합산액</span>
                          <span className="text-base font-bold text-blue-900 tabular-nums">
                            {money(combinedAmount)}
                          </span>
                        </div>
                      )}
                      {negative && (
                        <p className="text-xs text-amber-700 mt-1">
                          피신청인의 상환 요구액이 더 큽니다. 반대 방향 절차를 검토하세요.
                        </p>
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
          reviews={reviews}
          applicationCosts={applicationCosts}
          applicationPolicy={applicationPolicy}
          label={label}
          onClose={() => setShowStatementModal(false)}
        />
      )}
    </section>
  );
}
