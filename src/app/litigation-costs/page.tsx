'use client';

import { useEffect, useRef, useState } from 'react';
import { Field, Select, Choice, Multi, Panel, Empty, AdvancedFields, primary, secondary } from './form-controls';
import { CalculationWorkspace } from './CalculationWorkspace';
import { FormSection } from './FormSection';
import { AttorneyFeeEditor } from './AttorneyFeeEditor';
import { getCostRecognition } from '@/lib/litigation-costs-attorney-fee';
import { ReportWorkspace } from './ReportWorkspace';
import { reportCaseDraft } from '@/lib/litigation-costs-report-cases';
import { ReferenceCaseComparison, ReferenceCasePicker } from './ReferenceCases';
import { referenceCaseDraft } from '@/lib/litigation-costs-case-library';
import { MainLayout } from '@/components/layout';
import {
  allocationTypes, amount, blankDraft, isReferenced, matchesSample, money, parseDraft,
  reviewDraft, sampleDraft, sampleReference, stageTypes, STORAGE_KEY, LEGACY_STORAGE_KEY,
  type LitigationDraft,
} from '@/lib/litigation-costs-draft';

const sections = [
  { title: '사건·당사자', description: '신청 사건과 본소·반소의 당사자 관계를 입력합니다.' },
  { title: '심급·청구 변동', description: '심급별 참여 범위와 소가·불복 금액을 연결합니다.' },
  { title: '비용 부담 주문', description: '주문 원문과 적용할 당사자·청구·심급별 비율을 확인합니다.' },
  { title: '대리인·비용', description: '심급별 보수·비용·증빙을 먼저 입력하고 필요한 수임 범위를 확인합니다.' },
  { title: '배분·검토', description: '배분 계획, 상계·절사와 현재 계산 결과를 함께 검토합니다.' },
  { title: '계산서 출력', description: '검토용 계산서를 생성하고 인쇄 또는 PDF로 저장합니다.' },
];
type Replacement = 'sample' | 'case' | 'report' | 'new' | 'load';
type Collection = 'parties' | 'claims' | 'stages' | 'rulings' | 'mandates' | 'costs';
type Row<K extends Collection> = LitigationDraft[K][number];
const recognizedValue = (cost: LitigationDraft['costs'][number]) => { const r = getCostRecognition(cost); return r.status === 'ready' ? r.recognized : null; };

