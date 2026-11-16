'use client';

import { useEffect, useRef, useState } from 'react';
import { compareReferenceAmounts, findReferenceCase, matchesReferenceCase, referenceCases } from '@/lib/litigation-costs-case-library';
import { calculateAllocation } from '@/lib/litigation-costs-calculator';
import type { LitigationDraft } from '@/lib/litigation-costs-draft';
import { Empty, Panel, primary, secondary } from './form-controls';

const won = (value: string) => BigInt(value).toLocaleString('ko-KR') + '원';
export function ReferenceCasePicker({ onClose, onSelect }: { onClose: () => void; onSelect: (id: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState('전체');
  useEffect(() => { dialog.current?.showModal(); }, []);
  const entries = referenceCases.filter(c => category === '전체' || c.category === category);
  return <dialog ref={dialog} aria-labelledby="case-picker-title" onCancel={onClose} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-xl bg-white p-5 text-slate-950 shadow-xl backdrop:bg-slate-950/50 sm:p-7">
    <div className="flex items-start justify-between gap-4"><div><h2 id="case-picker-title" className="text-xl font-bold">유형별 검증 사례</h2><p className="mt-2 text-sm leading-relaxed text-slate-600">기본 12개·특수 6개. 원문 인정액의 배분을 대조하고, 구조를 재구성한 사례는 따로 표시합니다.</p></div><button autoFocus className={`${secondary} shrink-0 whitespace-nowrap`} onClick={onClose}>닫기</button></div>
    <p className="my-4 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">구 요율의 인정액을 사용한 검증 자료입니다. 현행 보수 한도나 실제 사건의 확정액으로 사용하지 마세요. 원문 차이는 ‘배분·검토’ 단계에서 확인할 수 있습니다.</p>
    <div className="mb-4 flex gap-2" role="group" aria-label="사례 유형">{['전체', '기본', '특수'].map(c => <button key={c} aria-pressed={category === c} className={category === c ? primary : secondary} onClick={() => setCategory(c)}>{c}</button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2">{entries.map(entry => <article key={entry.id} className="flex flex-col rounded-lg border border-slate-200 p-4">
      <div className="mb-2 flex flex-wrap gap-2 text-xs"><span className="font-bold text-blue-700">{entry.id} · {entry.category}</span><span className="text-slate-500">{entry.provenance} · {entry.shape}</span>{entry.expectedStatus === 'blocked' && <span className="text-amber-800">계산 보류 검증</span>}</div>
      <h3 className="text-sm font-semibold leading-relaxed">{entry.title}</h3><p className="mt-2 text-xs leading-relaxed text-slate-500">{entry.provenance === '원문 사례' ? `실무서 ${entry.sourcePages}쪽` : entry.sourcePages}</p>
      {entry.note && <p className="mt-2 text-xs leading-relaxed text-amber-800">{entry.note}</p>}
      <button className={`${secondary} mt-4 self-start`} aria-label={`${entry.id} 사례 불러오기`} onClick={() => onSelect(entry.id)}>사례 불러오기 →</button>
    </article>)}</div>
  </dialog>;
}

export function ReferenceCaseComparison({ draft }: { draft: LitigationDraft }) {
  const entry = findReferenceCase(draft.referenceCaseId);
  if (!entry) return null;
  const unchanged = matchesReferenceCase(draft);
  const result = calculateAllocation(draft);
  const comparison = unchanged ? compareReferenceAmounts(entry, result) : [];
  const differences = comparison.filter(r => r.difference !== '0');
  const name = (id: string) => draft.parties.find(p => p.id === id)?.name || id;
  return <Panel title={`${entry.id} · 유형별 사례 대조`} description={`${entry.provenance} · ${entry.sourceDocument} · ${entry.sourcePages}${entry.provenance === '원문 사례' ? '쪽' : ''}`}>
    <p className="mb-3 text-sm leading-relaxed text-slate-600">주문 요약: {entry.order}</p>
    {entry.note && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm leading-relaxed text-amber-900">{entry.note}</p>}
    {!unchanged ? <Empty>입력이 수정되어 원문 대조를 중단했습니다. 위 가계산 결과는 현재 입력을 사용합니다. 원문과 비교하려면 해당 사례를 다시 불러오세요.</Empty>
      : result.status === 'blocked' ? <p className="rounded-lg bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">이 사례는 자동 분해가 미지원인 관계에서 계산을 보류하는지 확인하기 위한 사례입니다. 계산 결과를 확정하거나 누락된 당사자의 몫을 임의로 나누지 않습니다.</p>
      : entry.provenance === '구조 재구성' ? <p className="rounded-lg bg-blue-50 p-4 text-sm leading-relaxed text-blue-900">부담 구조 검증을 위해 금액을 임의로 구성한 사례입니다. 위 결과와 대응하는 실무서 원문 금액은 없습니다.</p>
      : <>
        <p role="status" className={`mb-4 rounded-lg p-3 text-sm leading-relaxed ${differences.length ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>{differences.length ? `원문 기재액과 ${differences.length}개 관계에서 차이가 있습니다. 선택한 중간 절사 없는 계산 경로의 차이이며, 원문의 오류나 법률상 정답으로 단정하지 않습니다.` : '이 사례의 원문 기재액과 가계산 결과가 일치합니다. 법률상 적정성 검토 완료를 의미하지 않습니다.'}</p>
        <div className="overflow-x-auto"><table data-testid="case-source-comparison" className="w-full min-w-[540px] text-left text-sm"><caption className="sr-only">원문 기재액과 현재 사례 계산 경로 비교</caption><thead className="bg-slate-50"><tr><th className="p-3">관계</th><th className="p-3 text-right">원문 기재액</th><th className="p-3 text-right">가계산</th><th className="p-3 text-right">차액 (계산 − 원문)</th></tr></thead><tbody>{comparison.map(row => <tr key={`${row.applicantId}-${row.respondentId}`} className="border-b border-slate-100"><td className="p-3">{name(row.respondentId)} → {name(row.applicantId)}</td><td className="p-3 text-right tabular-nums">{won(row.net)}</td><td className="p-3 text-right tabular-nums">{row.computed === null ? '관계 누락' : won(row.computed)}</td><td className={`p-3 text-right tabular-nums ${row.difference === '0' ? 'text-slate-500' : 'font-semibold text-amber-800'}`}>{row.difference === null ? '대조 불가' : won(row.difference)}</td></tr>)}</tbody></table></div>
      </>}
    <p className="mt-4 text-xs leading-relaxed text-slate-500">{entry.limitations}</p>
  </Panel>;
}
