import { type Cost, type Party, type Reviews, type Stage } from './caseInput';
import { add, expenseNet, money, nothing, reviewCosts, subtract } from './costReview';

type Props = {
  parties: Party[];
  stages: Stage[];
  reviews: Reviews;
  applicationCosts: Cost[];
  label: (p: Party) => string;
};
const heading = 'mb-2 font-semibold text-slate-900';
export function CostReview({ parties, stages, reviews, applicationCosts, label }: Props) {
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
  return (
    <section
      id="cost-review"
      className="scroll-mt-24 space-y-5 rounded-lg border border-slate-300 bg-white p-4"
      aria-label="비용 배분 검산"
    >
      <h2 className="text-lg font-semibold">비용 배분 검산</h2>
      {!lines.length && !errors.length && (
        <p className="text-sm text-slate-600">
          본안 지출 비용과 부담 관계를 입력하면 당사자별 부담액과 산식이 표시됩니다.
        </p>
      )}
      {!!errors.length && (
        <div className="rounded-md bg-amber-50 p-3">
          <h3 className={heading}>입력 확인</h3>
          <ul className="list-disc pl-5 text-sm">
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    {['심급·비목', '비용 귀속자', '부담자', '산식', '부담액'].map((t) => (
                      <th key={t} className="p-2">
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2">
                        {l.stage} · {l.kind}
                        <small className="block text-slate-600">{l.order} 적용</small>
                      </td>
                      <td className="p-2">{name(l.owner)}</td>
                      <td className="p-2">{name(l.debtor)}</td>
                      <td className="p-2">{l.formula}</td>
                      <td className="p-2">{money(l.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h3 className={heading}>이번 신청의 상환 관계</h3>
            {settlements.map(({ a, b, r, forward, reverse, only, missing, negative, net }) => {
              return (
                <div key={a.id + b.id} className="mb-2 space-y-1 rounded-md bg-slate-50 p-3 text-sm">
                  <strong>
                    {name(a.id)} · {name(b.id)}
                  </strong>
                  <p>
                    {name(b.id)} → {name(a.id)}　{money(forward)}
                  </p>
                  <p>
                    {name(a.id)} → {name(b.id)}　
                    {ownerTotals.has(b.id) || r?.zeroConfirmed ? money(reverse) : '귀속 비용 미확인'}
                    {only && ' (상계 제외)'}
                  </p>
                  {missing ? (
                    <p className="text-amber-900">{missing}</p>
                  ) : (
                    <p className="font-semibold text-blue-900">
                      {net.n === BigInt(0)
                        ? '본안 비용 차액 0원'
                        : (negative ? name(a.id) + ' → ' + name(b.id) : name(b.id) + ' → ' + name(a.id)) +
                          ' · 본안 비용 차액 ' +
                          money(negative ? subtract(nothing, net) : net)}
                      {negative && ' (역방향 차액 · 절차 검토)'}
                    </p>
                  )}
                </div>
              );
            })}
            {allReviewed && (
              <p className="mt-4 border-t pt-3 font-semibold">표시된 본안 상환액 합계　{money(combined)}</p>
            )}
          </div>
        </>
      )}
      {!!applicationCosts.length && (
        <div>
          <h3 className={heading}>확정신청 비용 · 실지출 소계</h3>
          {applicants.map((p) => {
            const costs = applicationCosts.filter((c) => c.payer === p.id);
            if (!costs.length) return null;
            let summary: string;
            try {
              summary = costs.reduce((a, c) => a + expenseNet(c), BigInt(0)).toLocaleString('ko-KR') + '원';
            } catch {
              summary = '납부액·환급액 확인';
            }
            return (
              <p key={p.id}>
                {label(p)}　{summary}
              </p>
            );
          })}
          <p className="text-xs text-slate-600">본안 비용 차액과 별도로 표시합니다.</p>
        </div>
      )}
    </section>
  );
}
