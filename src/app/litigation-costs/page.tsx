'use client';

import { useEffect, useRef, useState } from 'react';
import { Field, Select, Multi, Panel, Empty, inputClass, primary, secondary } from './form-controls';
import { CalculationWorkspace } from './CalculationWorkspace';
import { ReferenceCaseComparison, ReferenceCasePicker } from './ReferenceCases';
import { referenceCaseDraft } from '@/lib/litigation-costs-case-library';
import { MainLayout } from '@/components/layout';
import {
  allocationTypes, amount, blankDraft, isReferenced, matchesSample, money, parseDraft,
  reviewDraft, sampleDraft, sampleReference, stageTypes, STORAGE_KEY, LEGACY_STORAGE_KEY,
  type LitigationDraft,
} from '@/lib/litigation-costs-draft';

const steps = ['사건·당사자', '심급·청구 변동', '비용 부담 주문', '대리인·비용', '배분·검토'];
type Replacement = 'sample' | 'case' | 'new' | 'load';
type Collection = 'parties' | 'claims' | 'stages' | 'rulings' | 'mandates' | 'costs';
type Row<K extends Collection> = LitigationDraft[K][number];

export default function LitigationCostsPage() {
  const [draft, setDraft] = useState<LitigationDraft>(blankDraft);
  const [step, setStep] = useState(0);
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
        const next = kind === 'sample' ? sampleDraft() : kind === 'case' ? referenceCaseDraft(selectedCaseId.current) : blankDraft(); setDraft(next);
        // 새 작업으로 바꿔도 저장된 초안은 저장 버튼을 누르기 전까지 보존한다.
        setSaved(kind === 'new' ? JSON.stringify(next) : saved);
        setMessage(kind === 'case' ? `${selectedCaseId.current} 유형별 사례를 불러왔습니다. 배분·검토 단계에서 계산 경로와 원문 대조를 확인하세요.` : kind === 'sample' ? '검증 사례를 불러왔습니다. 수정 전 입력과 기준 금액을 비교할 수 있습니다.' : '새 초안을 시작했습니다. 브라우저에 저장된 초안은 유지됩니다.');
      }
      setStep(0);
    } catch { setMessage('저장된 초안을 읽을 수 없습니다. 현재 입력과 저장 데이터는 덮어쓰지 않았습니다.'); }
  }
  const requestReplace = (kind: Replacement) => {
    if (serialized !== JSON.stringify(blankDraft())) setReplace(kind); else applyReplace(kind);
  };
  const recognizedTotal = draft.costs.reduce((sum, c) => sum + BigInt(amount(c.recognized) ?? 0), BigInt(0));

  return <MainLayout wide><div className="cost-workspace mx-auto max-w-[1500px] px-4 py-7 sm:px-7 lg:px-9">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-blue-700"><span className="h-1.5 w-1.5 rounded-full bg-blue-600" />민사 업무 지원 <span className="rounded border border-blue-200 bg-blue-50 px-2 py-1">입력·검토 초안</span></div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">소송비용액확정</h1><p className="mt-2 text-sm leading-relaxed text-slate-500">사건 관계와 비용의 근거를 연결하고, 당사자별 배분 계획을 검토하세요.</p></div>
      <div className="flex flex-wrap gap-2"><button className={secondary} onClick={() => setCasePickerOpen(true)}>유형별 사례</button><button className={secondary} onClick={() => requestReplace('sample')}>검증 사례 불러오기</button><button className={secondary} onClick={() => requestReplace('load')}>저장 초안 복원</button><button className={primary} onClick={save}>브라우저에 초안 저장</button></div>
    </div>
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-100 px-4 py-3 text-xs leading-relaxed text-slate-600"><span>이 브라우저에만 저장됩니다. 직원 인정액으로 배분 가계산을 지원합니다. 서버 저장·보수 한도 자동 산정·결정문 확정은 미지원입니다.</span><span className="font-semibold">{dirty ? '저장하지 않은 변경 있음' : '변경 없음'}</span></div>
    {message && <p role="status" className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}
    <div className="mb-7 grid grid-cols-3 divide-x divide-slate-200 rounded-xl border border-slate-200 bg-white py-4 text-center"><div><p className="text-xs text-slate-500">당사자 / 청구</p><p className="mt-1 text-lg font-bold">{draft.parties.length} <span className="font-normal text-slate-300">/</span> {draft.claims.length}</p></div><div><p className="text-xs text-slate-500">절차 / 비용 항목</p><p className="mt-1 text-lg font-bold">{draft.stages.length} <span className="font-normal text-slate-300">/</span> {draft.costs.length}</p></div><div><p className="text-xs text-slate-500">입력 확인 사항</p><p className="mt-1 text-lg font-bold text-amber-700">{issues.length}건</p></div></div>
    <nav aria-label="소송비용 입력 단계" className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">{steps.map((name, index) => <button key={name} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)} className={`flex min-h-14 items-center gap-2 rounded-lg border px-3 py-3 text-left text-sm ${step === index ? 'border-blue-700 bg-blue-700 font-semibold text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${step === index ? 'bg-white/20' : 'bg-slate-100'}`}>{index + 1}</span>{name}</button>)}</nav>

    <div className="space-y-5" key={step}>
      {step === 0 && <>
        <Panel title="신청 사건" description="임시 저장은 필수 정보가 비어 있어도 가능합니다. 실제 사건과 구분할 수 있는 작업명을 입력하세요." action={<button className={secondary} onClick={() => requestReplace('new')}>새 초안</button>}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="작업명" value={draft.meta.title} onChange={title => meta({ title })} /><Field label="신청 법원" value={draft.meta.court} onChange={court => meta({ court })} /><Field label="확정신청 사건번호" value={draft.meta.number} onChange={number => meta({ number })} />
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
      </>}

      {step === 1 && <><Panel title="심급·청구 변경 이력" description="환송·재상고·확정신청을 별개 절차로 등록할 수 있습니다. 절차 수를 변호사보수 산입 횟수로 자동 사용하지 않습니다." action={<button className={secondary} onClick={() => add('stages', { type: '제1심', number: '', partyIds: [], appealScope: '', changes: '' })}>+ 절차 추가</button>}>
        {!draft.stages.length ? <Empty>본안 사건과 불복 절차를 등록하세요.</Empty> : <div className="space-y-5">{draft.stages.map((s, i) => <div key={s.id} className="space-y-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">절차 {i + 1}</h3>{del('stages', s.id, `절차 ${i + 1}`)}</div><div className="grid gap-4 sm:grid-cols-2"><Select label="절차 유형" value={s.type} options={stageTypes} onChange={type => edit('stages', s.id, { type })} /><Field label="본안·절차 사건번호" value={s.number} onChange={number => edit('stages', s.id, { number })} /></div><Multi label="참여 당사자" items={partyOptions} selected={s.partyIds} onChange={partyIds => edit('stages', s.id, { partyIds })} /><Field label="불복 당사자·상대방·금액·범위" multiline value={s.appealScope} onChange={appealScope => edit('stages', s.id, { appealScope })} /><Field label="청구 변경·취하·환송·병합 이력과 소가 근거" multiline value={s.changes} onChange={changes => edit('stages', s.id, { changes })} /></div>)}</div>}
      </Panel><CalculationWorkspace section="values" draft={draft} onChange={fn => change(fn)} /></>}

      {step === 2 && <Panel title="비용 부담 주문과 적용 관계" description="주문 원문과 해석한 관계를 함께 기록합니다. 정방향은 부담자가 상대방 비용에 부담하는 몫, 역방향은 그 상대방이 부담자의 비용에 부담하는 몫입니다. 두 비율을 각각 확인합니다. 연대 등 복합 관계는 메모하고 개별 검토하세요." action={<button className={secondary} onClick={() => add('rulings', { text: '', stageIds: [], claimIds: [], payerIds: [], receiverIds: [], numerator: '', denominator: '', reverseNumerator: '', reverseDenominator: '', status: '미확인' })}>+ 부담 관계 추가</button>}>
        {!draft.rulings.length ? <Empty>당사자·심급·청구별 부담 관계를 등록하세요.</Empty> : <div className="space-y-5">{draft.rulings.map((r, i) => <div key={r.id} className="space-y-4 rounded-lg border border-slate-200 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold">부담 관계 {i + 1}</h3>{del('rulings', r.id, `부담 관계 ${i + 1}`)}</div><Field label="주문 원문·적용 범위 해석" multiline value={r.text} onChange={text => edit('rulings', r.id, { text })} /><Multi label="적용 절차" items={stageOptions} selected={r.stageIds} onChange={stageIds => edit('rulings', r.id, { stageIds })} /><Multi label="적용 청구" items={claimOptions} selected={r.claimIds} onChange={claimIds => edit('rulings', r.id, { claimIds })} /><div className="grid gap-4 lg:grid-cols-2"><Multi label="비용 부담자" items={partyOptions} selected={r.payerIds} onChange={payerIds => edit('rulings', r.id, { payerIds })} /><Multi label="상환받을 상대방" items={partyOptions} selected={r.receiverIds} onChange={receiverIds => edit('rulings', r.id, { receiverIds })} /></div><div className="grid gap-4 sm:grid-cols-3"><Field label="부담 비율 분자" type="money" value={r.numerator} onChange={numerator => edit('rulings', r.id, { numerator })} /><Field label="부담 비율 분모" type="money" value={r.denominator} onChange={denominator => edit('rulings', r.id, { denominator })} /><Field label="역방향 부담 비율 분자" type="money" value={r.reverseNumerator} onChange={reverseNumerator => edit('rulings', r.id, { reverseNumerator })} /><Field label="역방향 부담 비율 분모" type="money" value={r.reverseDenominator} onChange={reverseDenominator => edit('rulings', r.id, { reverseDenominator })} /><Select label="주문 범위·확정 또는 집행력 확인" value={r.status} options={['미확인', '검토함', '추가 자료 필요']} onChange={status => edit('rulings', r.id, { status })} /></div></div>)}</div>}
      </Panel>}

      {step === 3 && <>
        <Panel title="대리인·수임 범위" description="공동대리 범위와 심급, 선임·사임 이력을 따로 기록합니다. 교체 횟수나 기간만으로 보수 한도를 가산·안분하지 않습니다." action={<button className={secondary} onClick={() => add('mandates', { name: '', partyIds: [], stageIds: [], claimIds: [], start: '', end: '', endReason: '', agreed: '', paid: '', evidence: '' })}>+ 대리 관계 추가</button>}>
          {!draft.mandates.length ? <Empty>변호사가 선임된 경우 대리 관계를 추가하세요.</Empty> : <div className="space-y-4">{draft.mandates.map((m, i) => <details key={m.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer font-semibold">{m.name || `대리 관계 ${i + 1}`}</summary><div className="mt-5 space-y-4"><div className="flex justify-end">{del('mandates', m.id, `대리 관계 ${i + 1}`)}</div><Field label="대리인·수임 명칭" value={m.name} onChange={name => edit('mandates', m.id, { name })} /><Multi label="의뢰인" items={partyOptions} selected={m.partyIds} onChange={partyIds => edit('mandates', m.id, { partyIds })} /><Multi label="담당 절차" items={stageOptions} selected={m.stageIds} onChange={stageIds => edit('mandates', m.id, { stageIds })} /><Multi label="대리 청구 범위" items={claimOptions} selected={m.claimIds} onChange={claimIds => edit('mandates', m.id, { claimIds })} /><div className="grid gap-4 sm:grid-cols-3"><Field label="선임일" type="date" value={m.start} onChange={start => edit('mandates', m.id, { start })} /><Field label="종료일" type="date" value={m.end} onChange={end => edit('mandates', m.id, { end })} /><Field label="사임·해임·종료 사유" value={m.endReason} onChange={endReason => edit('mandates', m.id, { endReason })} /><Field label="약정보수 (원)" type="money" value={m.agreed} onChange={agreed => edit('mandates', m.id, { agreed })} /><Field label="지급보수 (원)" type="money" value={m.paid} onChange={paid => edit('mandates', m.id, { paid })} /><Field label="계약·지급·정산 자료 참조" value={m.evidence} onChange={evidence => edit('mandates', m.id, { evidence })} /></div></div></details>)}</div>}
        </Panel>
        <CalculationWorkspace section="groups" draft={draft} onChange={fn => change(fn)} />
        <Panel title="비용·증빙" description="청구액·환급액·직원 검토 인정액을 분리합니다. 인정액은 직접 입력하는 검토값이며 자동 법률 계산값이 아닙니다. 증빙은 문서명·쪽수로 참조합니다." action={<button className={secondary} onClick={() => add('costs', { title: '', kind: '변호사보수', stageId: '', payerIds: [], claimIds: [], claimed: '', refund: '0', recognized: '', evidence: '', allocation: '미정', targetIds: [], reason: '', note: '' })}>+ 비용 추가</button>}>
          {!draft.costs.length ? <Empty>비용을 추가한 뒤 배분·검토 단계에서 처리 계획을 정하세요.</Empty> : <div className="space-y-4">{draft.costs.map((c, i) => <details key={c.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold"><span>{c.title || `비용 ${i + 1}`}</span><span className="ml-3 font-normal text-slate-500">인정액 {amount(c.recognized) === null ? '미입력' : money(amount(c.recognized)!)}</span></summary><div className="mt-5 space-y-4"><div className="flex justify-end">{del('costs', c.id, `비용 ${i + 1}`)}</div><div className="grid gap-4 sm:grid-cols-3"><Field label="비용명" value={c.title} onChange={title => edit('costs', c.id, { title })} /><Select label="비용 종류" value={c.kind} options={['변호사보수', '인지대', '송달료', '감정료', '신청비용', '법무사보수', '당사자비용', '기타']} onChange={kind => edit('costs', c.id, { kind })} /><label className="text-sm font-medium text-slate-700"><span className="mb-2 block">발생 절차</span><select className={inputClass} value={c.stageId} onChange={e => edit('costs', c.id, { stageId: e.target.value })}><option value="">선택하세요</option>{stageOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><Multi label="지출·귀속 당사자" items={partyOptions} selected={c.payerIds} onChange={payerIds => edit('costs', c.id, { payerIds })} /><Multi label="관련 청구 (신청비용 등은 선택 가능)" items={claimOptions} selected={c.claimIds} onChange={claimIds => edit('costs', c.id, { claimIds })} /><div className="grid gap-4 sm:grid-cols-3"><Field label="청구액·환급 반영 전 금액 (원)" type="money" value={c.claimed} onChange={claimed => edit('costs', c.id, { claimed })} /><Field label="별도 차감할 환급액 (원)" type="money" value={c.refund} onChange={refund => edit('costs', c.id, { refund })} hint="이미 순액을 입력한 경우 0원을 입력합니다." /><Field label="직원 검토 인정액 (원)" type="money" value={c.recognized} onChange={recognized => edit('costs', c.id, { recognized })} /></div><Field label="증빙·기록 문서명과 쪽수" value={c.evidence} onChange={evidence => edit('costs', c.id, { evidence })} /><Field label="인정액 조정 사유·지급자와 귀속자가 다른 사정" multiline value={c.note} onChange={note => edit('costs', c.id, { note })} /></div></details>)}</div>}
        </Panel>
      </>}

      {step === 4 && <>
        <Panel title="비용별 배분 계획" description="비용의 직접 귀속, 소가 비례, 인원 균등을 구별하세요. 여러 단계를 거치는 경우 근거·순서와 분자·분모를 적습니다. 이 화면은 배분액을 자동 확정하지 않습니다.">
          <p className="mb-5 text-sm text-slate-600">입력 인정액 합계 (배분 전): <strong className="text-slate-950">{recognizedTotal.toLocaleString('ko-KR')}원</strong> · 금액 미입력·오류 {draft.costs.filter(c => amount(c.recognized) === null).length}건</p>
          {!draft.costs.length ? <Empty>대리인·비용 단계에서 비용을 먼저 등록하세요.</Empty> : <div className="space-y-4">{draft.costs.map((c, i) => <details key={c.id} className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">{c.title || `비용 ${i + 1}`} <span className="ml-2 font-normal text-slate-500">{c.allocation}</span></summary><div className="mt-5 space-y-4"><Select label="배분 방식" value={c.allocation} options={allocationTypes} onChange={allocation => edit('costs', c.id, { allocation })} /><Multi label="배분에 관련된 당사자" items={partyOptions} selected={c.targetIds} onChange={targetIds => edit('costs', c.id, { targetIds })} /><Field label="배분 근거·단계·분자와 분모" multiline value={c.reason} onChange={reason => edit('costs', c.id, { reason })} /></div></details>)}</div>}
        </Panel>
        <CalculationWorkspace section="plans" draft={draft} onChange={fn => change(fn)} />
        <Panel title="최고·상계·절사 검토" description="본안 상계항변, 비용 법정상계, 절차 밖 변제·합의를 구별합니다. 지급 사실만으로 확정액을 차감하지 않습니다."><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Field label="상대방 최고·교부일" type="date" value={draft.review.highestDate} onChange={highestDate => review({ highestDate })} /><Field label="자료 제출기한" type="date" value={draft.review.responseDeadline} onChange={responseDeadline => review({ responseDeadline })} /><Select label="상대방 자료 제출" value={draft.review.responseState} options={['미확인', '기간 내 제출', '기간 내 미제출', '추가 확인 필요']} onChange={responseState => review({ responseState })} /><Select label="비용 법정상계 검토" value={draft.review.setoff} options={['미검토', '제112조 본문 적용 검토', '제111조 제2항 예외 검토', '개별 검토 필요']} onChange={setoff => review({ setoff })} /><Select label="절사 계획" value={draft.review.rounding} options={['미확정', '방향별 10원 미만 절사 후 상계 (사례 방식)', '원 단위·절사 시점 개별 검토']} onChange={rounding => review({ rounding })} /></div><div className="mt-5"><Field label="미확정 쟁점·판단 근거·검토 메모" multiline value={draft.review.notes} onChange={notes => review({ notes })} /></div></Panel>
        <CalculationWorkspace section="results" draft={draft} onChange={fn => change(fn)} />
        <ReferenceCaseComparison draft={draft} />
        {!draft.referenceCaseId && <Panel title="기준 사례 비교" description="2023.12.15. 첨부 사례의 문서상 상환액입니다. 현재 입력으로 자동 계산한 결과가 아닙니다.">
          {referenceVisible ? <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">입력을 수정하지 않은 기준 사례의 상환액</caption><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">부담자</th><th className="p-3">상환받을 당사자</th><th className="p-3 text-right">문서 기준액</th></tr></thead><tbody>{sampleReference.map(([payer, receiver, n]) => <tr key={payer + receiver} className="border-b border-slate-100"><td className="p-3">{payer}</td><td className="p-3">{receiver}</td><td className="p-3 text-right font-semibold tabular-nums">{money(n)}</td></tr>)}</tbody></table></div><p className="mt-4 text-sm leading-relaxed text-amber-800">방향별 절사 후 상계로 재현한 사례입니다. 총괄표의 1원 차이는 미해결이며 운영 기준으로 확정하지 않았습니다.</p></>
            : <Empty>기준 사례와 다른 입력입니다. 기준 금액을 현재 사건의 결과로 표시하지 않습니다. 비교하려면 검증 사례를 다시 불러오세요.</Empty>}
        </Panel>}
        <Panel title={`입력 확인 사항 ${issues.length}건`} description="입력 확인 사항이 없어도 법률 규칙의 검증·결정문 확정이 완료된 것은 아닙니다. 주문 해석, 보수 산정·배분·절사 규칙은 별도 검토가 필요합니다.">
          {issues.length ? <ul className="max-h-96 space-y-2 overflow-y-auto">{issues.map((issue, i) => <li key={i}><button className="w-full rounded-lg bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-950 hover:bg-amber-100" onClick={() => setStep(issue.step)}><span className="mr-2 font-semibold">{steps[issue.step]}</span>{issue.message}<span className="ml-2 text-amber-700">입력으로 이동 →</span></button></li>)}</ul> : <p className="rounded-lg bg-blue-50 p-4 text-sm text-blue-900">기본 입력 확인을 통과했습니다. 법률상 적정성·전체 관계 및 산식의 검토는 별도로 필요합니다.</p>}
          <p className="mt-5 border-t border-slate-200 pt-4 text-sm leading-relaxed text-slate-500">현재 제공 범위: 입력·초안 저장·직원 인정액의 배분 가계산. 보수 한도 자동 산정과 결정문 확정은 제공하지 않습니다.</p>
        </Panel>
      </>}
    </div>
    <div className="mt-7 flex items-center justify-between gap-3 border-t border-slate-200 pt-5"><button className={`${secondary} disabled:opacity-40`} disabled={step === 0} onClick={() => setStep(s => s - 1)}>이전 단계</button><p className="text-xs text-slate-500">{step + 1} / {steps.length}</p>{step < 4 ? <button className={primary} onClick={() => setStep(s => s + 1)}>다음 단계 →</button> : <button className={primary} onClick={save}>브라우저에 초안 저장</button>}</div>

    {casePickerOpen && <ReferenceCasePicker onClose={() => setCasePickerOpen(false)} onSelect={id => { selectedCaseId.current = id; setCasePickerOpen(false); requestReplace('case'); }} />}
    {replace && <dialog ref={replaceDialog} onCancel={() => setReplace(null)} aria-labelledby="replace-title" className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/50"><h2 id="replace-title" className="text-lg font-bold">현재 입력을 바꾸시겠습니까?</h2><p className="my-4 text-sm leading-relaxed text-slate-600">저장하지 않은 입력은 사라집니다. 기존 브라우저 저장본은 저장 버튼을 누르기 전까지 유지됩니다.</p><div className="flex justify-end gap-2"><button autoFocus className={secondary} onClick={() => setReplace(null)}>취소</button><button className={primary} onClick={() => applyReplace(replace)}>입력 바꾸기</button></div></dialog>}
  </div></MainLayout>;
}
