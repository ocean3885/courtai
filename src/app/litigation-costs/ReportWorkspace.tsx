'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { DocumentViewer } from '@/components/ui/DocumentViewer';
import { buildCostReport, renderCostReport } from '@/lib/litigation-costs-report';
import { matchesReportCase, reportValidationCases } from '@/lib/litigation-costs-report-cases';
import type { LitigationDraft } from '@/lib/litigation-costs-draft';
import { inputClass, Panel, primary, secondary } from './form-controls';

export function ReportWorkspace({ draft, onLoadCase, onChange }: {
  draft: LitigationDraft;
  onLoadCase: (id: string) => void;
  onChange?: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const current = useMemo(() => buildCostReport(draft), [draft]);
  const caseSelectId = useId();
  const [caseId, setCaseId] = useState('R01');
  const [snapshot, setSnapshot] = useState<{ basis: string; html: string } | null>(null);
  const [frameReady, setFrameReady] = useState(false);
  const [message, setMessage] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const serialized = JSON.stringify(draft);
  const stale = !!snapshot && snapshot.basis !== serialized;
  const active = reportValidationCases.find(c => c.id === draft.referenceCaseId);
  const unchanged = !!active && matchesReportCase(draft);
  const expectedMatches = unchanged && current.status === 'preview' && current.report.result.net === active.expected.net;
  function generate() {
    const built = buildCostReport(draft);
    if (built.status === 'blocked') return;
    setFrameReady(false); setMessage('');
    setSnapshot({ basis: serialized, html: renderCostReport(built.report) });
  }
  function print() {
    if (!frameReady || stale || current.status !== 'preview' || !frame.current?.contentWindow) return;
    try { frame.current.contentWindow.focus(); frame.current.contentWindow.print(); }
    catch { setMessage('인쇄 창을 열지 못했습니다. 브라우저의 인쇄 허용 설정을 확인하세요.'); }
  }
  return <Panel title="계산서 출력 · 1차 검증" description="단수 처리(절삭) 기준을 확인하고 원고 1명·피고 1명의 본소부터 검토용 계산서를 생성합니다. 사례의 기대 금액과 계산 결과를 비교한 뒤 인쇄 또는 PDF로 저장하세요.">
    {onChange && (
      <fieldset className="mb-5 rounded-lg border border-blue-200 bg-blue-50/40 p-4" data-testid="guided-step6-rounding">
        <legend className="px-1 text-xs font-bold text-blue-900">Step 6-1. 최종 상환액 절삭(단수 처리) 기준</legend>
        <div className="mt-1 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-800">
            <input
              type="radio"
              name="step6-rounding-unit"
              className="h-4 w-4 accent-blue-700"
              checked={draft.calculation.rounding.unit === '1'}
              onChange={() => onChange(old => ({ ...old, calculation: { ...old.calculation, rounding: { ...old.calculation.rounding, unit: '1' } } }))}
            />
            원 미만 버림 (1원 단위)
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-800">
            <input
              type="radio"
              name="step6-rounding-unit"
              className="h-4 w-4 accent-blue-700"
              checked={draft.calculation.rounding.unit === '10'}
              onChange={() => onChange(old => ({ ...old, calculation: { ...old.calculation, rounding: { ...old.calculation.rounding, unit: '10' } } }))}
            />
            10원 미만 버림 (10원 단위)
          </label>
        </div>
      </fieldset>
    )}
    <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-4">
      <div className="min-w-0 flex-1 text-sm font-medium text-slate-700"><label htmlFor={caseSelectId}>단순 출력 검증 사례</label><select id={caseSelectId} className={`${inputClass} mt-2`} value={caseId} onChange={e => setCaseId(e.target.value)}>{reportValidationCases.map(c => <option key={c.id} value={c.id}>{c.id} · {c.title}</option>)}</select></div>
      <button className={secondary} onClick={() => onLoadCase(caseId)}>출력 검증 사례 불러오기</button>
      <p className="w-full text-xs leading-relaxed text-slate-500">개발용 검증 사례 {reportValidationCases.length}개입니다. F01~F03은 입력 소가·실비의 자동 보수를 포함합니다. 보수 한도·법률상 적정성이 확인된 실제 사건으로 취급하지 않습니다.</p>
    </div>
    {active && <p role="status" className={`mb-4 rounded-lg p-3 text-sm leading-relaxed ${expectedMatches ? 'bg-blue-50 text-blue-950' : 'bg-amber-50 text-amber-950'}`}>{unchanged ? `${active.id} 기대 차액 ${BigInt(active.expected.net).toLocaleString('ko-KR')}원 · ${expectedMatches ? '현재 가계산과 일치' : '현재 계산과 불일치·계산 보류 확인 필요'}` : '검증 사례가 수정되었습니다. 고정 기대 금액과의 비교를 중단하고 현재 입력으로 출력합니다.'}</p>}
    {current.status === 'blocked' ? <div className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">계산서 생성 보류</p>{current.errors.map(e => <p className="mt-2 leading-relaxed" key={e}>{e}</p>)}</div> : <p className="mb-4 text-sm leading-relaxed text-slate-600">입력 비용·자동 보수 산입액과 현재 배분 계획으로 작성하는 검토용 초안입니다. 생성본은 이 화면에만 유지되며 사건별 서버 저장·검토완료 확정은 아직 제공하지 않습니다.</p>}
    <div className="mb-4 flex flex-wrap gap-2"><button className={`${primary} disabled:opacity-40`} disabled={current.status !== 'preview'} onClick={generate}>{snapshot ? '현재 입력으로 계산서 다시 생성' : '계산서 미리보기'}</button><button className={`${secondary} disabled:opacity-40`} disabled={!snapshot || stale || !frameReady || current.status !== 'preview'} onClick={print}>인쇄 / PDF 저장</button>{snapshot && <button className={secondary} onClick={() => setSnapshot(null)}>미리보기 닫기</button>}</div>
    {message && <p role="alert" className="mb-4 text-sm text-amber-900">{message}</p>}
    {stale && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">입력이 변경되어 이전 계산서를 숨겼습니다. 현재 입력으로 다시 생성하세요.</p>}
    {snapshot && !stale && current.status === 'preview' && <>
      <p className="mb-3 text-xs leading-relaxed text-slate-500">A4 세로 서식입니다. 인쇄 창에서 ‘PDF로 저장’을 선택할 수 있습니다. 브라우저 기본 머리글·바닥글을 끄면 서식에 맞게 출력됩니다.</p>
      <DocumentViewer><iframe ref={frame} title="소송비용계산서 검토용 미리보기" className="block border-0 bg-white" style={{ width: 794, height: 1123 }} srcDoc={snapshot.html} sandbox="allow-same-origin allow-modals" onLoad={() => setFrameReady(true)} /></DocumentViewer>
    </>}
  </Panel>;
}
