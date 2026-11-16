'use client';

import { useId, useMemo, useState } from 'react';
import { amount, isReferenced, type LitigationDraft } from '@/lib/litigation-costs-draft';
import { calculateAllocation, formatExact } from '@/lib/litigation-costs-calculator';
import { emptyPair, type AllocationNode, type AllocationPlan, type CalculationInput } from '@/lib/litigation-costs-calculation-types';
import { Empty, Field, Multi, Panel, Select, inputClass, primary, secondary } from './form-controls';

type Props = { draft: LitigationDraft; onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void; section: 'values' | 'groups' | 'plans' | 'results' };
type Option = { id: string; name: string };
const newId = () => crypto.randomUUID();
const won = (v: string) => `${BigInt(v).toLocaleString('ko-KR')}원`;

function Choice({ label, value, items, onChange, empty = '선택하세요' }: { label: string; value: string; items: Option[]; onChange: (v: string) => void; empty?: string }) {
  const id = useId();
  return <div className="min-w-0 text-sm font-medium text-slate-700"><label htmlFor={id} className="mb-2 block">{label}</label>
    <select id={id} className={inputClass} value={value} onChange={e => onChange(e.target.value)}><option value="">{empty}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
  </div>;
}

function NodeEditor({ node, draft, onChange, depth = 0 }: { node: AllocationNode; draft: LitigationDraft; onChange: (n: AllocationNode) => void; depth?: number }) {
  const [open, setOpen] = useState(depth === 0);
  const partyItems = draft.parties.map(p => ({ id: p.id, name: p.name || '이름 미입력' }));
  const rulingItems = draft.rulings.map((r, i) => ({ id: r.id, name: `관계 ${i + 1}: ${r.payerIds.map(id => draft.parties.find(p => p.id === id)?.name || '?').join('·')} → ${r.receiverIds.map(id => draft.parties.find(p => p.id === id)?.name || '?').join('·')} (${r.numerator}/${r.denominator})` }));
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
    <summary className="cursor-pointer text-sm font-semibold">{node.type === 'split' ? node.label || '배분 단계' : '상환 관계'} <span className="font-normal text-slate-500">· {depth + 1}단계</span></summary>
    <div className="mt-4 space-y-4">
      <Select label="단계 유형" value={node.type === 'split' ? '비용을 나누는 단계' : '당사자 관계에 귀속'} options={['비용을 나누는 단계', '당사자 관계에 귀속']} onChange={v => onChange(v === '당사자 관계에 귀속' ? emptyPair(node.id) : { id: node.id, type: 'split', label: '배분', method: 'equal', branches: [] })} />
      {node.type === 'pair' ? <div className="grid gap-4 sm:grid-cols-2">
        <Choice label="비용 귀속자" value={node.ownerId} items={partyItems} onChange={ownerId => onChange({ ...node, ownerId })} />
        <Choice label="비용을 부담할 상대방" value={node.otherId} items={partyItems} onChange={otherId => onChange({ ...node, otherId })} />
        <Choice label="귀속 청구" value={node.claimId} items={draft.claims.map(c => ({ id: c.id, name: `${c.kind} · ${c.title}` }))} empty="청구 없음 (확정신청 비용 등)" onChange={claimId => onChange({ ...node, claimId })} />
        <Choice label="적용 부담 관계" value={node.rulingId} items={rulingItems} onChange={rulingId => onChange({ ...node, rulingId })} />
      </div> : <>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="배분 단계명" value={node.label} onChange={label => onChange({ ...node, label })} /><Select label="분기 배분 방식" value={node.method === 'equal' ? '동일 비율' : '입력 가중치 비례'} options={['동일 비율', '입력 가중치 비례']} onChange={v => onChange({ ...node, method: v === '동일 비율' ? 'equal' : 'weighted' })} /></div>
        <p className="text-xs leading-relaxed text-slate-500">가중치 비례는 각 가중치 ÷ 이 단계의 가중치 합계로 나눕니다. 중간 금액을 절사하지 않습니다.</p>
        {node.branches.map((branch, i) => <div key={branch.id} className="min-w-0 space-y-3 border-l-2 border-blue-200 pl-3">
          <div className="flex flex-wrap items-end gap-3"><div className="min-w-0 flex-1"><Field label={`분기 ${i + 1} 명칭`} value={branch.label} onChange={label => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, label } : b) })} /></div><button className="px-2 py-3 text-sm text-red-700" onClick={() => onChange({ ...node, branches: node.branches.filter(b => b.id !== branch.id) })}>분기 삭제</button></div>
          {node.method === 'weighted' && <div className="grid gap-3 sm:grid-cols-2">
            <Select label="가중치 근거" value={{ value: '가액 항목', group: '산정 그룹', fraction: '직접 분수' }[branch.weight.kind]} options={['가액 항목', '산정 그룹', '직접 분수']} onChange={v => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, weight: { ...b.weight, kind: v === '가액 항목' ? 'value' : v === '산정 그룹' ? 'group' : 'fraction', refId: '' } } : b) })} />
            {branch.weight.kind === 'fraction' ? <div className="grid grid-cols-2 gap-3"><Field label="가중치 분자" type="money" value={branch.weight.numerator} onChange={numerator => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, weight: { ...b.weight, numerator } } : b) })} /><Field label="가중치 분모" type="money" value={branch.weight.denominator} onChange={denominator => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, weight: { ...b.weight, denominator } } : b) })} /></div>
              : <Choice label="참조 가액·그룹" value={branch.weight.refId} items={(branch.weight.kind === 'value' ? draft.calculation.values : draft.calculation.groups).map(v => ({ id: v.id, name: `${draft.stages.find(s => s.id === v.stageId)?.type || '?'} · ${v.label}` }))} onChange={refId => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, weight: { ...b.weight, refId } } : b) })} />}
          </div>}
          <NodeEditor node={branch.node} draft={draft} depth={depth + 1} onChange={next => onChange({ ...node, branches: node.branches.map(b => b.id === branch.id ? { ...b, node: next } : b) })} />
        </div>)}
        <button className={`${secondary} disabled:opacity-40`} disabled={depth >= 7 || node.branches.length >= 50} onClick={() => onChange({ ...node, branches: [...node.branches, { id: newId(), label: `분기 ${node.branches.length + 1}`, weight: { kind: 'fraction', refId: '', numerator: '1', denominator: '1' }, node: emptyPair(newId()) }] })}>+ 분기 추가</button>
      </>}
    </div>
  </details>;
}

