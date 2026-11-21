import { type ApplicationPolicy, type Cost, type Party, type Reviews, type Stage } from './caseInput';
import { add, money, nothing, reviewCosts, subtract, type Amount, type CalculationStep } from './costReview';
import { reviewApplicationCosts } from './applicationCosts';

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
  return <div className="space-y-1 text-xs">
    {steps.length ? steps.map((step, i) => <div key={i}>
      <span className="font-medium">{step.label}</span>: {money(step.input)} × {step.factor.n.toString()}/{step.factor.d.toString()}
      {' = '}{money(step.raw)} → <strong>{money(step.amount)}</strong>
      <span className="ml-1 text-slate-500">(10원 미만 버림)</span>
    </div>) : <span>{money(amount)} · 배분·일부 부담 적용 없음</span>}
    {(exactAmount.n * amount.d !== amount.n * exactAmount.d) && <details className="text-slate-500">
      <summary className="cursor-pointer">절사 전 정밀 검산값</summary>
      <p>중간 절사 없이 전체 산식을 계산한 값: {money(exactAmount)}. 합계에는 단계별 절사액을 사용합니다.</p>
    </details>}
  </div>;
}

export function CostReview({ parties, stages, reviews, applicationCosts, applicationPolicy, label }: Props) {
  const { lines, errors, ownerTotals } = reviewCosts(stages, parties);
  const application = reviewApplicationCosts(applicationCosts, parties, stages, applicationPolicy);
  const applicationTotal = (owner: string, debtor: string) => application.lines
    .filter(l => l.owner === owner && l.debtor === debtor).reduce((sum, l) => add(sum, l.amount), nothing);
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
    const applicationAmount = applicationTotal(a.id, b.id);
    return { a, b, r, forward, reverse, only, missing, negative, net, applicationAmount, combinedAmount: add(net, applicationAmount) };
  });
  const allReviewed = settlements.length > 0 && settlements.every((row) => !row.missing && !row.negative);
  const combined = settlements.reduce((sum, row) => add(sum, row.net), nothing);

  const applicationSum = application.lines.reduce((sum, l) => add(sum, l.amount), nothing);

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
            본소·반소 배분 → 공동비용 귀속 → 상대방별 배분 → 부담률 적용 순서로 계산합니다. 각 배분·부담률 적용 단계에서 10원 미만을 버리고 다음 계산에 사용합니다.
          </p>
        </div>
      </div>

      {!lines.length && !errors.length && !application.lines.length && (
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
      {!!application.errors.length && <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <h3 className={heading}>신청비용 입력 확인</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">{application.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
      </div>}
      {(!!lines.length || !!application.lines.length) && (
        <>
          {!!lines.length && <div>
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
                      <td className="p-2.5 font-mono text-xs text-slate-600"><CalculationDetails steps={l.steps} exactAmount={l.exactAmount} amount={l.amount} /></td>
                      <td className="p-2.5 font-semibold tabular-nums text-slate-900">
                        {money(l.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}
          <div>
            <h3 className={heading}>이번 신청의 상환 관계</h3>
            <div className="space-y-2.5">
              {settlements.map(({ a, b, r, forward, reverse, only, missing, negative, net, applicationAmount, combinedAmount }) => {
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
                    </p>
                    <p className="tabular-nums text-slate-700">
                      {name(a.id)} → {name(b.id)}　
                      {ownerTotals.has(b.id) || r?.zeroConfirmed ? money(reverse) : '귀속 비용 미확인'}
                      {only && ' (상계 제외)'}
                    </p>
                    {!!applicationCosts.length && <p className="tabular-nums text-slate-700">신청비용 부담액　{application.errors.length ? '입력 확인 필요' : money(applicationAmount)}</p>}
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
                        {negative && ' (역방향 차액 · 절차 검토)'}
                      </p>
                    )}
                    {!missing && !negative && !errors.length && !application.errors.length && !!applicationCosts.length && <p className="font-bold text-blue-950">본안 차액 + 신청비용　{money(combinedAmount)} <span className="text-xs font-normal">(단계별 절사 반영)</span></p>}
                  </div>
                );
              })}
            </div>
            {allReviewed && !errors.length && (
              <div className="mt-4 space-y-2 rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <p className="font-bold tabular-nums text-slate-900">
                  표시된 본안 상환액 합계　{money(combined)}
                </p>
                {!errors.length && !application.errors.length && !!applicationCosts.length && <p className="font-bold tabular-nums text-slate-900">본안 차액 + 신청비용 부담액 합계　{money(add(combined, applicationSum))}<span className="ml-2 text-xs font-normal">단계별 절사 반영 · 신청비용 {money(applicationSum)}</span></p>}
              </div>
            )}
          </div>
        </>
      )}
      {!!applicationCosts.length && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <h3 className={heading}>소송비용액확정신청 · 배분 내역</h3>
          {!!application.lines.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
            <thead><tr>{['비목', '귀속 신청인', '부담자', '산식', '부담액'].map(t => <th className="p-2" key={t}>{t}</th>)}</tr></thead>
            <tbody>{application.lines.map((l, i) => <tr key={i}><td className="p-2">{l.kind}<small className="block text-xs text-slate-500">{l.basis}</small></td><td className="p-2">{name(l.owner)}</td><td className="p-2">{name(l.debtor)}</td><td className="p-2"><CalculationDetails steps={l.steps} exactAmount={l.exactAmount} amount={l.amount} /></td><td className="p-2">{money(l.amount)}</td></tr>)}</tbody>
          </table></div>}
          <p className="mt-2 text-xs text-slate-500">신청비용도 각 배분·부담률 적용 단계에서 10원 미만을 버린 뒤 합산합니다. 배분이나 일부 부담이 없는 원래 비용은 그대로 반영합니다.</p>
        </div>
      )}
    </section>
  );
}
