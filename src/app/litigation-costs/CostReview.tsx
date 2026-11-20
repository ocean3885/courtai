import { useState } from 'react';
import { type Cost, type Party, type Reviews, type Stage } from './caseInput';
import { add, expenseNet, money, nothing, reviewCosts, subtract } from './costReview';

type Props = {
  parties: Party[];
  stages: Stage[];
  reviews: Reviews;
  applicationCosts: Cost[];
  label: (p: Party) => string;
};

const heading = 'mb-2.5 text-sm font-bold text-slate-900';

function formatTruncated(amount: { n: bigint; d: bigint }, unit: 1 | 10 = 1): string {
  const negative = amount.n < BigInt(0);
  const absN = negative ? -amount.n : amount.n;
  const floored = absN / amount.d;
  const u = BigInt(unit);
  const truncated = (floored / u) * u;
  return (negative && truncated > BigInt(0) ? '-' : '') + truncated.toLocaleString('ko-KR') + '원';
}

export function CostReview({ parties, stages, reviews, applicationCosts, label }: Props) {
  const [roundingUnit, setRoundingUnit] = useState<1 | 10>(1);
  const { lines, errors, ownerTotals } = reviewCosts(stages, parties);
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
          lines.some(
            (l) => (l.owner === a.id && l.debtor === b.id) || (l.owner === b.id && l.debtor === a.id)
          )
      )
      .map((b) => ({ a, b }))
  );
  const settlements = pairs.map(({ a, b }) => {
    const r = reviews[b.id];
    const forward = total(a.id, b.id),
      reverse = total(b.id, a.id);
    const mutual = r?.treatment === '쌍방 비용 상계';
    const only = r?.treatment === '신청인 비용만 반영';
    let missing = '';
    if (!ownerTotals.has(a.id)) missing = '신청인 귀속 비용을 확인하세요. 0원이면 금액에 0을 입력하세요.';
    else if (!['기간 내 제출', '기간 내 미제출'].includes(r?.submission || '') || (!mutual && !only))
      missing = '피신청인의 비용자료 제출 상태와 상계 방식을 확인하세요.';
    else if (mutual && r.submission !== '기간 내 제출')
      missing = '기간 내 미제출 상태에서 쌍방 상계를 적용할 수 있는지 검토하세요.';
    else if (only && r.submission !== '기간 내 미제출') missing = '신청인 비용만 반영할 근거를 확인하세요.';
    else if (r.zeroConfirmed && ownerTotals.get(b.id)?.n)
      missing = '피신청인의 귀속 비용과 0원 확인이 일치하지 않습니다.';
    else if (mutual && !ownerTotals.has(b.id) && !r.zeroConfirmed)
      missing = '피신청인 비용을 입력하거나 0원임을 확인하세요.';
    const net = subtract(forward, mutual ? reverse : nothing);
    const negative = net.n < BigInt(0);
    return { a, b, r, forward, reverse, only, missing, negative, net };
  });
  const allReviewed = settlements.length > 0 && settlements.every((row) => !row.missing && !row.negative);
  const combined = settlements.reduce((sum, row) => add(sum, row.net), nothing);

  const totalApplicationExpense = (() => {
    if (!applicationCosts.length) return null;
    try {
      return applicationCosts.reduce((acc, c) => acc + expenseNet(c), BigInt(0));
    } catch {
      return null;
    }
  })();

  const combinedFloor = combined.n >= BigInt(0) ? combined.n / combined.d : BigInt(0);

  return (
    <section
      id="cost-review"
      className="scroll-mt-24 space-y-5 rounded-xl border border-slate-300 bg-white p-5 shadow-xs"
      aria-label="비용 배분 검산"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">비용 배분 검산</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            정밀 분수 계산 결과와 절사(단수 처리) 참고 금액을 함께 대조합니다.
          </p>
        </div>
        {!!lines.length && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
            <span className="font-semibold text-slate-700">절사 참고 기준:</span>
            <label className="flex cursor-pointer items-center gap-1 text-slate-800">
              <input
                type="radio"
                name="review-rounding-unit"
                className="accent-blue-700"
                checked={roundingUnit === 1}
                onChange={() => setRoundingUnit(1)}
              />
              원 미만 버림
            </label>
            <label className="flex cursor-pointer items-center gap-1 text-slate-800">
              <input
                type="radio"
                name="review-rounding-unit"
                className="accent-blue-700"
                checked={roundingUnit === 10}
                onChange={() => setRoundingUnit(10)}
              />
              10원 미만 버림
            </label>
          </div>
        )}
      </div>

      {!lines.length && !errors.length && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
          본안 지출 비용과 부담 관계를 입력하면 당사자별 부담액과 산식이 표시됩니다.
        </p>
      )}
      {!!errors.length && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-bold text-amber-950">입력 확인 ({errors.length}건)</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {!!lines.length && (
        <>
          <div>
            <h3 className={heading}>심급별 부담 내역</h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[540px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                  <tr className="border-b border-slate-200">
                    {['심급·비목', '비용 귀속자', '부담자', '산식', '부담액'].map((t) => (
                      <th key={t} className="p-2.5">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lines.map((l, i) => (
                    <tr key={i} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-medium text-slate-900">
                        {l.stage} · {l.kind}
                        <small className="mt-0.5 block text-xs font-normal text-slate-500">
                          {l.order} 적용
                        </small>
                      </td>
                      <td className="p-2.5 text-slate-700">{name(l.owner)}</td>
                      <td className="p-2.5 text-slate-700">{name(l.debtor)}</td>
                      <td className="p-2.5 font-mono text-xs text-slate-600">{l.formula}</td>
                      <td className="p-2.5 font-semibold tabular-nums text-slate-900">
                        {money(l.amount)}
                        {l.amount.d !== BigInt(1) && (
                          <span className="ml-1.5 block text-xs font-normal text-slate-500">
                            (절사 참고 {formatTruncated(l.amount, roundingUnit)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className={heading}>이번 신청의 상환 관계</h3>
            <div className="space-y-2.5">
              {settlements.map(({ a, b, r, forward, reverse, only, missing, negative, net }) => {
                const absNet = negative ? subtract(nothing, net) : net;
                return (
                  <div
                    key={a.id + b.id}
                    className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-sm"
                  >
                    <strong className="block text-slate-900">
                      {name(a.id)} · {name(b.id)}
                    </strong>
                    <p className="tabular-nums text-slate-700">
                      {name(b.id)} → {name(a.id)}　{money(forward)}
                      {forward.d !== BigInt(1) && (
                        <span className="ml-1.5 text-xs text-slate-500">
                          (절사 참고 {formatTruncated(forward, roundingUnit)})
                        </span>
                      )}
                    </p>
                    <p className="tabular-nums text-slate-700">
                      {name(a.id)} → {name(b.id)}　
                      {ownerTotals.has(b.id) || r?.zeroConfirmed ? money(reverse) : '귀속 비용 미확인'}
                      {only && ' (상계 제외)'}
                    </p>
                    {missing ? (
                      <p className="pt-1 font-medium text-amber-900">{missing}</p>
                    ) : (
                      <p className="pt-1 font-semibold tabular-nums text-blue-900">
                        {net.n === BigInt(0)
                          ? '본안 비용 차액 0원'
                          : (negative
                              ? name(a.id) + ' → ' + name(b.id)
                              : name(b.id) + ' → ' + name(a.id)) +
                            ' · 본안 비용 차액 ' +
                            money(absNet)}
                        {net.n !== BigInt(0) && absNet.d !== BigInt(1) && (
                          <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-950">
                            {roundingUnit === 10 ? '10원 미만 버림' : '원 미만 버림'} 시{' '}
                            {formatTruncated(absNet, roundingUnit)}
                          </span>
                        )}
                        {negative && ' (역방향 차액 · 절차 검토)'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {allReviewed && (
              <div className="mt-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <p className="font-bold tabular-nums text-slate-900">
                  표시된 본안 상환액 합계　{money(combined)}
                  {combined.d !== BigInt(1) && (
                    <span className="ml-2 text-sm font-semibold text-blue-900">
                      ({roundingUnit === 10 ? '10원 미만 버림' : '원 미만 버림'} 참고:{' '}
                      {formatTruncated(combined, roundingUnit)})
                    </span>
                  )}
                </p>
                {totalApplicationExpense !== null && totalApplicationExpense > BigInt(0) && (
                  <p className="text-xs tabular-nums text-slate-600">
                    소송비용액확정신청 실지출 합산 참고 (전액 산입 가정 시){' '}
                    <strong className="text-slate-900">
                      {(
                        (combinedFloor / BigInt(roundingUnit)) * BigInt(roundingUnit) +
                        totalApplicationExpense
                      ).toLocaleString('ko-KR')}
                      원
                    </strong>{' '}
                    (본안 절사액 {formatTruncated(combined, roundingUnit)} + 신청비용{' '}
                    {totalApplicationExpense.toLocaleString('ko-KR')}원)
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
      {!!applicationCosts.length && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <h3 className={heading}>소송비용액확정신청 · 실지출 소계</h3>
          <div className="space-y-1 text-sm">
            {applicants.map((p) => {
              const costs = applicationCosts.filter((c) => c.payer === p.id);
              if (!costs.length) return null;
              let summary: string;
              try {
                summary =
                  costs.reduce((a, c) => a + expenseNet(c), BigInt(0)).toLocaleString('ko-KR') + '원';
              } catch {
                summary = '납부액·환급액 확인';
              }
              return (
                <p key={p.id} className="font-medium tabular-nums text-slate-800">
                  {label(p)}　{summary}
                </p>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">본안 비용 차액과 별도로 표시합니다.</p>
        </div>
      )}
    </section>
  );
}
