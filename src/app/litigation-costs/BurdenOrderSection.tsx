'use client';

import { useRef, useState } from 'react';
import { isApplicantSideParty, type Party, type Rule, type Stage, stageLevel } from './caseInput';
import { canSelectOrderParty, conflictingOrderPairs, orderDescription, orderIssues, patchOrder, suggestedOrder, summarizeOrders } from './burdenOrders';

type Props = {
  stages: Stage[];
  parties: Party[];
  label: (p: Party) => string;
  onUpdateStageRules: (stageId: string, rules: Rule[]) => void;
};

const modes = [
  ['2측 전부 부담', '상대방 전부 부담 (100%)'],
  ['1측 전부 부담', '신청인 전부 부담 (100%)'],
  ['비율로 분담', '비율로 분담'],
  ['각자 부담', '각자 부담'],
] as const;
const button = 'rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50';
const input = 'h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900';

function OrderEditor({ stage, index, rule, parties, label, change }: {
  stage: Stage; index: number; rule: Rule; parties: Party[];
  label: Props['label']; change: (patch: Partial<Rule>) => void;
}) {
  // Keep the stored fraction exact; switching the display never changes the order.
  const [format, setFormat] = useState<'percent' | 'fraction'>(rule.d === '100' ? 'percent' : 'fraction');
  const level = stageLevel(stage, index);
  const issues = orderIssues(stage, rule, parties);
  const selectedIds = [...rule.left, ...rule.right];
  const unused = parties.filter(p => stage.members[p.id] && !selectedIds.includes(p.id));
  const suggested = suggestedOrder(stage, parties, index, rule.id);
  const fullSelectionConflicts = conflictingOrderPairs(stage, { ...rule, left: suggested.left, right: suggested.right }).length > 0;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {(['left', 'right'] as const).map(side => (
          <fieldset key={side} className="rounded-lg border border-slate-200 bg-white p-3">
            <legend className="px-1 text-xs font-semibold text-slate-800">
              주문 적용 대상 · {side === 'left' ? '신청인 측' : '상대방 측'}
            </legend>
            <div className="flex flex-wrap gap-2">
              {parties.filter(p => (side === 'left' ? isApplicantSideParty(p) : !isApplicantSideParty(p)) &&
                (stage.members[p.id] || rule[side].includes(p.id))).map(p => {
                const blocked = !canSelectOrderParty(stage, rule, side, p.id);
                return <label key={p.id} title={blocked ? '다른 주문에 이미 지정된 신청인–상대방 관계입니다.' : undefined}
                  className={`inline-flex items-center gap-1.5 rounded border border-slate-200 px-2 py-1.5 text-sm ${blocked ? 'cursor-not-allowed bg-slate-100 text-slate-400' : ''}`}>
                  <input type="checkbox" checked={rule[side].includes(p.id)}
                    disabled={blocked}
                    onChange={e => {
                      if (e.target.checked && !canSelectOrderParty(stage, rule, side, p.id)) return;
                      change({ [side]: e.target.checked ? [...rule[side], p.id] : rule[side].filter(id => id !== p.id) });
                    }} />
                  {label(p)}{!stage.members[p.id] && <span className="text-red-700">(비참여자)</span>}
                </label>;
              })}
              {!parties.some(p => stage.members[p.id] && (side === 'left' ? isApplicantSideParty(p) : !isApplicantSideParty(p))) &&
                <p className="text-xs text-slate-500">위 심급 정보에서 참여 당사자를 먼저 선택하세요.</p>}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="text-xs text-slate-500">다른 주문에 지정된 동일한 신청인–상대방 관계는 선택할 수 없습니다. 회색으로 표시된 당사자는 반대쪽 선택을 바꾸면 다시 선택할 수 있습니다.</p>
      <button type="button" disabled={fullSelectionConflicts}
        title={fullSelectionConflicts ? '전체를 선택하면 다른 주문의 적용 대상과 중복됩니다.' : undefined}
        className={`${button} disabled:cursor-not-allowed disabled:opacity-40`}
        onClick={() => { if (!fullSelectionConflicts) change({ left: suggested.left, right: suggested.right }); }}>
        해당 심급 참여자 전체 선택
      </button>
      {unused.length > 0 && <p className="text-xs text-slate-600">이 주문에 포함되지 않은 참여자: {unused.map(label).join(', ')}. 다른 주문 또는 최종 적용 관계를 확인하세요.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>주문이 정한 비용 범위</span>
          <select className={input} value={rule.scope} onChange={e => change({ scope: e.target.value })}>
            <option value={level + ' 비용'}>{level} 비용만 적용</option>
            {level !== '1심' && <option value="소송총비용">소송총비용 (종전 심급 비용 포함)</option>}
          </select>
        </label>
        {stage.counter && <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>적용 청구</span>
          <select className={input} value={rule.claim} onChange={e => change({ claim: e.target.value })}>
            <option value="">청구 선택</option>
            {['본소와 반소', '본소', '반소'].map(value => <option key={value}
              disabled={conflictingOrderPairs(stage, { ...rule, claim: value }).length > 0}>{value}</option>)}
          </select>
        </label>}
      </div>
      {rule.scope === '소송총비용' && <p className="rounded bg-blue-50 p-2 text-xs text-blue-900">
        선택한 당사자 관계에 대해서만 종전 심급 비용의 부담 주문도 변경합니다. 나머지 관계에는 종전 주문을 유지합니다.
      </p>}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map(([value, title]) => <button key={value} type="button" aria-pressed={rule.mode === value}
          onClick={() => change({ mode: value })}
          className={`rounded-lg border p-3 text-left text-sm ${rule.mode === value ? 'border-blue-600 bg-blue-50 font-bold text-blue-950 ring-1 ring-blue-600' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
          {title}
        </button>)}
      </div>
      {rule.mode === '비율로 분담' && <div className="space-y-3 rounded-lg border border-blue-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800">신청인 측 부담 비율</span>
          <div className="flex gap-2">
            {(['percent', 'fraction'] as const).map(value => <button key={value} type="button" className={button}
              aria-pressed={format === value} onClick={() => setFormat(value)}>{value === 'percent' ? '% (백분율)' : '분수'}</button>)}
          </div>
        </div>
        {format === 'percent' ? <label className="block space-y-1 text-xs text-slate-700">
          <span>신청인 측 부담 (%)</span>
          <input className={input} type="number" min="0" max="100" step="1"
            value={rule.d && Number(rule.d) > 0 ? Number(rule.n) / Number(rule.d) * 100 : ''}
            onChange={e => change({ n: e.target.value === '' ? '' : String(Math.min(100, Math.max(0, Math.round(Number(e.target.value))))), d: '100' })} />
        </label> : <div className="grid grid-cols-2 gap-3">
          {(['n', 'd'] as const).map(key => <label key={key} className="space-y-1 text-xs text-slate-700">
            <span>{key === 'n' ? '신청인 측 부담 분자' : '전체 부담 분모'}</span>
            <input className={input} type="text" inputMode="numeric" value={rule[key]}
              onChange={e => change({ [key]: e.target.value.replace(/\D/g, '') })} />
          </label>)}
        </div>}
        {!issues.length && <p className="text-xs text-blue-900">{orderDescription(rule)}</p>}
      </div>}
      {issues.map(issue => <p key={issue} role="alert" className="text-xs text-red-700">{issue}</p>)}
    </div>
  );
}

export function BurdenOrderSection({ stages, parties, label, onUpdateStageRules }: Props) {
  const omittedOrders = useRef<Record<string, Rule[]>>({});
  const summary = summarizeOrders(stages, parties);
  const partyName = (id: string) => {
    const party = parties.find(p => p.id === id);
    return party ? label(party) : '삭제된 당사자';
  };
  return (
    <section id="cost-burden-orders" className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm" aria-label="판결의 소송비용부담 주문">
      <div className="space-y-1 border-b border-slate-200 pb-3">
        <h2 className="text-lg font-bold text-slate-900">판결의 소송비용부담 주문</h2>
        <p className="text-xs text-slate-600">각 심급 판결문에 기재된 주문의 적용 당사자와 비용 범위를 설정하세요. 심급별 참여자는 위에서 별도로 관리합니다.</p>
        <p className="text-xs text-slate-600">상급심 소송총비용 주문이 종전 심급의 비용 전체를 정하면 종전 주문 입력을 생략할 수 있습니다. 일부 당사자에게만 적용되는 경우에는 나머지 관계에 필요한 종전 주문을 입력하세요.</p>
      </div>
      {stages.length > 1 && <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">입력한 모든 주문의 부담 방식 한 번에 변경</summary>
        <p className="my-2 text-xs text-slate-600">입력한 주문의 적용 당사자·비용 범위·분담 비율은 유지하고 부담 방식만 변경합니다. 입력을 생략한 주문은 추가하지 않습니다.</p>
        <div className="flex flex-wrap gap-2">{modes.map(([mode, title]) => <button key={mode} type="button" className={button} onClick={() => {
          stages.filter(s => s.rules.length).forEach(s => onUpdateStageRules(s.id,
            s.rules.map(r => ({ ...r, mode }))));
        }}>{title}</button>)}</div>
      </details>}
      {stages.map((stage, index) => {
        const level = stageLevel(stage, index);
        const canOmit = index < stages.length - 1;
        const omitted = canOmit && stage.rules.length === 0;
        const orders = stage.rules.length ? stage.rules : [suggestedOrder(stage, parties, index, stage.id + '-order')];
        return <div key={stage.id} className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
          <h3 className="text-sm font-bold text-slate-900">{level} 판결 주문 {stage.number && <span className="font-normal text-slate-500">({stage.number})</span>}</h3>
          {canOmit && <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={omitted} onChange={e => {
              if (e.target.checked) {
                omittedOrders.current[stage.id] = stage.rules;
                onUpdateStageRules(stage.id, []);
              } else {
                onUpdateStageRules(stage.id, omittedOrders.current[stage.id]?.length
                  ? omittedOrders.current[stage.id]
                  : [suggestedOrder(stage, parties, index, crypto.randomUUID())]);
              }
            }} />
            {level} 주문 입력 생략 (상급심 소송총비용 주문 적용)
          </label>}
          {omitted && <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
            {level} 참여자와 지출 비용은 그대로 사용합니다. 상급심 주문의 비용 범위를 ‘소송총비용’으로 지정하고, 이 심급 비용에 필요한 당사자 관계를 모두 포함하세요. 아래 최종 적용 주문에서 확인할 수 있습니다.
          </p>}
          {!omitted && orders.map((rule, orderIndex) => <div key={rule.id} className="space-y-3 border-t border-slate-200 pt-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-700">주문 {orderIndex + 1}</h4>
              {stage.rules.length > 0 && <button type="button" className={button}
                onClick={() => onUpdateStageRules(stage.id, stage.rules.filter(r => r.id !== rule.id))}>주문 {orderIndex + 1} 삭제</button>}
            </div>
            <OrderEditor stage={stage} index={index} rule={rule} parties={parties} label={label}
              change={patch => onUpdateStageRules(stage.id, patchOrder(stage, rule, patch))} />
            {!stage.rules.length && <button type="button" className={button}
              onClick={() => onUpdateStageRules(stage.id, [rule])}>이 주문 확인·반영</button>}
          </div>)}
          {stage.rules.length > 0 && <button type="button" className={button} onClick={() => {
            const next = suggestedOrder(stage, parties, index, crypto.randomUUID());
            onUpdateStageRules(stage.id, [...stage.rules, { ...next, left: [], right: [] }]);
          }}>+ 적용 대상이 다른 주문 추가</button>}
        </div>;
      })}
      <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/30 p-4">
        <h3 className="text-sm font-bold text-slate-900">당사자 관계별 최종 적용 주문</h3>
        <p className="text-xs text-slate-600">비용이 발생한 심급별로 적용할 주문입니다. 종전 비용의 배분 대상은 유지하고, 소송총비용 주문이 있는 관계만 상급심 주문으로 변경합니다.</p>
        {summary.issues.map(issue => <p key={issue} role="alert" className="text-xs text-red-700">{issue}</p>)}
        {summary.rows.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-xs">
          <thead><tr className="border-b border-slate-200 text-slate-600">
            {['비용 발생 심급', '당사자 관계', '최종 적용 주문', '부담 내용'].map(title => <th key={title} className="p-2">{title}</th>)}
          </tr></thead>
          <tbody>{summary.rows.map((row, i) => <tr key={i} className="border-b border-slate-100">
            <td className="p-2">{stageLevel(stages[row.stage], row.stage)}{row.claim && ` · ${row.claim}`}</td>
            <td className="p-2">{partyName(row.owner)} ↔ {partyName(row.opponent)}</td>
            <td className="p-2">{stageLevel(stages[row.source], row.source)} · {row.rule.scope}</td>
            <td className="p-2">{orderDescription(row.rule)}</td>
          </tr>)}</tbody>
        </table></div>}
      </div>
    </section>
  );
}