export default function LitigationCostsPage() {
  const [draft, setDraft] = useState<LitigationDraft>(blankDraft);
  const [planSession, setPlanSession] = useState(0);
  const [expanded, setExpanded] = useState(() => sections.map((_, index) => index === 0));
  const form = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState(() => JSON.stringify(blankDraft()));
  const [replace, setReplace] = useState<Replacement | null>(null);
  const [casePickerOpen, setCasePickerOpen] = useState(false);
  const selectedCaseId = useRef('');
  const replaceDialog = useRef<HTMLDialogElement>(null);
  const serialized = JSON.stringify(draft);
  const dirty = serialized !== saved;
  const issues = reviewDraft(draft);
  const referenceVisible = matchesSample(draft);
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  useEffect(() => { if (replace) replaceDialog.current?.showModal(); }, [replace]);
  function setSectionOpen(index: number, open: boolean) {
    setExpanded(old => old[index] === open ? old : old.map((value, i) => i === index ? open : value));
  }
  function revealSection(index: number, revealDetails = false) {
    const section = form.current?.querySelector<HTMLDetailsElement>(`[data-cost-section="${index}"]`);
    if (section) { section.open = true; if (revealDetails) section.querySelectorAll('details').forEach(detail => { detail.open = true; }); }
    setSectionOpen(index, true);
    requestAnimationFrame(() => {
      section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      section?.querySelector('summary')?.focus({ preventScroll: true });
    });
  }
  function setAllSections(open: boolean) {
    form.current?.querySelectorAll<HTMLDetailsElement>('details').forEach(detail => { detail.open = open; });
    setExpanded(sections.map(() => open));
  }
  function change(fn: (old: LitigationDraft) => LitigationDraft) { setDraft(fn); setMessage(''); }
  function edit<K extends Collection>(key: K, id: string, patch: Partial<Row<K>>) {
    change(old => ({ ...old, [key]: old[key].map(row => row.id === id ? { ...row, ...patch } : row) }));
  }
  function add<K extends Collection>(key: K, row: Omit<Row<K>, 'id'>) {
    if (draft[key].length >= 500) { setMessage('한 종류당 500개까지 입력할 수 있습니다.'); return; }
    change(old => ({ ...old, [key]: [...old[key], { ...row, id: crypto.randomUUID() }] }));
  }
  function remove(key: Collection, id: string) {
    if (isReferenced(draft, id)) { setMessage('다른 항목에서 사용 중입니다. 연결을 먼저 수정하세요.'); return; }
    change(old => ({ ...old, [key]: old[key].filter(row => row.id !== id) }));
  }
  const del = (key: Collection, id: string, label: string) => <button type="button" className="rounded px-2 py-2 text-sm text-red-700 hover:bg-red-50 disabled:text-slate-400" aria-label={`${label} 삭제`} title={isReferenced(draft, id) ? '연결된 청구·절차·비용을 먼저 수정하세요.' : undefined} onClick={() => remove(key, id)} disabled={isReferenced(draft, id)}>삭제</button>;
  const meta = (patch: Partial<LitigationDraft['meta']>) => change(old => ({ ...old, meta: { ...old.meta, ...patch } }));
  const review = (patch: Partial<LitigationDraft['review']>) => change(old => ({ ...old, review: { ...old.review, ...patch } }));
  const partyOptions = draft.parties.map(p => ({ id: p.id, name: `${p.name || '이름 미입력'} · ${p.mainRole}` }));
  const claimOptions = draft.claims.map(c => ({ id: c.id, name: `${c.kind} · ${c.title || '청구명 미입력'}` }));
  const stageOptions = draft.stages.map(s => ({ id: s.id, name: `${s.type} · ${s.number || '사건번호 미입력'}` }));
  function save() {
    try { parseDraft(serialized); } catch { setMessage('저장 가능한 초안 크기·형식을 확인하세요. 입력 내용은 유지됩니다.'); return; }
    try { localStorage.setItem(STORAGE_KEY, serialized); setSaved(serialized); setMessage('이 브라우저에 초안을 저장했습니다.'); }
    catch { setMessage('브라우저 저장소에 저장하지 못했습니다. 저장 공간 또는 브라우저 설정을 확인하세요.'); }
  }
  function applyReplace(kind: Replacement) {
    setReplace(null);
    try {
      if (kind === 'load') {
        const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
        if (!raw) { setMessage('이 브라우저에 저장된 초안이 없습니다.'); return; }
        const next = parseDraft(raw); setDraft(next); setSaved(JSON.stringify(next));
        setMessage(JSON.parse(raw).version === 1 ? '기존 초안을 새 형식으로 읽었습니다. 원본 저장본은 유지되며 계산 계획은 비어 있습니다. 검토 후 새 형식으로 저장하세요.' : '저장된 초안을 복원했습니다.');
      } else {
        const next = kind === 'sample' ? sampleDraft() : kind === 'case' ? referenceCaseDraft(selectedCaseId.current) : kind === 'report' ? reportCaseDraft(selectedCaseId.current) : blankDraft(); setDraft(next);
        // 새 작업으로 바꿔도 저장된 초안은 저장 버튼을 누르기 전까지 보존한다.
        setSaved(kind === 'new' ? JSON.stringify(next) : saved);
        setMessage(kind === 'report' ? `${selectedCaseId.current} 출력 검증 사례를 불러왔습니다. 기대 금액과 계산서를 비교하세요.` : kind === 'case' ? `${selectedCaseId.current} 유형별 사례를 불러왔습니다. 배분·검토 목차에서 계산 경로와 원문 대조를 확인하세요.` : kind === 'sample' ? '검증 사례를 불러왔습니다. 수정 전 입력과 기준 금액을 비교할 수 있습니다.' : '새 초안을 시작했습니다. 브라우저에 저장된 초안은 유지됩니다.');
      }
      setPlanSession(value => value + 1);
      revealSection(kind === 'report' ? 5 : 0);
    } catch { setMessage('저장된 초안을 읽을 수 없습니다. 현재 입력과 저장 데이터는 덮어쓰지 않았습니다.'); }
  }
  const requestReplace = (kind: Replacement) => {
    if (serialized !== JSON.stringify(blankDraft())) setReplace(kind); else applyReplace(kind);
  };
  const recognizedTotal = draft.costs.reduce((sum, c) => sum + BigInt(recognizedValue(c) ?? '0'), BigInt(0));
  const sectionSummaries = [
    `당사자 ${draft.parties.length}명 · 청구 ${draft.claims.length}건`,
    `절차 ${draft.stages.length}개 · 계산용 가액 ${draft.calculation.values.length}건`,
    `부담 관계 ${draft.rulings.length}건`,
    `대리 관계 ${draft.mandates.length}건 · 비용 ${draft.costs.length}건`,
    `배분 계획 ${draft.calculation.plans.length}/${draft.costs.length}건 · 입력 인정액 ${recognizedTotal.toLocaleString('ko-KR')}원`,
    '검토용 계산서 미리보기 · 인쇄 / PDF 저장',
  ];
  const sectionProps = (index: number) => ({
    index, ...sections[index], summary: sectionSummaries[index], open: expanded[index],
    issueCount: issues.filter(issue => issue.step === index).length,
    onOpenChange: (open: boolean) => setSectionOpen(index, open),
  });

  return <MainLayout wide><div className="cost-workspace mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" />민사 업무 지원 <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1">입력·검토 초안</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">소송비용액확정</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">사건 관계와 비용의 근거를 연결하고, 당사자별 배분 계획을 검토하세요.</p></div>
      <div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setCasePickerOpen(true)}>유형별 사례</button><button className={secondary} onClick={() => requestReplace('sample')}>검증 사례 불러오기</button><button className={secondary} onClick={() => requestReplace('load')}>저장 초안 복원</button><button className={primary} onClick={save}>브라우저에 초안 저장</button></div>
    </div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600"><span>이 브라우저에만 저장됩니다. 입력 소가·실비로 변호사보수를 산정하고 비용 배분을 가계산합니다. 서버 저장·결정문 확정은 미지원입니다.</span><span className="font-semibold">{dirty ? '저장하지 않은 변경 있음' : '변경 없음'}</span></div>
    {message && <p role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}
    <div className="mb-7 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white py-4 text-center"><div><p className="text-xs text-slate-500">당사자 / 청구</p><p className="mt-1 text-lg font-bold">{draft.parties.length} <span className="font-normal text-slate-300">/</span> {draft.claims.length}</p></div><div><p className="text-xs text-slate-500">절차 / 비용 항목</p><p className="mt-1 text-lg font-bold">{draft.stages.length} <span className="font-normal text-slate-300">/</span> {draft.costs.length}</p></div><div><p className="text-xs text-slate-500">입력 확인 사항</p><p className="mt-1 text-lg font-bold text-amber-700">{issues.length}건</p></div></div>
    <nav id="cost-contents" aria-label="입력 목차" className="mb-6 scroll-mt-24 rounded-xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-[68px] xl:z-20">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-900">입력 목차</p><p className="mt-1 text-xs leading-relaxed text-slate-500">목차를 누르면 해당 항목을 펼쳐 이동합니다. 접어도 입력 내용은 유지됩니다.</p></div><div className="flex shrink-0 flex-wrap gap-2"><button className={secondary} onClick={() => setAllSections(true)}>전체 펼치기</button><button className={secondary} onClick={() => setAllSections(false)}>전체 접기</button></div></div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{sections.map((section, index) => <a key={section.title} href={`#cost-section-${index}`} onClick={event => { event.preventDefault(); revealSection(index); }} className="rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed text-slate-700 hover:border-blue-300 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-blue-600"><span className="mr-2 text-xs font-semibold text-blue-700">{index + 1}</span>{section.title}</a>)}</div>
      <p className="mt-2 text-xs text-slate-500">전체 펼치기는 비용·배분 근거 등의 세부 입력도 함께 엽니다.</p>
    </nav>

    <div ref={form} className="space-y-5">
      <FormSection {...sectionProps(0)}>
        <Panel title="신청 사건" description="신청 사건의 기본 정보를 입력하세요. 작업명은 선택 사항이며 임시 저장은 필수 정보가 비어 있어도 가능합니다." action={<button className={secondary} onClick={() => requestReplace('new')}>새 초안</button>}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="작업명" hint="선택 사항 · 초안을 구분하는 이름으로 계산서에는 출력되지 않습니다." value={draft.meta.title} onChange={title => meta({ title })} /><Field label="신청 법원" value={draft.meta.court} onChange={court => meta({ court })} /><Field label="확정신청 사건번호" value={draft.meta.number} onChange={number => meta({ number })} />
          <Field label="신청일" type="date" value={draft.meta.applicationDate} onChange={applicationDate => meta({ applicationDate })} /><Field label="신청총액 (원)" type="money" value={draft.meta.requested} onChange={requested => meta({ requested })} hint="미확인 금액은 공란으로 둡니다. 공란과 0원은 다르게 취급합니다." /><Field label="신청 범위·선행 신청 메모" value={draft.meta.scopeNote} onChange={scopeNote => meta({ scopeNote })} />
        </div></Panel>
        <Panel title="전체 당사자" description="이번 신청 대상이 아닌 본안 당사자도 등록하세요. 반소 및 심급별 관계는 아래 청구·절차에서 따로 연결합니다." action={<button className={secondary} onClick={() => add('parties', { name: '', mainRole: '원고', applicationRole: '신청인' })}>+ 당사자 추가</button>}>
          {!draft.parties.length ? <Empty>당사자를 추가하거나 검증 사례를 불러와 시작하세요.</Empty> : <div className="space-y-3">{draft.parties.map((p, i) => <div key={p.id} className="grid items-end gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Field label={`당사자 ${i + 1} 표시명`} value={p.name} onChange={name => edit('parties', p.id, { name })} /><Select label="본안의 기본 지위" value={p.mainRole} options={['원고', '피고', '독립당사자참가인', '보조참가인', '기타']} onChange={mainRole => edit('parties', p.id, { mainRole })} /><Select label="이번 신청 지위" value={p.applicationRole} options={['신청인', '피신청인', '신청 대상 아님']} onChange={applicationRole => edit('parties', p.id, { applicationRole })} />{del('parties', p.id, `당사자 ${i + 1}`)}
          </div>)}</div>}
        </Panel>
        <Panel title="본소·반소 및 청구 관계" description="반소는 실제로 관련된 당사자만 선택하세요. 아래 소가는 청구별 자료값이며 심급별 보수·인지 소가의 자동 확정값이 아닙니다." action={<button className={secondary} onClick={() => add('claims', { kind: '본소', title: '', claimantIds: [], opponentIds: [], value: '', relation: '' })}>+ 청구 추가</button>}>
          {!draft.claims.length ? <Empty>본소와 반소를 각각 등록합니다.</Empty> : <div className="space-y-5">{draft.claims.map((c, i) => <div key={c.id} className="space-y-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">청구 {i + 1}</h3>{del('claims', c.id, `청구 ${i + 1}`)}</div><div className="grid gap-4 sm:grid-cols-3"><Select label="청구 구분" value={c.kind} options={['본소', '반소', '참가청구', '기타']} onChange={kind => edit('claims', c.id, { kind })} /><Field label="청구명" value={c.title} onChange={title => edit('claims', c.id, { title })} /><Field label="청구 소가 자료값 (원)" type="money" value={c.value} onChange={value => edit('claims', c.id, { value })} /></div><Multi label="청구자" items={partyOptions} selected={c.claimantIds} onChange={claimantIds => edit('claims', c.id, { claimantIds })} /><Multi label="청구 상대방" items={partyOptions} selected={c.opponentIds} onChange={opponentIds => edit('claims', c.id, { opponentIds })} /><Field label="중복·공동 지급 관계와 당사자별 금액" multiline value={c.relation} onChange={relation => edit('claims', c.id, { relation })} /></div>)}</div>}
        </Panel>
      </FormSection>
      <FormSection {...sectionProps(1)}>
        <Panel title="심급·청구 변경 이력" description="환송·재상고·확정신청을 별개 절차로 등록할 수 있습니다. 절차 수를 변호사보수 산입 횟수로 자동 사용하지 않습니다." action={<button className={secondary} onClick={() => add('stages', { type: '제1심', number: '', partyIds: [], appealScope: '', changes: '' })}>+ 절차 추가</button>}>
        {!draft.stages.length ? <Empty>본안 사건과 불복 절차를 등록하세요.</Empty> : <div className="space-y-5">{draft.stages.map((s, i) => <div key={s.id} className="space-y-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">절차 {i + 1}</h3>{del('stages', s.id, `절차 ${i + 1}`)}</div><div className="grid gap-4 sm:grid-cols-2"><Select label="절차 유형" value={s.type} options={stageTypes} onChange={type => edit('stages', s.id, { type })} /><Field label="본안·절차 사건번호" value={s.number} onChange={number => edit('stages', s.id, { number })} /></div><Multi label="참여 당사자" items={partyOptions} selected={s.partyIds} onChange={partyIds => edit('stages', s.id, { partyIds })} /><Field label="불복 당사자·상대방·금액·범위" multiline value={s.appealScope} onChange={appealScope => edit('stages', s.id, { appealScope })} /><Field label="청구 변경·취하·환송·병합 이력과 소가 근거" multiline value={s.changes} onChange={changes => edit('stages', s.id, { changes })} /></div>)}</div>}
      </Panel><AdvancedFields title="추가 계산용 가액·배분 가중치" summary={`${draft.calculation.values.length}건 · 복합 사건·수동 산정 시`}><p className="text-sm leading-relaxed text-slate-600">일반적인 자동 보수 계산은 대리인·비용 목차에서 심급별 소가와 실비를 입력합니다. 이곳은 별도 배분 가중치나 수동 산정 기초가 필요한 경우 사용합니다.</p><CalculationWorkspace section="values" draft={draft} onChange={fn => change(fn)} /></AdvancedFields>
      </FormSection>
      <FormSection {...sectionProps(2)}>
        <Panel title="비용 부담 주문과 적용 관계" description="주문 원문과 해석한 관계를 함께 기록합니다. 정방향은 부담자가 상대방 비용에 부담하는 몫, 역방향은 그 상대방이 부담자의 비용에 부담하는 몫입니다. 두 비율을 각각 확인합니다. 연대 등 복합 관계는 메모하고 개별 검토하세요." action={<button className={secondary} onClick={() => add('rulings', { text: '', stageIds: [], claimIds: [], payerIds: [], receiverIds: [], numerator: '', denominator: '', reverseNumerator: '', reverseDenominator: '', status: '미확인' })}>+ 부담 관계 추가</button>}>
        {!draft.rulings.length ? <Empty>당사자·심급·청구별 부담 관계를 등록하세요.</Empty> : <div className="space-y-5">{draft.rulings.map((r, i) => <div key={r.id} className="space-y-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">부담 관계 {i + 1}</h3>{del('rulings', r.id, `부담 관계 ${i + 1}`)}</div><Field label="주문 원문·적용 범위 해석" multiline value={r.text} onChange={text => edit('rulings', r.id, { text })} /><Multi label="적용 절차" items={stageOptions} selected={r.stageIds} onChange={stageIds => edit('rulings', r.id, { stageIds })} /><Multi label="적용 청구" items={claimOptions} selected={r.claimIds} onChange={claimIds => edit('rulings', r.id, { claimIds })} /><div className="grid gap-4 lg:grid-cols-2"><Multi label="비용 부담자" items={partyOptions} selected={r.payerIds} onChange={payerIds => edit('rulings', r.id, { payerIds })} /><Multi label="상환받을 상대방" items={partyOptions} selected={r.receiverIds} onChange={receiverIds => edit('rulings', r.id, { receiverIds })} /></div><div className="grid gap-4 sm:grid-cols-3"><Field label="부담 비율 분자" type="money" value={r.numerator} onChange={numerator => edit('rulings', r.id, { numerator })} /><Field label="부담 비율 분모" type="money" value={r.denominator} onChange={denominator => edit('rulings', r.id, { denominator })} /><Field label="역방향 부담 비율 분자" type="money" value={r.reverseNumerator} onChange={reverseNumerator => edit('rulings', r.id, { reverseNumerator })} /><Field label="역방향 부담 비율 분모" type="money" value={r.reverseDenominator} onChange={reverseDenominator => edit('rulings', r.id, { reverseDenominator })} /><Select label="주문 범위·확정 또는 집행력 확인" value={r.status} options={['미확인', '검토함', '추가 자료 필요']} onChange={status => edit('rulings', r.id, { status })} /></div></div>)}</div>}
      </Panel>
      </FormSection>
      <FormSection {...sectionProps(3)}>
        <Panel title="비용·증빙" description="변호사보수는 해당 심급 소가와 실비로 자동 산입액을 계산할 수 있습니다. 그 밖의 비용은 청구액·환급액·직원 인정액을 구분하고 증빙 문서·쪽수를 기록하세요." action={<button className={secondary} onClick={() => add('costs', { attorneyFee: { schedule: '2020-12-28', treatment: 'ordinary', litigationValue: '' }, title: '', kind: '변호사보수', stageId: '', payerIds: [], claimIds: [], claimed: '', refund: '0', recognized: '', evidence: '', allocation: '미정', targetIds: [], reason: '', note: '' })}>+ 비용 추가</button>}>
          {!draft.costs.length ? <Empty>비용을 추가한 뒤 배분·검토 목차에서 처리 계획을 정하세요.</Empty> : <div className="space-y-4">{draft.costs.map((c, i) => <details key={c.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold"><span>{c.title || `비용 ${i + 1}`}</span><span className="ml-3 font-normal text-slate-500">인정액 {recognizedValue(c) === null ? '입력 확인' : `${BigInt(recognizedValue(c)!).toLocaleString('ko-KR')}원`}</span></summary><div className="mt-5 space-y-4"><div className="flex justify-end">{del('costs', c.id, `비용 ${i + 1}`)}</div><div className="grid gap-4 sm:grid-cols-3"><Field label="비용명" value={c.title} onChange={title => edit('costs', c.id, { title })} /><Select label="비용 종류" value={c.kind} options={['변호사보수', '인지대', '송달료', '감정료', '신청비용', '법무사보수', '당사자비용', '기타']} onChange={kind => edit('costs', c.id, { kind, attorneyFee: kind === '변호사보수' ? c.attorneyFee : undefined })} /><Choice label="발생 절차" value={c.stageId} items={stageOptions} onChange={stageId => edit('costs', c.id, { stageId })} /></div><Multi label="지출·귀속 당사자" items={partyOptions} selected={c.payerIds} onChange={payerIds => edit('costs', c.id, { payerIds })} /><Multi label="관련 청구 (신청비용 등은 선택 가능)" items={claimOptions} selected={c.claimIds} onChange={claimIds => edit('costs', c.id, { claimIds })} />{c.kind === '변호사보수' && <AttorneyFeeEditor cost={c} stageName={draft.stages.find(s => s.id === c.stageId)?.type || ''} initialValue={(() => { const plan = draft.calculation.plans.find(p => p.costId === c.id); const group = draft.calculation.groups.find(g => g.id === plan?.basisGroupId); const values = group?.valueIds.map(id => draft.calculation.values.find(v => v.id === id)?.amount); if (!values?.length || values.some(v => v === undefined || amount(v) === null)) return ''; const numbers = values.map(v => BigInt(v!)); return String(group!.method === '합산' ? numbers.reduce((a, b) => a + b, BigInt(0)) : numbers.reduce((a, b) => a > b ? a : b)); })()} onChange={patch => edit('costs', c.id, patch)} />}
          {!c.attorneyFee && <div className="grid gap-4 sm:grid-cols-3"><Field label="청구액·환급 반영 전 금액 (원)" type="money" value={c.claimed} onChange={claimed => edit('costs', c.id, { claimed })} /><Field label="별도 차감할 환급액 (원)" type="money" value={c.refund} onChange={refund => edit('costs', c.id, { refund })} hint="이미 순액을 입력한 경우 0원을 입력합니다." /><Field label="직원 검토 인정액 (원)" type="money" value={c.recognized} onChange={recognized => edit('costs', c.id, { recognized })} /></div>}<Field label="증빙·기록 문서명과 쪽수" value={c.evidence} onChange={evidence => edit('costs', c.id, { evidence })} /><Field label="인정액 조정 사유·지급자와 귀속자가 다른 사정" multiline value={c.note} onChange={note => edit('costs', c.id, { note })} /></div></details>)}</div>}
        </Panel>
        <AdvancedFields title="수임·공동대리 및 수동 산정 기초" summary={`대리 관계 ${draft.mandates.length}건 · 산정 그룹 ${draft.calculation.groups.length}건`}>
          <p className="text-sm leading-relaxed text-slate-600">공동대리·선임·사임 이력과 계약 보수 자료를 검토하거나 수동 산정 기초를 연결할 때 펼치세요. 자동 보수 계산에 사용할 심급별 실비는 위 비용 항목에서 입력합니다.</p>
        <Panel title="대리인·수임 범위" description="공동대리 범위와 심급, 선임·사임 이력을 따로 기록합니다. 교체 횟수나 기간만으로 보수 한도를 가산·안분하지 않습니다." action={<button className={secondary} onClick={() => add('mandates', { name: '', partyIds: [], stageIds: [], claimIds: [], start: '', end: '', endReason: '', agreed: '', paid: '', evidence: '' })}>+ 대리 관계 추가</button>}>
          {!draft.mandates.length ? <Empty>변호사가 선임된 경우 대리 관계를 추가하세요.</Empty> : <div className="space-y-4">{draft.mandates.map((m, i) => <details key={m.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{m.name || `대리 관계 ${i + 1}`}</summary><div className="mt-5 space-y-4"><div className="flex justify-end">{del('mandates', m.id, `대리 관계 ${i + 1}`)}</div><Field label="대리인·수임 명칭" value={m.name} onChange={name => edit('mandates', m.id, { name })} /><Multi label="의뢰인" items={partyOptions} selected={m.partyIds} onChange={partyIds => edit('mandates', m.id, { partyIds })} /><Multi label="담당 절차" items={stageOptions} selected={m.stageIds} onChange={stageIds => edit('mandates', m.id, { stageIds })} /><Multi label="대리 청구 범위" items={claimOptions} selected={m.claimIds} onChange={claimIds => edit('mandates', m.id, { claimIds })} /><div className="grid gap-4 sm:grid-cols-3"><Field label="선임일" type="date" value={m.start} onChange={start => edit('mandates', m.id, { start })} /><Field label="종료일" type="date" value={m.end} onChange={end => edit('mandates', m.id, { end })} /><Field label="사임·해임·종료 사유" value={m.endReason} onChange={endReason => edit('mandates', m.id, { endReason })} /><Field label="약정보수 (원)" hint="수임계약 참고금액 · 자동 보수 계산에 직접 사용되지 않습니다." type="money" value={m.agreed} onChange={agreed => edit('mandates', m.id, { agreed })} /><Field label="지급보수 (원)" hint="수임관계 전체의 참고금액 · 계산용 실비는 비용 항목에서 입력하세요." type="money" value={m.paid} onChange={paid => edit('mandates', m.id, { paid })} /><Field label="계약·지급·정산 자료 참조" value={m.evidence} onChange={evidence => edit('mandates', m.id, { evidence })} /></div></div></details>)}</div>}
        </Panel>
        <CalculationWorkspace section="groups" draft={draft} onChange={fn => change(fn)} />
        </AdvancedFields>
      </FormSection>
      <FormSection {...sectionProps(4)}>
        <CalculationWorkspace key={planSession} section="plans" draft={draft} onChange={fn => change(fn)} />
        <AdvancedFields title="배분 범위·근거 직접 편집" summary={`${draft.costs.length}개 비용 · 복합 배분·추가 검토 시`}>
        <Panel title="비용별 배분 범위·근거" description="대상 당사자와 근거를 기록합니다. 배분 방식 메모만 바꿔도 계산 경로가 바뀌지는 않습니다. 실제 배분 방식·비율은 위 계산용 배분 계획에서 설정하세요. 간편 배분 계획을 적용하면 대상 당사자와 직접 귀속 메모도 함께 설정됩니다.">
          <p className="mb-5 text-sm text-slate-600">입력 인정액 합계 (배분 전): <strong className="text-slate-950">{recognizedTotal.toLocaleString('ko-KR')}원</strong> · 금액 미입력·오류 {draft.costs.filter(c => recognizedValue(c) === null).length}건</p>
          {!draft.costs.length ? <Empty>대리인·비용 목차에서 비용을 먼저 등록하세요.</Empty> : <div className="space-y-4">{draft.costs.map((c, i) => <details key={c.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{c.title || `비용 ${i + 1}`} <span className="ml-2 font-normal text-slate-500">{c.allocation}</span></summary><div className="mt-5 space-y-4"><Select label="배분 방식 메모" value={c.allocation} options={allocationTypes} onChange={allocation => edit('costs', c.id, { allocation })} /><Multi label="배분에 관련된 당사자" items={partyOptions} selected={c.targetIds} onChange={targetIds => edit('costs', c.id, { targetIds })} /><Field label="배분 근거·단계·분자와 분모" multiline value={c.reason} onChange={reason => edit('costs', c.id, { reason })} /></div></details>)}</div>}
        </Panel>
        </AdvancedFields>
        <Panel title="최고·상계·절사 검토" description="본안 상계항변, 비용 법정상계, 절차 밖 변제·합의를 구별합니다. 지급 사실만으로 확정액을 차감하지 않습니다."><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="상대방 최고·교부일" type="date" value={draft.review.highestDate} onChange={highestDate => review({ highestDate })} /><Field label="자료 제출기한" type="date" value={draft.review.responseDeadline} onChange={responseDeadline => review({ responseDeadline })} /><Select label="상대방 자료 제출" value={draft.review.responseState} options={['미확인', '기간 내 제출', '기간 내 미제출', '추가 확인 필요']} onChange={responseState => review({ responseState })} /><Select label="비용 법정상계 검토" value={draft.review.setoff} options={['미검토', '제112조 본문 적용 검토', '제111조 제2항 예외 검토', '개별 검토 필요']} onChange={setoff => review({ setoff })} /><div className="text-sm text-slate-700"><p className="mb-2 font-medium">계산에 적용되는 절사 설정</p><p data-testid="rounding-summary" className="rounded-lg bg-slate-50 p-3">{draft.calculation.rounding.unit === '1' ? '원 미만 절사' : draft.calculation.rounding.unit === '10' ? '10원 미만 절사' : '단위 미설정'} · {draft.calculation.rounding.timing === 'direction' ? '방향별 절사 후 상계' : draft.calculation.rounding.timing === 'net' ? '상계 후 절사' : '시점 미설정'}</p><p className="mt-1.5 text-xs leading-relaxed text-slate-500">위 계산용 배분 계획의 절사 설정을 공통으로 적용합니다.</p>{draft.review.rounding !== '미확정' && draft.review.rounding && <p className="mt-2 text-xs leading-relaxed text-slate-500">기존 검토 메모 (계산 미적용): {draft.review.rounding}</p>}</div></div><div className="mt-5"><Field label="미확정 쟁점·판단 근거·검토 메모" multiline value={draft.review.notes} onChange={notes => review({ notes })} /></div></Panel>
        <CalculationWorkspace section="results" draft={draft} onChange={fn => change(fn)} />

        <ReferenceCaseComparison draft={draft} />
        {!draft.referenceCaseId && <Panel title="기준 사례 비교" description="2023.12.15. 첨부 사례의 문서상 상환액입니다. 현재 입력으로 자동 계산한 결과가 아닙니다.">
          {referenceVisible ? <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">입력을 수정하지 않은 기준 사례의 상환액</caption><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">부담자</th><th className="p-3">상환받을 당사자</th><th className="p-3 text-right">문서 기준액</th></tr></thead><tbody>{sampleReference.map(([payer, receiver, n]) => <tr key={payer + receiver} className="border-b border-slate-100"><td className="p-3">{payer}</td><td className="p-3">{receiver}</td><td className="p-3 text-right font-semibold tabular-nums">{money(n)}</td></tr>)}</tbody></table></div><p className="mt-4 text-sm leading-relaxed text-amber-800">방향별 절사 후 상계로 재현한 사례입니다. 총괄표의 1원 차이는 미해결이며 운영 기준으로 확정하지 않았습니다.</p></>
            : <Empty>기준 사례와 다른 입력입니다. 기준 금액을 현재 사건의 결과로 표시하지 않습니다. 비교하려면 검증 사례를 다시 불러오세요.</Empty>}
        </Panel>}
        <Panel title={`입력 확인 사항 ${issues.length}건`} description="입력 확인 사항이 없어도 법률 규칙의 검증·결정문 확정이 완료된 것은 아닙니다. 주문 해석, 보수 산정·배분·절사 규칙은 별도 검토가 필요합니다.">
          {issues.length ? <ul className="max-h-96 space-y-2 overflow-y-auto">{issues.map((issue, i) => <li key={i}><button className="w-full rounded-lg bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-950 hover:bg-amber-100" onClick={() => revealSection(issue.step, true)}><span className="mr-2 font-semibold">{sections[issue.step].title}</span>{issue.message}<span className="ml-2 text-amber-700">입력으로 이동 →</span></button></li>)}</ul> : <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">기본 입력 확인을 통과했습니다. 법률상 적정성·전체 관계 및 산식의 검토는 별도로 필요합니다.</p>}
          <p className="mt-5 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">현재 제공 범위: 입력·초안 저장·직원 인정액의 배분 가계산·단순 사건의 검토용 계산서 출력. 입력 소가의 법률상 적정성·특수 감액 및 결정문 확정은 별도 검토가 필요합니다.</p>
        </Panel>
      </FormSection>
      <FormSection {...sectionProps(5)}>
        <ReportWorkspace draft={draft} onLoadCase={id => { selectedCaseId.current = id; requestReplace('report'); }} />
      </FormSection>

    </div>
    <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5"><a className={secondary} href="#cost-contents">목차로 돌아가기 ↑</a><p className="text-xs text-slate-500">작업한 내용은 ‘브라우저에 초안 저장’으로 보관하세요.</p><button className={primary} onClick={save}>브라우저에 초안 저장</button></div>

    {casePickerOpen && <ReferenceCasePicker onClose={() => setCasePickerOpen(false)} onSelect={id => { selectedCaseId.current = id; setCasePickerOpen(false); requestReplace('case'); }} />}
    {replace && <dialog ref={replaceDialog} onCancel={() => setReplace(null)} aria-labelledby="replace-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/50"><h2 id="replace-title" className="text-lg font-bold">현재 입력을 바꾸시겠습니까?</h2><p className="my-4 text-sm leading-relaxed text-slate-600">저장하지 않은 입력은 사라집니다. 기존 브라우저 저장본은 저장 버튼을 누르기 전까지 유지됩니다.</p><div className="flex justify-end gap-2"><button autoFocus className={secondary} onClick={() => setReplace(null)}>취소</button><button className={primary} onClick={() => applyReplace(replace)}>입력 바꾸기</button></div></dialog>}
  </div></MainLayout>;
}