function Results({ draft }: { draft: LitigationDraft }) {
  const result = useMemo(() => calculateAllocation(draft), [draft]);
  const name = (id: string) => draft.parties.find(p => p.id === id)?.name || id;
  return <Panel title="배분 가계산 결과" description="직원 인정액과 입력한 배분·부담 관계를 사용한 현재 입력의 계산 결과입니다. 최종 결정액이 아닙니다.">
    {result.status === 'blocked' ? <div role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">계산 보류</p>{result.errors.map(e => <p key={e} className="mt-2 leading-relaxed">{e}</p>)}<p className="mt-2">미완성·미지원 설정을 0원으로 취급하지 않습니다. 이전 결과도 표시하지 않습니다.</p></div>
      : <>
        <div className="mb-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-950"><p className="font-semibold">가계산 · {draft.calculation.rounding.timing === 'direction' ? '방향별 절사 후 상계' : '상계 후 차액 절사'} · {draft.calculation.rounding.unit}원 미만 버림</p><p className="mt-2">{draft.calculation.setoff === 'applicantOnly' ? '신청인 비용만 반영합니다. 피신청인 귀속 비용은 경로에 보존하되 상환액에서 제외합니다.' : '양측 비용의 상환의무를 대등액에서 상계합니다.'}</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm" data-testid="calculated-results"><caption className="sr-only">현재 입력의 당사자별 가계산 결과</caption><thead className="bg-slate-50"><tr><th className="p-3">관계</th><th className="p-3">신청인 비용 중 상대방 부담</th><th className="p-3">피신청인 비용 중 신청인 부담</th><th className="p-3">상계 후 상환액</th></tr></thead><tbody>{result.rows.map(row => {
          const n = BigInt(row.net), backwards = n < BigInt(0);
          return <tr className="border-b border-slate-100" key={`${row.applicantId}-${row.respondentId}`}><td className="p-3">{name(row.respondentId)} ↔ {name(row.applicantId)}</td><td className="p-3 tabular-nums">{row.forwardRounded === null ? formatExact(row.forward) : won(row.forwardRounded)}</td><td className="p-3 tabular-nums">{row.reverseRounded === null ? formatExact(row.reverse) : won(row.reverseRounded)}</td><td className="p-3 font-semibold tabular-nums">{n === BigInt(0) ? '상환 차액 없음' : `${name(backwards ? row.applicantId : row.respondentId)} → ${name(backwards ? row.respondentId : row.applicantId)} ${won(String(backwards ? -n : n))}`}</td></tr>;
        })}</tbody></table></div>
        <ul className="my-5 space-y-2 rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">{result.warnings.map(w => <li key={w}>{w}</li>)}</ul>
        <details className="mb-5 rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">배분 전후 비용 보존 확인 · {result.budgets.length}건</summary><ul className="mt-3 space-y-2 text-sm">{result.budgets.map(b => <li key={b.costId}>{draft.costs.find(c => c.id === b.costId)?.title}: 입력 {won(b.recognized)} = 배분 {formatExact(b.allocated)}</li>)}</ul></details>
        <h3 className="mb-3 font-semibold">관계별 계산 근거</h3>
        <div className="space-y-3">{result.rows.map(row => <details key={`${row.applicantId}-${row.respondentId}`} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{name(row.respondentId)} ↔ {name(row.applicantId)} 원비용·배분·부담 비율 보기</summary><p className="my-3 text-xs leading-relaxed text-slate-500">절사 전 합계: 정방향 {formatExact(row.forward)}, 역방향 {formatExact(row.reverse)}. 아래 중간값의 소수 표시는 참고용이며 내부 계산은 정확한 분수를 사용합니다.</p><div className="space-y-3">{result.traces.filter(t => [t.ownerId, t.otherId].includes(row.applicantId) && [t.ownerId, t.otherId].includes(row.respondentId)).map((t, i) => <div key={i} className="rounded bg-slate-50 p-3 text-sm leading-relaxed"><p className="font-semibold">{t.costTitle} · {name(t.ownerId)} 비용 → {name(t.otherId)} 부담 {t.included ? '' : '(선택한 예외에 따라 미반영)'}</p><p>원 인정액 {won(t.recognized)}{t.basisValue && ` · 보수 산정 기초 ${won(t.basisValue)}`}</p><ol className="my-2 list-inside list-decimal text-xs text-slate-600">{t.path.map((path, j) => <li key={j} className="break-words">{path}</li>)}</ol><p>귀속 배분액 {formatExact(t.allocated)} × 부담 {t.burden.numerator}/{t.burden.denominator} = 상환의무 {formatExact(t.reimbursable)}</p><details className="mt-2 text-xs text-slate-500"><summary className="cursor-pointer">정확한 분수 값</summary><p className="mt-1 break-all">귀속: {t.allocated.numerator}/{t.allocated.denominator}원<br />상환: {t.reimbursable.numerator}/{t.reimbursable.denominator}원</p></details></div>)}</div></details>)}</div>
      </>}
  </Panel>;
}

