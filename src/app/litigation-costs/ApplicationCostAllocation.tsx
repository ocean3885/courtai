import { type Cost, type Party } from './caseInput';
import { applicationOwners } from './applicationCosts';

const control = 'mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm';
type Props = { cost: Cost; parties: Party[]; label: (p: Party) => string; update: (patch: Partial<Cost>) => void; policyEditor?: boolean; showRates?: boolean };

export function ApplicationCostAllocation({ cost: c, parties, label, update, policyEditor = false, showRates = true }: Props) {
  const a = c.application || { opponentIds: [] };
  const owners = applicationOwners(c);
  const opponents = parties.filter(p => p.group === '피신청인');
  const individual = policyEditor || a.useCommon === false;
  const patch = (value: Partial<NonNullable<Cost['application']>>) => update({ application: { ...a, ...value } });
  const name = (id: string) => { const p = parties.find(p => p.id === id); return p ? label(p) : '당사자 확인'; };
  return <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-3">
    {!policyEditor && <><label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={a.useCommon !== false} onChange={e => patch({ useCommon: e.target.checked })} />신청비용 공통 부담기준 사용
    </label>
    {!individual && <p className="text-xs text-slate-600">위 공통 기준을 따릅니다. 부담비율 변경은 연결된 모든 비용에 바로 반영됩니다.</p>}
    <label className="block text-sm">검토 인정액 (원) · 미입력 시 납부액 − 환급액
      <input className={control} inputMode="numeric" value={c.recognized || ''} onChange={e => update({ recognized: e.target.value.replace(/[^0-9]/g, '') })} />
    </label></>}
    {!policyEditor && owners.length > 1 && <>
      <label className="block text-sm">신청인 사이 귀속 기준
        <select className={control} value={c.method || '균분'} onChange={e => update({ method: e.target.value })}>
          <option>균분</option><option>직접 비율</option>
        </select>
      </label>
      {c.method === '직접 비율' && owners.map(id => <label key={id} className="block text-sm">{name(id)} 귀속 비율값
        <input className={control} inputMode="numeric" value={a.ownerWeights?.[id] || ''} onChange={e => patch({ ownerWeights: { ...a.ownerWeights, [id]: e.target.value.replace(/[^0-9]/g, '') } })} />
      </label>)}
    </>}
    {individual && <><fieldset className="space-y-1"><legend className="text-sm font-medium">신청비용 배분 대상 피신청인</legend>
      {opponents.map(p => <label key={p.id} className="mr-3 inline-flex items-center gap-1 text-sm">
        <input type="checkbox" checked={a.opponentIds.includes(p.id)} onChange={e => patch({ opponentIds: e.target.checked ? [...a.opponentIds, p.id] : a.opponentIds.filter(id => id !== p.id) })} />{label(p)}
      </label>)}
    </fieldset>
    {a.opponentIds.length > 1 && <>
      <label className="block text-sm">피신청인 전체 배분 기준
        <select className={control} value={a.opponentMethod || '균분'} onChange={e => patch({ opponentMethod: e.target.value as '균분' | '직접 비율' })}>
          <option>균분</option><option>직접 비율</option>
        </select>
      </label>
      {a.opponentMethod === '직접 비율' && a.opponentIds.map(id => <label key={id} className="block text-sm">{name(id)} 배분 비율값
        <input className={control} inputMode="numeric" value={a.opponentWeights?.[id] || ''} onChange={e => patch({ opponentWeights: { ...a.opponentWeights, [id]: e.target.value.replace(/[^0-9]/g, '') } })} />
      </label>)}
    </>}
    {(c.method === '직접 비율' || a.opponentMethod === '직접 비율') && <p className="text-xs text-slate-600">비율값은 합계에 대한 비중입니다. 예: 2와 1을 입력하면 각각 2/3과 1/3로 배분합니다.</p>}
    {showRates && owners.length > 0 && a.opponentIds.length > 0 && <>
      {owners.flatMap(owner => a.opponentIds.map(debtor => {
        const rate = a.rates?.[owner]?.[debtor];
        const mode = !rate ? '' : rate.n === '0' && rate.d === '1' ? '없음' : rate.n === '1' && rate.d === '1' ? '전액' : '비율';
        const caption = (owners.length > 1 ? name(owner) + ' 귀속분 · ' : '') + name(debtor);
        const setRate = (value?: { n: string; d: string }) => {
          const next = { ...a.rates?.[owner] };
          if (value) next[debtor] = value; else delete next[debtor];
          patch({ rates: { ...a.rates, [owner]: next } });
        };
        return <div key={owner + ':' + debtor} className="space-y-2 rounded border border-slate-200 bg-white p-2">
          <label className="block text-sm">{caption} 신청비용 부담
            <select className={control} value={mode} onChange={e => setRate(e.target.value === '전액' ? { n: '1', d: '1' } : e.target.value === '없음' ? { n: '0', d: '1' } : e.target.value === '비율' ? { n: '', d: '' } : undefined)}>
              <option value="">선택</option><option value="전액">배분액 전액 부담</option><option value="비율">배분액 일부 비율 부담</option><option value="없음">부담 없음</option>
            </select>
          </label>
          {mode === '비율' && <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">{caption} 부담 분자<input className={control} inputMode="numeric" value={rate?.n || ''} onChange={e => setRate({ n: e.target.value.replace(/[^0-9]/g, ''), d: rate?.d || '' })} /></label>
            <label className="text-sm">{caption} 부담 분모<input className={control} inputMode="numeric" value={rate?.d || ''} onChange={e => setRate({ n: rate?.n || '', d: e.target.value.replace(/[^0-9]/g, '') })} /></label>
          </div>}
        </div>;
      }))}
    </>}
    <p className="text-xs text-slate-600">귀속 신청인과 피신청인 사이 배분을 먼저 계산한 뒤 각 부담률을 적용합니다.</p></>}
  </div>;
}