export function CalculationWorkspace({ draft, onChange, section }: Props) {
  const calc = draft.calculation;
  const update = (fn: (old: CalculationInput) => CalculationInput) => onChange(old => ({ ...old, calculation: fn(old.calculation) }));
  const partyItems = draft.parties.map(p => ({ id: p.id, name: p.name || '이름 미입력' }));
  const claimItems = draft.claims.map(c => ({ id: c.id, name: `${c.kind} · ${c.title}` }));
  const stageItems = draft.stages.map(s => ({ id: s.id, name: `${s.type} · ${s.number}` }));
  const removeButton = (id: string, fn: () => void) => <button className="rounded px-3 py-2 text-sm text-red-700 disabled:text-slate-400" disabled={isReferenced(draft, id)} title={isReferenced(draft, id) ? '그룹·배분 계획의 연결을 먼저 해제하세요.' : undefined} onClick={fn}>삭제</button>;
  if (section === 'results') return <Results draft={draft} />;
  if (section === 'values') return <Panel title="계산용 가액·불복 범위" description="소가·배분 가중치·항소와 부대항소 금액을 별도 항목으로 입력합니다. 중복·흡수 여부는 산정 그룹에서 명시적으로 정합니다." action={<button className={secondary} disabled={calc.values.length >= 500} onClick={() => update(c => ({ ...c, values: [...c.values, { id: newId(), label: '', stageId: '', claimId: '', partyId: '', opponentId: '', purpose: '배분 가중치', kind: '청구', amount: '' }] }))}>+ 가액 추가</button>}>
    {!calc.values.length ? <Empty>계산에 사용할 가액을 등록하세요. 기존 청구·절차 메모는 자동 변환하지 않습니다.</Empty> : <div className="space-y-3">{calc.values.map((v, i) => {
      const edit = (patch: Partial<typeof v>) => update(c => ({ ...c, values: c.values.map(x => x.id === v.id ? { ...x, ...patch } : x) }));
      return <details key={v.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{draft.stages.find(s => s.id === v.stageId)?.type || '절차 미선택'} · {v.label || `가액 ${i + 1}`} <span className="font-normal text-slate-500">{amount(v.amount) === null ? '금액 미입력' : won(v.amount)}</span></summary><div className="mt-4 space-y-4"><div className="flex justify-end">{removeButton(v.id, () => update(c => ({ ...c, values: c.values.filter(x => x.id !== v.id) })))}</div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="가액 항목명" value={v.label} onChange={label => edit({ label })} /><Choice label="가액 적용 절차" value={v.stageId} items={stageItems} onChange={stageId => edit({ stageId })} /><Choice label="가액 관련 청구" value={v.claimId} items={claimItems} onChange={claimId => edit({ claimId })} /><Choice label="가액 당사자" value={v.partyId} items={partyItems} empty="전체·공통" onChange={partyId => edit({ partyId })} /><Choice label="가액 상대방" value={v.opponentId} items={partyItems} empty="전체·공통" onChange={opponentId => edit({ opponentId })} /><Select label="가액 용도" value={v.purpose} options={['배분 가중치', '보수 소가', '인지 불복액']} onChange={purpose => edit({ purpose: purpose as typeof v.purpose })} /><Select label="청구·불복 구분" value={v.kind} options={['청구', '항소', '부대항소']} onChange={kind => edit({ kind: kind as typeof v.kind })} /><Field label="가액 (원)" type="money" value={v.amount} onChange={value => edit({ amount: value })} /></div></div></details>;
    })}</div>}
  </Panel>;
  if (section === 'groups') return <Panel title="소가·공동대리 산정 그룹" description="같은 절차의 검토한 가액을 합산하거나 최다액으로 묶습니다. 보수 그룹은 대리 관계에 연결하되, 직원 인정액의 한도를 자동 계산하지 않습니다." action={<button className={secondary} disabled={calc.groups.length >= 500} onClick={() => update(c => ({ ...c, groups: [...c.groups, { id: newId(), label: '', stageId: '', mandateId: '', claimIds: [], valueIds: [], method: '합산', note: '' }] }))}>+ 산정 그룹 추가</button>}>
    {!calc.groups.length ? <Empty>계산용 가액을 입력한 뒤 산정 그룹을 만드세요.</Empty> : <div className="space-y-3">{calc.groups.map((g, i) => {
      const edit = (patch: Partial<typeof g>) => update(c => ({ ...c, groups: c.groups.map(x => x.id === g.id ? { ...x, ...patch } : x) }));
      const selected = g.valueIds.map(id => calc.values.find(v => v.id === id));
      const valid = selected.length && selected.every(v => v && amount(v.amount) !== null);
      const ns = valid ? selected.map(v => BigInt(v!.amount)) : [];
      const total = g.method === '합산' ? ns.reduce((a, b) => a + b, BigInt(0)) : ns.reduce((a, b) => a > b ? a : b, BigInt(0));
      return <details key={g.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{g.label || `산정 그룹 ${i + 1}`} <span className="font-normal text-slate-500">· {valid ? won(String(total)) : '가액 확인 필요'}</span></summary><div className="mt-4 space-y-4"><div className="flex justify-end">{removeButton(g.id, () => update(c => ({ ...c, groups: c.groups.filter(x => x.id !== g.id) })))}</div><div className="grid gap-4 sm:grid-cols-2"><Field label="산정 그룹명" value={g.label} onChange={label => edit({ label })} /><Choice label="그룹 적용 절차" value={g.stageId} items={stageItems} onChange={stageId => edit({ stageId })} /><Choice label="공동대리 관계" value={g.mandateId} items={draft.mandates.map(m => ({ id: m.id, name: m.name || '대리인 미입력' }))} empty="배분용 그룹 (대리 관계 없음)" onChange={mandateId => edit({ mandateId })} /><Select label="소가 결합 방식" value={g.method} options={['합산', '최다액']} onChange={method => edit({ method: method as typeof g.method })} /></div><Multi label="그룹 청구 범위" items={claimItems} selected={g.claimIds} onChange={claimIds => edit({ claimIds })} /><Multi label="그룹에 포함할 가액" items={calc.values.map(v => ({ id: v.id, name: `${draft.stages.find(s => s.id === v.stageId)?.type || '?'} · ${v.label}` }))} selected={g.valueIds} onChange={valueIds => edit({ valueIds })} /><Field label="중복·흡수·수임 범위 검토 근거" multiline value={g.note} onChange={note => edit({ note })} /></div></details>;
    })}</div>}
  </Panel>;
  function replacePlan(plan: AllocationPlan) { update(c => ({ ...c, plans: [...c.plans.filter(p => p.costId !== plan.costId), plan] })); }
  return <Panel title="계산할 배분 단계와 절사 설정" description="기존 배분 메모와 별개로 실행할 단계를 지정합니다. 계획 누락·잘못된 연결·0인 가중치 합계는 계산을 보류합니다.">
    <div className="mb-5 grid gap-4 sm:grid-cols-3"><Choice label="절사 단위" value={calc.rounding.unit} items={[{ id: '1', name: '1원 미만 버림' }, { id: '10', name: '10원 미만 버림' }]} onChange={unit => update(c => ({ ...c, rounding: { ...c.rounding, unit: unit as typeof calc.rounding.unit } }))} /><Choice label="절사 적용 시점" value={calc.rounding.timing} items={[{ id: 'direction', name: '방향별 절사 후 상계' }, { id: 'net', name: '상계 후 차액 절사' }]} onChange={timing => update(c => ({ ...c, rounding: { ...c.rounding, timing: timing as typeof calc.rounding.timing } }))} /><Choice label="상계 계산 방식" value={calc.setoff} items={[{ id: 'unreviewed', name: '미선택' }, { id: 'mutual', name: '쌍방 비용 대등액 상계' }, { id: 'applicantOnly', name: '신청인 비용만 (제111조 제2항 검토)' }]} onChange={setoff => update(c => ({ ...c, setoff: (setoff || 'unreviewed') as typeof calc.setoff }))} /></div>
    <div className="space-y-3">{draft.costs.map(cost => {
      const plan = calc.plans.find(p => p.costId === cost.id);
      return <details key={cost.id} className="min-w-0 rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{cost.title || '비용명 미입력'} · {plan ? '계획 입력됨' : '계획 없음'}</summary><div className="mt-4 space-y-4"><p className="text-xs leading-relaxed text-slate-500">기존 검토 메모: {cost.reason || '없음'}</p>{plan ? <>
        <Choice label="보수 산정 기초 그룹" value={plan.basisGroupId} empty="연결 없음 (보수 외 비용)" items={calc.groups.filter(g => g.stageId === cost.stageId).map(g => ({ id: g.id, name: g.label }))} onChange={basisGroupId => replacePlan({ ...plan, basisGroupId })} />
        {draft.stages.find(s => s.id === cost.stageId)?.type === '확정신청' && <Field label="신청비용 부담 재판 준용 근거" multiline value={plan.applicationBasis} onChange={applicationBasis => replacePlan({ ...plan, applicationBasis })} />}
        <NodeEditor node={plan.root} draft={draft} onChange={root => replacePlan({ ...plan, root })} />
        <button className="rounded border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => update(c => ({ ...c, plans: c.plans.filter(p => p.costId !== cost.id) }))}>이 비용의 계산 계획 제거</button>
      </> : <button className={primary} onClick={() => replacePlan({ costId: cost.id, basisGroupId: '', applicationBasis: '', root: emptyPair(newId()) })}>배분 계획 만들기</button>}</div></details>;
    })}</div>
    {!draft.costs.length && <Empty>비용을 등록하면 비용마다 배분 계획을 입력할 수 있습니다.</Empty>}
  </Panel>;
}
