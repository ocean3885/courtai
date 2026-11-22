'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ordinaryFeeLimit } from './ordinaryFee';

import {
  levels,
  stageLevel,
  isApplicantSideParty,
  type Level,
  type RecordedValue,
  type Group,
  type PartySide,
  type Party,
  type Member,
  type Stage,
  type Cost,
  type CostClaim,
  type ClaimSplit,
} from './caseInput';
import { CostReview } from './CostReview';
import { RelationValueInput } from './RelationValueInput';
import { BurdenOrderSection } from './BurdenOrderSection';
import {
  allocationMemberValue,
  counterEffectiveValue,
  inferredCostClaim,
  needsClaimAllocation,
  opponentAllocationGroups,
  resolveFeeBasisValue,
  sideValueMode,
  stageEffectiveValue,
  stageMemberValue,
} from './costReview';

const roleOptionsByLevel: Record<Level, readonly string[]> = {
  '1심': ['원고', '피고'],
  항소심: ['항소인', '피항소인', '항소인 겸 피항소인'],
  상고심: ['상고인', '피상고인', '상고인 겸 피상고인'],
};
const splitOptions = ['균분', '안분'] as const;
const valueTargetLabels: Record<PartySide, string> = {
  신청인측: '신청인 측',
  피신청인측: '피신청인 측',
};
const initialParties: Party[] = [
  { id: 'a', name: '', group: '신청인' },
  { id: 'b', name: '', group: '피신청인' },
];
const member = (): Member => ({ role: '', number: '', value: '', counterRole: '' });
const stage = (id: string, level: Level = '1심'): Stage => ({
  id,
  level,
  valueMode: '합산',
  applicantValueMode: '합산',
  opponentValueMode: '합산',
  number: '',
  value: '',
  useIndividualValues: false,
  members: {},
  counter: '',
  counterValue: '',
  costs: [],
  rules: level === '1심' ? [
    {
      id: uid(),
      left: ['a'],
      right: ['b'],
      mode: '2측 전부 부담',
      n: '1',
      d: '1',
      scope: level === '1심' ? '1심 비용' : '소송총비용',
      claim: '',
      leftMethod: '균분',
      rightMethod: '균분',
    },
  ] : [],
});
const sortStagesByLevel = (list: Stage[]): Stage[] =>
  [...list].sort(
    (a, b) =>
      levels.indexOf(stageLevel(a, list.indexOf(a))) - levels.indexOf(stageLevel(b, list.indexOf(b)))
  );
const uid = () => crypto.randomUUID();
const button =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
type SavedLitigationCase = {
  id: number;
  title: string;
  court: string;
  case_number: string;
  application_date: string;
  updated_at: string;
};
const input =
  'mt-1 block h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600';
const stageCheckbox =
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold';
const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
const box = 'space-y-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs';
const small = 'text-sm text-slate-600';

const natural = (v: string) => (/^\d{1,16}$/.test(v) ? BigInt(v) : null);
const won = (v: bigint) => v.toLocaleString('ko-KR') + '원';
const normalizeNumericInput = (value: string) => (/^[\d,\s]+$/.test(value) ? value.replace(/[,\s]/g, '') : value);
const formatClaimValue = (value: string) =>
  /^\d{1,16}$/.test(value) ? value.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : value;

function changeClaimValue(element: HTMLInputElement, change: (value: string) => void) {
  const raw = element.value;
  const value = normalizeNumericInput(raw);
  const formatted = formatClaimValue(value);
  if (formatted !== raw) {
    let digitsBeforeCursor = raw.slice(0, element.selectionStart ?? raw.length).replace(/\D/g, '').length;
    let cursor = 0;
    while (digitsBeforeCursor > 0 && cursor < formatted.length) {
      if (formatted[cursor] !== ',') digitsBeforeCursor--;
      cursor++;
    }
    element.value = formatted;
    element.setSelectionRange(cursor, cursor);
  }
  change(value);
}

function Field({
  label,
  value,
  change,
  numeric = false,
  claimValue = false,
  showAmountPreview = false,
}: {
  label: string;
  value: string;
  change?: (v: string) => void;
  numeric?: boolean;
  claimValue?: boolean;
  showAmountPreview?: boolean;
}) {
  const isNumeric = numeric || claimValue;
  const parsed = isNumeric && value !== '' ? natural(value) : null;
  const invalid = !!change && isNumeric && value !== '' && parsed === null;
  return (
    <label className="block text-sm font-medium text-slate-800">
      <span className="flex items-baseline justify-between gap-1">
        <span>{label}</span>
        {showAmountPreview && parsed !== null && parsed > BigInt(0) && (
          <span className="text-xs font-semibold tabular-nums text-blue-700">{won(parsed)}</span>
        )}
      </span>
      <input
        className={claimValue ? `${input} text-right tabular-nums read-only:bg-slate-50` : input}
        value={claimValue ? formatClaimValue(value) : value}
        aria-label={label}
        inputMode={isNumeric ? 'numeric' : 'text'}
        aria-invalid={invalid}
        readOnly={!change}
        onChange={change && ((e) => {
          if (claimValue) {
            changeClaimValue(e.currentTarget, change);
          } else {
            const raw = e.currentTarget.value;
            change(numeric ? normalizeNumericInput(raw) : raw);
          }
        })}
      />
      {invalid && (
        <span className="mt-1 block text-xs text-red-700">
          0 이상의 정수를 입력하세요 (최대 16자리).
        </span>
      )}
    </label>
  );
}
function Pick({
  label,
  value,
  options,
  names,
  change,
}: {
  label: string;
  value: string;
  options: readonly string[];
  names?: Record<string, string>;
  change: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-800">
      {label}
      <select className={input} aria-label={label} value={value} onChange={(e) => change(e.target.value)}>
        <option value="">선택</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {names?.[x] || x}
          </option>
        ))}
      </select>
    </label>
  );
}
function Section({
  id,
  title,
  children,
  open,
}: {
  id: string;
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details
      id={id}
      open={open}
      className="group/section scroll-mt-20 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-lg font-bold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-sm font-medium text-slate-500 group-open/section:text-blue-700">
          <span className="group-open/section:hidden">펼치기 ▼</span>
          <span className="hidden group-open/section:inline">접기 ▲</span>
        </span>
      </summary>
      <div className="mt-3.5 space-y-3.5 border-t border-slate-100 pt-3.5">{children}</div>
    </details>
  );
}
type CheckChoice = {
  id: string;
  label: string;
  side?: PartySide;
  disabled?: boolean;
  title?: string;
};

function Checks({
  title,
  choices,
  selected,
  change,
}: {
  title: string;
  choices: CheckChoice[];
  selected: string[];
  change: (ids: string[]) => void;
}) {
  const renderChip = (p: CheckChoice) => (
    <label
      key={p.id}
      title={p.title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm ${
        p.disabled
          ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 opacity-60'
          : selected.includes(p.id)
            ? 'cursor-pointer border-blue-400 bg-blue-50 font-semibold text-blue-950'
            : 'cursor-pointer border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      }`}
    >
      <input
        type="checkbox"
        className="accent-blue-700"
        disabled={p.disabled}
        checked={selected.includes(p.id)}
        onChange={(e) => {
          if (p.disabled) return;
          change(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id));
        }}
      />{' '}
      {p.label}
    </label>
  );

  const hasSideGrouping = choices.some((c) => c.side !== undefined);
  const applicantChoices = hasSideGrouping ? choices.filter((c) => c.side === '신청인측') : [];
  const opponentChoices = hasSideGrouping ? choices.filter((c) => c.side !== '신청인측') : [];

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-slate-800">{title}</legend>
      {hasSideGrouping && applicantChoices.length > 0 && opponentChoices.length > 0 ? (
        <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
          <div className="rounded-lg border border-blue-200/80 bg-blue-50/35 p-2.5">
            <span className="mb-1.5 block text-xs font-bold text-blue-950">신청인 측</span>
            <div className="flex flex-wrap gap-1.5">{applicantChoices.map(renderChip)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white/80 p-2.5">
            <span className="mb-1.5 block text-xs font-bold text-slate-800">피신청인 측</span>
            <div className="flex flex-wrap gap-1.5">{opponentChoices.map(renderChip)}</div>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">{choices.map(renderChip)}</div>
      )}
    </fieldset>
  );
}

function memberHasEntries(m: Member) {
  return Boolean(m.role || m.number || m.value || m.counterRole || m.counterValue || m.relationValues || m.counterRelationValues);
}

function hasStageData(s: Stage): boolean {
  return !!(
    s.number ||
    s.value ||
    s.counter ||
    s.costs.length ||
    s.rules.length || s.mainValues?.length || s.counterValues?.length ||
    Object.values(s.members).some(memberHasEntries)
  );
}

export default function PartyForm() {
  const [court, setCourt] = useState('');
  const [caseNumber, setCaseNumber] = useState('');
  const [applicationDate, setApplicationDate] = useState('');
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [stages, setStages] = useState<Stage[]>(() => [
    { ...stage('first', '1심'), members: { a: member(), b: member() } },
  ]);
  const [activeStageLevel, setActiveStageLevel] = useState<Level>('1심');
  const [showAllStages, setShowAllStages] = useState(false);
  const [applicationCosts, setApplicationCosts] = useState<Cost[]>([]);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryInputs, setDeliveryInputs] = useState({ incurred: '', decision: '5640', mobile: '' });
  const [notice, setNotice] = useState('');
  const [savedCases, setSavedCases] = useState<SavedLitigationCase[]>([]);
  const [recordId, setRecordId] = useState<number | null>(null);
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingSaved, setIsLoadingSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/litigation-costs')
      .then(async (response) => {
        if (response.ok && active) setSavedCases(await response.json());
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function loadSavedCase(id: string) {
    if (!id) {
      startNewCase();
      return;
    }
    setIsLoadingSaved(true);
    setNotice('');
    try {
      const response = await fetch(`/api/litigation-costs/${id}`);
      const result = await response.json();
      if (response.status === 401) throw new Error('로그인 후 저장 자료를 불러올 수 있습니다.');
      if (!response.ok) throw new Error(result.error || '저장 자료를 불러오지 못했습니다.');
      const data = result.data;
      setCourt(data.court);
      setCaseNumber(data.caseNumber);
      setApplicationDate(data.applicationDate);
      setParties(data.parties);
      setStages(data.stages);
      setApplicationCosts(data.applicationCosts);
      setRecordId(result.id);
      setConfirmDeleteId(null);
      setSavedModalOpen(false);
      setShowAllStages(false);
      setActiveStageLevel(stageLevel(data.stages[0], 0));
      setNotice('저장 자료를 불러왔습니다.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '저장 자료를 불러오지 못했습니다.');
    } finally {
      setIsLoadingSaved(false);
    }
  }

  async function deleteSavedCase(targetId: number) {
    setDeletingId(targetId);
    setNotice('');
    try {
      const response = await fetch(`/api/litigation-costs/${targetId}`, { method: 'DELETE' });
      const result = await response.json();
      if (response.status === 401) throw new Error('로그인 후 삭제할 수 있습니다.');
      if (!response.ok) throw new Error(result.error || '삭제하지 못했습니다.');
      setSavedCases((old) => old.filter((item) => item.id !== targetId));
      setConfirmDeleteId(null);
      if (recordId === targetId) {
        setCourt('');
        setCaseNumber('');
        setApplicationDate('');
        setParties(initialParties.map((party) => ({ ...party })));
        setStages([{ ...stage('first', '1심'), members: { a: member(), b: member() } }]);
        setActiveStageLevel('1심');
        setShowAllStages(false);
        setApplicationCosts([]);
        setRecordId(null);
        setNotice('불러온 저장 자료가 삭제되어 새 입력 화면으로 초기화되었습니다.');
      } else {
        setNotice(result.message || '저장 자료를 삭제했습니다.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  }

  async function saveCurrentCase() {
    setIsSaving(true);
    setNotice('');
    const data = { court, caseNumber, applicationDate, parties, stages, applicationCosts };
    try {
      const response = await fetch(recordId ? `/api/litigation-costs/${recordId}` : '/api/litigation-costs', {
        method: recordId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (response.status === 401) throw new Error('로그인 후 저장할 수 있습니다.');
      if (!response.ok) throw new Error(result.error || '저장하지 못했습니다.');
      setRecordId(result.id);
      setConfirmDeleteId(null);
      setNotice(result.message || '저장되었습니다.');
      const listResponse = await fetch('/api/litigation-costs');
      if (listResponse.ok) setSavedCases(await listResponse.json());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  function startNewCase() {
    setCourt('');
    setCaseNumber('');
    setApplicationDate('');
    setParties(initialParties.map((party) => ({ ...party })));
    setStages([{ ...stage('first', '1심'), members: { a: member(), b: member() } }]);
    setActiveStageLevel('1심');
    setShowAllStages(false);
    setApplicationCosts([]);
    setRecordId(null);
    setConfirmDeleteId(null);
    setNotice('새 자료를 입력합니다.');
  }

  const label = (p: Party) => {
    const bucket = parties.filter(
      (q) => q.group === p.group && (p.group !== '신청외' || isApplicantSideParty(q) === isApplicantSideParty(p))
    );
    const groupText =
      p.group === '신청외' ? (isApplicantSideParty(p) ? '신청인측 신청외' : '피신청인측 신청외') : p.group;
    return [groupText, bucket.findIndex((q) => q.id === p.id) + 1, p.name].filter(Boolean).join(' ');
  };
  const presentLevels = stages.map((s, i) => stageLevel(s, i));
  const currentActiveLevel: Level = presentLevels.includes(activeStageLevel)
    ? activeStageLevel
    : presentLevels[0] || '1심';

  function patchStage(id: string, patch: Partial<Stage>) {
    setStages((old) => old.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function toggleStageLevel(lv: Level, checked: boolean) {
    if (checked) {
      if (presentLevels.includes(lv)) {
        setActiveStageLevel(lv);
        return;
      }
      setNotice('');
      setStages((old) => {
        const defaultMembers = lv === '1심' ? Object.fromEntries(parties.map((p) => [p.id, member()])) : {};
        return sortStagesByLevel([...old, { ...stage(uid(), lv), members: defaultMembers }]);
      });
      setActiveStageLevel(lv);
      return;
    }
    const target = stages.find((s, i) => stageLevel(s, i) === lv);
    if (!target) return;
    if (hasStageData(target)) {
      setNotice(`${lv}에 입력된 사건번호·참여자 지위·비용·부담 관계를 먼저 비운 뒤 심급 선택을 해제하세요.`);
      return;
    }
    setNotice('');
    setStages((old) => old.filter((s) => s.id !== target.id));
  }

  function addParty(group: Group, partySide?: PartySide) {
    const id = uid();
    const resolvedSide: PartySide = partySide ?? (group === '신청인' ? '신청인측' : '피신청인측');
    setNotice('');
    setParties((old) => [...old, { id, group, side: resolvedSide, name: '' }]);
    setStages((old) =>
      old.map((s, i) => (stageLevel(s, i) === '1심' ? { ...s, members: { ...s.members, [id]: member() } } : s))
    );
  }
  function referenced(s: Stage, id: string) {
    return (
      [...(s.mainValues || []), ...(s.counterValues || [])].some(row => row.ids.includes(id)) ||
      s.costs.some((c) => c.payer === id || c.ids.includes(id)) ||
      s.rules.some((r) => [...r.left, ...r.right].includes(id)) ||
      Object.values(s.members).some(m => Object.hasOwn(m.relationValues || {}, id) || Object.hasOwn(m.counterRelationValues || {}, id))
    );
  }
  function dropParty(p: Party) {
    if (
      stages.some((s) => referenced(s, p.id) || (s.members[p.id] && memberHasEntries(s.members[p.id]))) ||
      applicationCosts.some((c) => c.payer === p.id || c.ids.includes(p.id) || c.application?.opponentIds.includes(p.id))
    ) {
      setNotice('이 당사자의 심급 정보 또는 연결된 관계별 소가·비용·부담 관계를 먼저 정리하세요.');
      return;
    }
    setNotice('');
    setParties((old) => old.filter((q) => q.id !== p.id));
    setStages((old) =>
      old.map((s) => ({
        ...s,
        members: Object.fromEntries(Object.entries(s.members).filter(([id]) => id !== p.id)),
      }))
    );
  }

  function isApplicantCost(c: Cost): boolean {
    if (c.side) return c.side === '신청인측';
    const firstOwner = (c.shared ? c.ids[0] : c.payer) || c.payer;
    const ownerParty = parties.find((p) => p.id === firstOwner);
    return !ownerParty || isApplicantSideParty(ownerParty);
  }

  function createSideStageCost(s: Stage, sideGroup: 'applicant' | 'opponent', kind: string): Cost {
    const sidePeople = parties.filter(
      (p) =>
        s.members[p.id] && (sideGroup === 'applicant' ? isApplicantSideParty(p) : !isApplicantSideParty(p))
    );
    const assignedFeeIds = new Set(s.costs.filter(c => c.kind === '변호사보수').flatMap(c => c.shared ? c.ids : [c.payer]));
    const available = sidePeople.filter(p => kind !== '변호사보수' || !assignedFeeIds.has(p.id));
    const target = available.length === 1 ? available[0].id : '';
    return {
      id: uid(),
      side: sideGroup === 'applicant' ? '신청인측' : '피신청인측',
      payer: target,
      kind,
      paid: '',
      refund: '0',
      shared: false,
      ids: target ? [target] : [],
      method: '',
      evidence: '',
      title: '',
    };
  }

  function createApplicationCost(
    kind: string,
    deliveryDetail?: { incurred?: string; decision?: string; mobile?: string },
    paidAmount?: string
  ): Cost {
    const applicantIds = parties.filter(p => p.group === '신청인').map((p) => p.id);
    const opponentIds = parties.filter(p => p.group === '피신청인').map(p => p.id);
    const firstId = applicantIds[0] || '';
    return {
      id: uid(),
      application: { opponentIds },
      payer: firstId,
      kind,
      deliveryDetail,
      paid: paidAmount !== undefined ? paidAmount : '',
      refund: '0',
      shared: applicantIds.length > 1,
      ids: applicantIds,
      method: '균분',
      evidence: '',
      title: '',
    };
  }

  function formatPartyTargetsShort(ids: string[]): string {
    const selectedParties = parties.filter((p) => ids.includes(p.id));
    if (selectedParties.length === 0) return '';
    const grouped = new Map<string, number[]>();
    for (const p of selectedParties) {
      const bucket = parties.filter(
        (q) => q.group === p.group && (p.group !== '신청외' || isApplicantSideParty(q) === isApplicantSideParty(p))
      );
      const groupText =
        p.group === '신청외' ? (isApplicantSideParty(p) ? '신청인측 신청외' : '피신청인측 신청외') : p.group;
      const idx = bucket.findIndex((q) => q.id === p.id) + 1;
      grouped.set(groupText, [...(grouped.get(groupText) || []), idx]);
    }
    return Array.from(grouped.entries())
      .map(([g, nums]) => `${g} ${nums.join(',')}`)
      .join(' · ');
  }

  function isApplicantBundle(row: RecordedValue): boolean {
    if (row.side) return row.side === '신청인측';
    const firstParty = parties.find((p) => row.ids.includes(p.id));
    return firstParty ? isApplicantSideParty(firstParty) : true;
  }

  function renderSidePartySection(s: Stage, sLevel: Level, sidePeople: Party[], isAppSide: boolean) {
    const sideTitle = isAppSide ? '신청인 측 당사자' : '피신청인 측 당사자';
    const hasMainValue = !s.counter
      ? Boolean(s.mainValueTarget) || sLevel !== '1심'
      : s.mainValueTarget
        ? (s.mainValueTarget === '신청인측') === isAppSide
        : sLevel !== '1심';
    const hasCounterValue = Boolean(s.counter && s.mainValueTarget && !hasMainValue);
    const hasClaimValue = hasMainValue || hasCounterValue;
    const claimName = hasCounterValue ? '반소 소가' : '소가';
    const currentMode = sideValueMode(s, isAppSide, hasCounterValue);
    const bundleKey = hasCounterValue ? 'counterValues' : 'mainValues';
    const allBundles = s[bundleKey] || [];
    const sideBundles = hasClaimValue ? allBundles.filter((row) => isApplicantBundle(row) === isAppSide) : [];
    const individualValuesEnabled = hasClaimValue && (hasCounterValue ? s.useCounterIndividualValues === true : s.useIndividualValues !== false);
    const columnLayout = s.counter
      ? hasClaimValue
        ? 'min-w-[470px] grid-cols-[minmax(80px,1fr)_86px_50px_84px_minmax(120px,1.3fr)]'
        : 'min-w-[350px] grid-cols-[minmax(80px,1fr)_86px_50px_84px]'
      : hasClaimValue
        ? 'min-w-[400px] grid-cols-[minmax(88px,1.1fr)_94px_56px_minmax(130px,1.5fr)]'
        : 'grid-cols-[minmax(88px,1fr)_94px_56px]';
    const compactControl =
      'block w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600';

    function addCommonBundle() {
      patchStage(s.id, {
        [bundleKey]: [...allBundles, { id: uid(), side: isAppSide ? '신청인측' : '피신청인측', ids: [], amount: '' }],
      });
    }

    function patchBundle(bundleId: string, patch: Partial<RecordedValue>) {
      patchStage(s.id, { [bundleKey]: allBundles.map((r) => (r.id === bundleId ? { ...r, ...patch } : r)) });
    }

    function removeBundle(bundleId: string) {
      patchStage(s.id, { [bundleKey]: allBundles.filter((r) => r.id !== bundleId) });
    }

    const changeMember = (partyId: string, patch: Partial<Member>) =>
      patchStage(s.id, {
        members: { ...s.members, [partyId]: { ...s.members[partyId], ...patch } },
      });

    return (
      <div className="min-w-0 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-sm font-bold ${isAppSide ? 'text-blue-950' : 'text-slate-900'}`}>
            {sideTitle} ({sidePeople.length}명)
          </span>
          {individualValuesEnabled && sidePeople.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1">
                {(['합산', '흡수'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() =>
                      patchStage(
                        s.id,
                        hasCounterValue ? { counterValueMode: m } : isAppSide ? { applicantValueMode: m } : { opponentValueMode: m }
                      )
                    }
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                      currentMode === m
                        ? isAppSide
                          ? 'border-blue-600 bg-blue-700 text-white'
                          : 'border-slate-800 bg-slate-900 text-white'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m === '합산' ? '합산' : '다액흡수'}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={addCommonBundle}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                {hasCounterValue ? '+ 반소 공통소가 묶기' : '+ 공통소가 묶기'}
              </button>
            </div>
          )}
        </div>

        {sidePeople.length === 0 ? (
          <p className={small}>참여 중인 {isAppSide ? '신청인' : '피신청인'}이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
            {/* 컴팩트 1줄 표 헤더 */}
            <div
              className={`grid items-center gap-2 border-b border-slate-100 px-1 pb-1.5 text-xs font-semibold text-slate-500 ${columnLayout}`}
            >
              <span>당사자</span>
              <span>지위</span>
              <span>번호</span>
              {s.counter && <span>반소 지위</span>}
              {hasClaimValue && <span>{claimName} (원)</span>}
            </div>

            {/* 당사자 1인 1줄 행 */}
            <div className="divide-y divide-slate-100">
              {sidePeople.map((p) => {
                const m = s.members[p.id];
                const bundle = sideBundles.find((row) => row.ids.includes(p.id));
                const bundleShort = bundle ? formatPartyTargetsShort(bundle.ids) : '';
                const bundleValue = bundle ? stageMemberValue(s, p.id, hasCounterValue) : null;
                const value = hasCounterValue ? m.counterValue || '' : m.value;
                return (
                  <div
                    key={p.id}
                    className={`grid items-center gap-2 py-1.5 ${columnLayout}`}
                  >
                    <span className="truncate px-1 text-sm font-bold text-slate-900" title={label(p)}>
                      {label(p)}
                    </span>
                    <select
                      aria-label={label(p) + ' 지위'}
                      className={compactControl}
                      value={m.role}
                      onChange={(e) => changeMember(p.id, { role: e.target.value })}
                    >
                      <option value="">선택</option>
                      {roleOptionsByLevel[sLevel].map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={label(p) + ' 번호'}
                      inputMode="numeric"
                      placeholder="번호"
                      className={compactControl}
                      value={m.number}
                      onChange={(e) => {
                        const raw = e.target.value;
                        changeMember(p.id, {
                          number: /^[\d,\s]+$/.test(raw) ? raw.replace(/[,\s]/g, '') : raw,
                        });
                      }}
                    />
                    {s.counter && (
                      <select
                        aria-label={label(p) + ' 반소 지위'}
                        className={compactControl}
                        value={m.counterRole}
                        onChange={(e) => changeMember(p.id, { counterRole: e.target.value })}
                      >
                        <option value="">선택</option>
                        {['반소원고', '반소피고'].map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    )}
                    {bundle ? (
                      <div
                        title={`${bundleShort} 공통 소가로 묶여 있습니다.`}
                        className={`flex items-center justify-between gap-1 rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                          isAppSide
                            ? 'border-blue-200 bg-blue-50/70 text-blue-950'
                            : 'border-slate-300 bg-slate-100 text-slate-800'
                        }`}
                      >
                        <span className="truncate">{bundleShort} 공통</span>
                        <span className="shrink-0 tabular-nums text-blue-700">
                          {bundleValue !== null ? won(bundleValue) : '아래 입력'}
                        </span>
                      </div>
                    ) : hasClaimValue && (
                      <div>
                        <input
                          aria-label={label(p) + ` ${claimName} (원)`}
                          inputMode="numeric"
                          placeholder="개별 소가 입력"
                          disabled={!individualValuesEnabled}
                          aria-invalid={individualValuesEnabled && value !== '' && natural(value) === null}
                          className={`${compactControl} text-right tabular-nums disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
                          value={formatClaimValue(value)}
                          onChange={(e) => changeClaimValue(e.currentTarget, (amount) =>
                            changeMember(p.id, hasCounterValue ? { counterValue: amount } : { value: amount })
                          )}
                        />
                        <RelationValueInput stage={s} party={p} parties={parties} counter={hasCounterValue}
                          enabled={individualValuesEnabled} label={label} change={patch => changeMember(p.id, patch)} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 공통소가 묶음 목록 (`+ 공통소가 묶기` 클릭 시 추가됨) */}
        {sideBundles.map((row, idx) => {
          const otherBundledIds = new Set(
            sideBundles.filter((other) => other.id !== row.id).flatMap((other) => other.ids)
          );
          const targetShort = formatPartyTargetsShort(row.ids);
          const amountLabel = [targetShort, hasCounterValue ? '반소 공통 소가 (원)' : '공통 소가 (원)'].filter(Boolean).join(' ');
          return (
            <div
              key={row.id}
              className={`space-y-2 rounded-lg border bg-white p-2.5 shadow-2xs ${
                isAppSide ? 'border-blue-200' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="mr-0.5 text-xs font-bold text-slate-700">
                    {hasCounterValue ? '반소 공통소가 묶음' : '공통소가 묶음'} {idx + 1}:
                  </span>
                  {sidePeople.map((p) => {
                    const selected = row.ids.includes(p.id);
                    const disabled = otherBundledIds.has(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        title={disabled ? '이미 다른 공통소가 묶음에 포함된 당사자입니다.' : undefined}
                        onClick={() => {
                          if (disabled) return;
                          const nextIds = selected
                            ? row.ids.filter((id) => id !== p.id)
                            : [...row.ids, p.id];
                          patchBundle(row.id, { ids: nextIds });
                        }}
                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? isAppSide
                              ? 'border-blue-600 bg-blue-700 font-semibold text-white'
                              : 'border-slate-800 bg-slate-900 font-semibold text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
                        }`}
                      >
                        {selected ? '✓ ' : ''}
                        {label(p)}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => removeBundle(row.id)}
                  className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  묶음 해제
                </button>
              </div>
              <Field
                claimValue
                label={amountLabel}
                value={row.amount}
                change={(amount) => patchBundle(row.id, { amount })}
              />
            </div>
          );
        })}
      </div>
    );
  }

  function costEditor(c: Cost, update: (patch: Partial<Cost>) => void, remove: () => void, s?: Stage) {
    const paid = natural(c.paid),
      refund = natural(c.refund);
    const net = paid !== null && refund !== null && paid >= refund ? paid - refund : null;
    const costIsApplicant = isApplicantCost(c);
    const eligible = s
      ? parties.filter(
          (p) => s.members[p.id] && (costIsApplicant ? isApplicantSideParty(p) : !isApplicantSideParty(p))
        )
      : parties.filter(p => p.group === '신청인');
    const owners = s ? (c.shared ? c.ids : [c.payer]).filter(Boolean) : eligible.map(p => p.id);
    const normalizedMethod = c.method === '소가 비율' ? '안분' : c.method;
    const weights = owners.map((id) => {
      if (normalizedMethod === '균분') return BigInt(1);
      const party = parties.find((p) => p.id === id);
      return s && party ? allocationMemberValue(s, party) : null;
    });
    const sum = weights.reduce<bigint>((total, w) => total + (w ?? BigInt(0)), BigInt(0));
    const feeBasis = s && c.kind === '변호사보수' ? resolveFeeBasisValue(c, s, parties) : null;
    const feeLimit = feeBasis !== null ? ordinaryFeeLimit(feeBasis) : null;
    const separateClaims = Boolean(s?.counter && needsClaimAllocation(stages, stages.findIndex(v => v.id === s.id), owners));
    const costClaim = s ? inferredCostClaim(c, s, parties) : undefined;
    const showClaim = Boolean(s?.counter && (c.kind === '변호사보수' || separateClaims || c.claim || c.claimSplit || c.mainRuleId || c.counterRuleId));
    const candidateRules =
      s?.rules.filter(
        (r) => owners.length && owners.every((id) => r.left.includes(id) || r.right.includes(id)) &&
          (!separateClaims || costClaim === '공통' || r.claim === costClaim || r.claim === '본소와 반소')
      ) || [];
    const opponentGroups = s ? opponentAllocationGroups(c, stages, stages.findIndex(v => v.id === s.id), parties) : [];
    const showOpponentAllocation = Boolean(c.opponentMethod || opponentGroups.some(g => g.ids.length > 1 && (g.multipleRules || g.laterOrder || s?.members[g.owner]?.relationValues || s?.members[g.owner]?.counterRelationValues)));
    const automaticMethods = new Set(opponentGroups.map(g => g.method));
    const automaticOpponentMethod = automaticMethods.size === 1 ? opponentGroups[0]?.method || '' : '';
    const allowsRefund =
      c.kind !== '변호사보수' &&
      (c.kind.endsWith('송달료') || c.kind === '인지대' || c.kind === '기타 비용' || c.refund !== '0');

    const otherFeeTakenIds = new Set(
      s && c.kind === '변호사보수'
        ? s.costs
            .filter((other) => other.id !== c.id && other.kind === '변호사보수')
            .flatMap((other) => (other.shared ? other.ids : [other.payer]).filter(Boolean))
        : []
    );

    const targetCounts = (['신청인', '피신청인', '신청외'] as const).map(group => {
      const count = eligible.filter(p => p.group === group && owners.includes(p.id)).length;
      return count ? group + ' ' + count + '명' : '';
    }).filter(Boolean).join(' + ');

    function setCostOwners(nextIds: string[]) {
      const ids = nextIds.filter(id => !otherFeeTakenIds.has(id));
      update({
        payer: ids[0] || '', shared: ids.length > 1, ids,
        method: ids.length > 1 ? c.method : '',
      });
    }

    function toggleOwnerParty(partyId: string) {
      if (otherFeeTakenIds.has(partyId)) return;
      if (owners.includes(partyId)) {
        if (eligible.length === 1) return;
        setCostOwners(owners.filter((id) => id !== partyId));
      } else {
        setCostOwners([...owners, partyId]);
      }
    }

    return (
      <div key={c.id} className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm font-bold text-slate-900">{c.kind}</strong>
            {eligible.length === 1 && owners.length === 1 && (
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {s ? '부담대상' : '비용 귀속자'} · {label(eligible[0])}
              </span>
            )}
            {c.paid !== '' && (
              <span className={small}>
                {net === null ? (
                  <span className="font-medium text-amber-800">금액 확인</span>
                ) : (
                  <span>
                    {c.kind === '변호사보수' ? '입력 보수' : '실지출'} <strong className="font-semibold text-slate-900">{won(net)}</strong>
                  </span>
                )}
              </span>
            )}
            {feeLimit !== null && feeBasis !== null && net !== null && (
              <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-900">
                소가 {won(feeBasis)} 기준 한도 {won(feeLimit)} → 산입 {won(feeLimit < net ? feeLimit : net)}
              </span>
            )}
          </div>
          <button className={button} onClick={remove}>
            삭제
          </button>
        </div>

        {/* 해당 측 당사자가 2인 이상일 때만 당사자 선택 칩 & 기준 : [균분] [안분] 노출 */}
        {s && (eligible.length > 1 || owners.length === 0) && (
          <div className="rounded-md bg-slate-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-slate-600">{s ? '부담대상' : '비용 귀속자'}</span>
                {eligible.map((p) => {
                  const selected = owners.includes(p.id);
                  const disabled = otherFeeTakenIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      title={disabled ? '같은 심급의 다른 변호사보수 항목에 이미 선택된 당사자입니다.' : undefined}
                      onClick={() => toggleOwnerParty(p.id)}
                      className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                        selected
                          ? costIsApplicant
                            ? 'border-blue-600 bg-blue-700 font-semibold text-white'
                            : 'border-slate-800 bg-slate-900 font-semibold text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40'
                      }`}
                    >
                      {selected ? '✓ ' : ''}
                      {label(p)}
                    </button>
                  );
                })}
                {s && (
                  <button
                    type="button"
                    onClick={() => setCostOwners(eligible.map((p) => p.id))}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    전원 선택
                  </button>
                )}
              </div>

              {s && owners.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">기준 :</span>
                  {splitOptions.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      aria-pressed={normalizedMethod === opt}
                      onClick={() => update({ method: opt })}
                      className={`rounded border px-2.5 py-1 text-sm font-medium ${
                        normalizedMethod === opt
                          ? 'border-blue-500 bg-blue-100 text-blue-950'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt === '균분' ? '균분(1/n)' : '소가 비율 안분'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {s && owners.length > 1 && <p className="mt-2 text-sm font-semibold">{targetCounts}, 총 {owners.length}명{normalizedMethod === '균분' ? '에게 균분' : normalizedMethod === '안분' ? '에게 소가 비율 안분' : ' 선택'}</p>}
            {s && owners.length > 1 && normalizedMethod === '안분' && (
              <p className="mt-2 text-xs text-slate-600">
                {owners.map((id,i) => {
                  const m = s.members[id];
                  const who = [m?.role, m?.number, label(parties.find(p=>p.id===id)!)].filter(Boolean).join(' ');
                  return who + ' · ' + (weights[i] === null ? '기준 확인 필요' : won(weights[i]!));
                }).join(' / ')}
                {weights.some((w) => w === null) &&
                  ' · 안분 대상의 공통소가를 입력하거나 해당 청구의 개별소가 항목을 체크하세요.'}
                {weights.every(w=>w !== null) && !sum && ' · 기준 소가 합계 확인 필요'}
              </p>
            )}
          </div>
        )}

        {/* 송달료 세부 구성 (기발생 + 결정정본 + 모바일단문) */}
        {!s && (c.kind.includes('송달료') || !!c.deliveryDetail) && (
          <div className="rounded-md border border-blue-100 bg-blue-50/40 p-3 space-y-2">
            <span className="text-xs font-bold text-blue-950 block">송달료 세부 항목 (기발생 + 결정정본 + 모바일단문)</span>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field
                numeric
                showAmountPreview
                label="기발생 송달료 (원)"
                value={c.deliveryDetail?.incurred || ''}
                change={(v) => {
                  const detail = {
                    incurred: v,
                    decision: c.deliveryDetail?.decision ?? '5640',
                    mobile: c.deliveryDetail?.mobile || '',
                  };
                  const total = BigInt(detail.incurred || '0') + BigInt(detail.decision || '0') + BigInt(detail.mobile || '0');
                  update({ deliveryDetail: detail, paid: total > 0n ? total.toString() : '' });
                }}
              />
              <Field
                numeric
                showAmountPreview
                label="결정정본 송달료 (원)"
                value={c.deliveryDetail?.decision ?? '5640'}
                change={(v) => {
                  const detail = {
                    incurred: c.deliveryDetail?.incurred || '',
                    decision: v,
                    mobile: c.deliveryDetail?.mobile || '',
                  };
                  const total = BigInt(detail.incurred || '0') + BigInt(detail.decision || '0') + BigInt(detail.mobile || '0');
                  update({ deliveryDetail: detail, paid: total > 0n ? total.toString() : '' });
                }}
              />
              <Field
                numeric
                showAmountPreview
                label="모바일단문 (원)"
                value={c.deliveryDetail?.mobile || ''}
                change={(v) => {
                  const detail = {
                    incurred: c.deliveryDetail?.incurred || '',
                    decision: c.deliveryDetail?.decision ?? '5640',
                    mobile: v,
                  };
                  const total = BigInt(detail.incurred || '0') + BigInt(detail.decision || '0') + BigInt(detail.mobile || '0');
                  update({ deliveryDetail: detail, paid: total > 0n ? total.toString() : '' });
                }}
              />
            </div>
            <p className="text-[11px] text-slate-500">세부 금액 입력 시 아래 납부액(합계)이 자동으로 계산됩니다.</p>
          </div>
        )}

        <div
          className={
            c.kind === '변호사보수'
              ? 'grid gap-2.5'
              : c.kind === '기타 비용'
                ? 'grid gap-2.5 sm:grid-cols-3'
                : 'grid gap-2.5 sm:grid-cols-2'
          }
        >
          {c.kind === '기타 비용' && (
            <Field label="비용명" value={c.title} change={(title) => update({ title })} />
          )}
          <Field
            numeric
            showAmountPreview
            label={c.kind === '변호사보수' ? '변호사보수액 (원)' : '납부액 (원)'}
            value={c.paid}
            change={(paid) => update({ paid })}
          />
          {allowsRefund && (
            <Field
              numeric
              showAmountPreview
              label="환급액 (원)"
              value={c.refund}
              change={(refund) => update({ refund })}
            />
          )}
        </div>

        {showClaim && (
          <div className="space-y-2 rounded-md border border-blue-100 bg-blue-50/40 p-3">
            <Pick
              label={c.kind === '변호사보수' ? '보수 대리 범위' : '비용 발생 범위'}
              value={costClaim || ''}
              options={['본소', '반소', '공통']}
              names={{ 공통: '본소·반소 공통' }}
              change={(value) => update({
                claim: (value || undefined) as CostClaim | undefined,
                claimSplit: undefined,
                ruleId: undefined, mainRuleId: undefined, counterRuleId: undefined,
              })}
            />
            {c.kind === '인지대' && !c.claim && costClaim && (
              <p className="text-xs text-slate-600">제기한 측의 지위·소가 대상에 따라 {costClaim} 비용으로 연결했습니다. 다른 청구의 비용이면 변경하세요.</p>
            )}
            {!separateClaims && (c.claimSplit || c.mainRuleId || c.counterRuleId) && (
              <button type="button" className={button} onClick={() => update({ claimSplit: undefined, mainRuleId: undefined, counterRuleId: undefined })}>청구별 배분 설정 해제</button>
            )}
            {separateClaims && costClaim === '공통' && (
              <>
                <Pick
                  label="공통비용의 본소·반소 배분 기준"
                  value={c.claimSplit || (c.kind === '변호사보수' ? '소가 비율' : '균분')}
                  options={['소가 비율', '균분']}
                  change={(value) => update({ claimSplit: (value || undefined) as ClaimSplit | undefined })}
                />
                <p className="text-xs text-slate-600">본소·반소별 부담 주문을 적용하기 위한 구분입니다. 당사자 사이의 균분·안분과는 별도로 계산합니다.</p>
                {c.ruleId && <button type="button" className={button} onClick={() => update({ ruleId: undefined })}>기존 전액 부담 관계 해제</button>}
                {(['본소', '반소'] as const).map(claim => {
                  const key = claim === '본소' ? 'mainRuleId' : 'counterRuleId';
                  const candidates = candidateRules.filter(r => r.claim === claim || r.claim === '본소와 반소');
                  if (candidates.length <= 1 && !c[key]) return null;
                  return (
                    <label key={claim} className="block text-sm font-medium text-slate-800">
                      {claim} 부분의 부담 관계
                      <select className={input} value={c[key] || ''} onChange={e => update({ [key]: e.target.value || undefined, ruleId: undefined })}>
                        <option value="">해당 청구의 상대방별로 자동 적용</option>
                        {candidates.map(r => <option key={r.id} value={r.id}>관계 {s!.rules.indexOf(r) + 1}만 적용 · {r.right.concat(r.left).map(id => label(parties.find(p => p.id === id)!)).join(', ')}</option>)}
                      </select>
                    </label>
                  );
                })}
              </>
            )}
          </div>
        )}

        {s && !(separateClaims && costClaim === '공통') && (candidateRules.length > 1 || c.ruleId) && (
          <label className="block text-sm font-medium text-slate-800">
            비용의 부담 관계 적용
            <select
              className={input}
              value={c.ruleId || ''}
              onChange={(e) => update({ ruleId: e.target.value })}
            >
              <option value="">해당 상대방별로 자동 적용</option>
              {candidateRules.map((r) => (
                <option key={r.id} value={r.id}>
                  관계 {s.rules.indexOf(r) + 1}만 적용 ·{' '}
                  {r.left.map((id) => label(parties.find((p) => p.id === id)!)).join(', ')} /{' '}
                  {r.right.map((id) => label(parties.find((p) => p.id === id)!)).join(', ')}
                </option>
              ))}
            </select>
          </label>
        )}
        {s && showOpponentAllocation && (
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <Pick
              label="상대방 전체 비용 배분 기준"
              value={c.opponentMethod || automaticOpponentMethod}
              options={['균분', '안분']}
              names={{ 균분: '균분 — 전체 상대방 수 기준', 안분: '안분 — 관계별 소가 또는 상대방 소가 비율' }}
              change={value => update({ opponentMethod: (value || undefined) as Cost['opponentMethod'] })}
            />
            {opponentGroups.map((g, i) => (
              <p key={i} className="text-xs text-slate-700">
                {label(parties.find(p => p.id === g.owner)!)}의 {g.claim ? g.claim + ' ' : ''}비용 →{' '}
                {g.ids.map(id => label(parties.find(p => p.id === id)!)).join(', ')} · 전체 {g.ids.length}명
              </p>
            ))}
            <p className="text-xs text-slate-600">전체 상대방에게 비용을 먼저 배분한 뒤 각자의 부담비율을 적용합니다. 상소에 참여하지 않은 상대방의 몫도 원래 심급의 분모에 유지합니다.</p>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3.5">
      {/* 상단 고정 네비게이션 바 */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-xs backdrop-blur">
        <nav aria-label="사건 입력 목차" className="flex flex-wrap gap-2">
          <a
            href="#cost-parties"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
            onClick={() => {
              const target = document.getElementById('cost-parties');
              if (target instanceof HTMLDetailsElement) target.open = true;
            }}
          >
            사건·당사자
          </a>
          {stages.map((s, i) => {
            const lv = stageLevel(s, i);
            return (
              <a
                key={s.id}
                href={'#cost-stage-' + s.id}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                  !showAllStages && currentActiveLevel === lv
                    ? 'border-blue-400 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
                onClick={() => {
                  setActiveStageLevel(lv);
                  requestAnimationFrame(() => {
                    const target = document.getElementById('cost-stage-' + s.id);
                    if (target instanceof HTMLDetailsElement) target.open = true;
                  });
                }}
              >
                {lv}
              </a>
            );
          })}
          {[
            ['cost-application', '신청 비용'],
            ['cost-review', '검산'],
          ].map(([id, title]) => (
            <a
              key={id}
              href={'#' + id}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              onClick={() => {
                const target = document.getElementById(id);
                if (target instanceof HTMLDetailsElement) target.open = true;
              }}
            >
              {title}
            </a>
          ))}
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={button}
            onClick={() => {
              setSavedSearchQuery('');
              setConfirmDeleteId(null);
              setSavedModalOpen(true);
            }}
          >
            저장 자료 불러오기{savedCases.length > 0 ? ` (${savedCases.length})` : ''}
          </button>
          <button type="button" className={button} onClick={startNewCase}>새 자료</button>
          <button type="button" className={button} disabled={isSaving} onClick={() => void saveCurrentCase()}>
            {isSaving ? '저장 중...' : recordId ? '수정 저장' : '저장'}
          </button>
          {recordId !== null && (
            confirmDeleteId === recordId && !savedModalOpen ? (
              <div className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1">
                <span className="text-xs font-semibold text-red-900">삭제할까요?</span>
                <button
                  type="button"
                  disabled={deletingId === recordId}
                  onClick={() => void deleteSavedCase(recordId)}
                  className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  {deletingId === recordId ? '삭제 중...' : '삭제 확인'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDeleteId(recordId)}
                className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50"
              >
                삭제
              </button>
            )
          )}
        </div>
      </div>

      {/* 저장 자료 불러오기 & 삭제 모달 */}
      {savedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSavedModalOpen(false);
              setConfirmDeleteId(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="저장 자료 불러오기"
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">저장 자료 불러오기</h3>
                <p className="text-xs text-slate-500">사건번호·법원명으로 검색해 불러오거나 불필요한 자료를 삭제할 수 있습니다.</p>
              </div>
              <button
                type="button"
                aria-label="저장 자료 모달 닫기"
                onClick={() => {
                  setSavedModalOpen(false);
                  setConfirmDeleteId(null);
                }}
                className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <input
                type="search"
                aria-label="저장 자료 검색"
                placeholder="사건번호, 법원명, 제목으로 검색..."
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                className="block h-10 w-full rounded-lg border border-slate-300 bg-white px-3.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {(() => {
                const q = savedSearchQuery.trim().toLowerCase();
                const filtered = q
                  ? savedCases.filter((item) =>
                      [item.title, item.case_number, item.court, item.application_date]
                        .filter(Boolean)
                        .some((v) => v.toLowerCase().includes(q))
                    )
                  : savedCases;

                if (savedCases.length === 0) {
                  return (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                      저장된 소송비용액확정 자료가 없습니다.
                    </p>
                  );
                }
                if (filtered.length === 0) {
                  return (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-600">
                      &lsquo;{savedSearchQuery}&rsquo; 검색 결과가 없습니다.
                    </p>
                  );
                }

                return (
                  <div className="space-y-2">
                    {filtered.map((item) => {
                      const isCurrent = recordId === item.id;
                      const isConfirming = confirmDeleteId === item.id;
                      const updatedText = item.updated_at
                        ? new Date(item.updated_at).toLocaleDateString('ko-KR')
                        : '';
                      const subInfo = [
                        item.court,
                        item.application_date ? `신청일 ${item.application_date}` : '',
                        updatedText ? `수정 ${updatedText}` : '',
                      ]
                        .filter(Boolean)
                        .join(' · ');

                      return (
                        <div
                          key={item.id}
                          className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3.5 transition-colors ${
                            isCurrent
                              ? 'border-blue-300 bg-blue-50/40'
                              : 'border-slate-200 bg-white hover:bg-slate-50/80'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <strong className="truncate text-sm font-bold text-slate-900">
                                {item.case_number || item.title || '소송비용액확정'}
                              </strong>
                              {item.case_number && item.title && item.title !== item.case_number && (
                                <span className="truncate text-xs text-slate-600">{item.title}</span>
                              )}
                              {isCurrent && (
                                <span className="rounded bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-900">
                                  현재 열림
                                </span>
                              )}
                            </div>
                            {subInfo && <p className="mt-0.5 text-xs text-slate-500">{subInfo}</p>}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {isConfirming ? (
                              <>
                                <button
                                  type="button"
                                  disabled={deletingId === item.id}
                                  onClick={() => void deleteSavedCase(item.id)}
                                  className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
                                >
                                  {deletingId === item.id ? '삭제 중...' : '삭제 확인'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  취소
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  disabled={isLoadingSaved}
                                  onClick={() => void loadSavedCase(String(item.id))}
                                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 disabled:opacity-40"
                                >
                                  불러오기
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id)}
                                  className="rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                                >
                                  삭제
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs text-slate-500">
              <span>총 {savedCases.length}건 저장됨</span>
              <button
                type="button"
                onClick={() => {
                  setSavedModalOpen(false);
                  setConfirmDeleteId(null);
                }}
                className={button}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1. 사건·당사자 (좌측: 신청인 / 우측: 피신청인 분리) */}
      <Section id="cost-parties" title="사건·당사자" open>
        <div className={grid}>
          <Field label="신청 법원" value={court} change={setCourt} />
          <Field label="신청사건번호" value={caseNumber} change={setCaseNumber} />
          <label className="block text-sm font-medium text-slate-800">
            신청일
            <input
              className={input}
              type="date"
              value={applicationDate}
              onChange={(e) => setApplicationDate(e.target.value)}
            />
          </label>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-3.5 md:grid-cols-2">
          {/* 좌측: 신청인 (및 신청인측 신청외) */}
          <div className="min-w-0 space-y-2.5 rounded-lg border border-blue-200 bg-blue-50/30 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-blue-950">신청인 측</span>
              <div className="flex flex-wrap gap-1.5">
                <button className={button} onClick={() => addParty('신청인', '신청인측')}>
                  + 신청인 추가
                </button>
                <button className={button} onClick={() => addParty('신청외', '신청인측')}>
                  + 신청외 추가
                </button>
              </div>
            </div>
            {parties
              .filter((p) => isApplicantSideParty(p))
              .map((p) => (
                <div className="flex items-end gap-2" key={p.id}>
                  <div className="min-w-0 flex-1">
                    <Field
                      label={label({ ...p, name: '' }) + ' 이름'}
                      value={p.name}
                      change={(name) =>
                        setParties((old) => old.map((q) => (q.id === p.id ? { ...q, name } : q)))
                      }
                    />
                  </div>
                  {(p.group === '신청외' || parties.filter((q) => q.group === '신청인').length > 1) && (
                    <button className={button} aria-label={label(p) + ' 삭제'} onClick={() => dropParty(p)}>
                      삭제
                    </button>
                  )}
                </div>
              ))}
          </div>

          {/* 우측: 피신청인 (및 피신청인측 신청외) */}
          <div className="min-w-0 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">피신청인 측</span>
              <div className="flex flex-wrap gap-1.5">
                <button className={button} onClick={() => addParty('피신청인', '피신청인측')}>
                  + 피신청인 추가
                </button>
                <button className={button} onClick={() => addParty('신청외', '피신청인측')}>
                  + 신청외 추가
                </button>
              </div>
            </div>
            {parties
              .filter((p) => !isApplicantSideParty(p))
              .map((p) => (
                <div className="flex items-end gap-2" key={p.id}>
                  <div className="min-w-0 flex-1">
                    <Field
                      label={label({ ...p, name: '' }) + ' 이름'}
                      value={p.name}
                      change={(name) =>
                        setParties((old) => old.map((q) => (q.id === p.id ? { ...q, name } : q)))
                      }
                    />
                  </div>
                  {(p.group === '신청외' || parties.filter((q) => q.group === '피신청인').length > 1) && (
                    <button className={button} aria-label={label(p) + ' 삭제'} onClick={() => dropParty(p)}>
                      삭제
                    </button>
                  )}
                </div>
              ))}
          </div>
        </div>

        {(parties.length > 2 || stages.length > 1) && (
          <details className="rounded-lg border border-slate-200 bg-slate-50/40 px-3.5 py-2.5">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">
              심급별 당사자 대조표 보기 ({parties.length}명 · {stages.length}개 심급)
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2">확정신청 당사자</th>
                    {stages.map((s, i) => (
                      <th className="p-2" key={s.id}>
                        {stageLevel(s, i)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parties.map((p) => (
                    <tr key={p.id}>
                      <th className="p-2 font-medium text-slate-900">{label(p)}</th>
                      {stages.map((s) => {
                        const m = s.members[p.id];
                        return (
                          <td key={s.id} className="p-2 text-slate-700">
                            {m
                              ? [m.role || '지위 미입력', m.number, m.counterRole].filter(Boolean).join(' ')
                              : '참여 미선택'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Section>

      {/* 2. 본안 심급 선택 및 탭 전환 바 */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50/40 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-bold text-slate-800">포함할 본안 심급:</span>
          {levels.map((lv) => {
            const checked = presentLevels.includes(lv);
            return (
              <label
                key={lv}
                className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  checked
                    ? 'border-blue-600 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-white"
                  checked={checked}
                  onChange={(e) => toggleStageLevel(lv, e.target.checked)}
                />
                {lv}
              </label>
            );
          })}
        </div>
        {stages.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">화면 표시:</span>
            {stages.map((s, i) => {
              const lv = stageLevel(s, i);
              const isSelected = !showAllStages && currentActiveLevel === lv;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setShowAllStages(false);
                    setActiveStageLevel(lv);
                  }}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {lv}만 보기
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setShowAllStages((v) => !v)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                showAllStages
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {showAllStages ? '심급 탭으로 접기' : '전 심급 한눈에 펼치기'}
            </button>
          </div>
        )}
      </div>

      {stages.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          위 ‘포함할 본안 심급’에서 입력할 심급(1심 · 항소심 · 상고심)을 하나 이상 체크하세요.
        </p>
      )}

      {/* 3. 선택된 심급 카드 */}
      {stages.map((s, index) => {
        const sLevel = stageLevel(s, index);
        const isVisible = showAllStages || stages.length === 1 || currentActiveLevel === sLevel;
        if (!isVisible) return null;

        const useCalculatedValue = s.useIndividualValues === true;
        const displayedValue = useCalculatedValue ? stageEffectiveValue(s, parties)?.toLocaleString('ko-KR') ?? '' : s.value;
        const useCalculatedCounterValue = s.useCounterIndividualValues === true;
        const displayedCounterValue = useCalculatedCounterValue
          ? counterEffectiveValue(s, parties)?.toLocaleString('ko-KR') ?? ''
          : s.counterValue;
        const canEditMainIndividualValues = sLevel !== '1심' || Boolean(s.mainValueTarget);
        const counterTarget = s.mainValueTarget === '신청인측' ? '피신청인측' : '신청인측';
        const people = parties.filter((p) => s.members[p.id]);
        const applicantPeople = people.filter((p) => isApplicantSideParty(p));
        const opponentPeople = people.filter((p) => !isApplicantSideParty(p));
        const applicantCosts = s.costs.filter((c) => isApplicantCost(c));
        const opponentCosts = s.costs.filter((c) => !isApplicantCost(c));
        const showParticipantChecks = sLevel !== '1심' || stages.length > 1 || parties.length > 2;
        const assignedFeePartyIds = new Set(
          s.costs
            .filter((c) => c.kind === '변호사보수')
            .flatMap((c) => (c.shared ? c.ids : [c.payer]).filter(Boolean))
        );
        const allApplicantsFeeAssigned =
          applicantPeople.length > 0 && applicantPeople.every((p) => assignedFeePartyIds.has(p.id));
        const allOpponentsFeeAssigned =
          opponentPeople.length > 0 && opponentPeople.every((p) => assignedFeePartyIds.has(p.id));

        return (
          <Section id={'cost-stage-' + s.id} key={s.id} title={sLevel + ' · 참여자와 비용'} open>
            {sLevel !== '1심' && !people.length && (
              <p className={small}>{sLevel} 판결문에 기재된 참여 당사자를 선택하세요.</p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1 sm:max-w-xs">
                <Field
                  label={sLevel + ' 사건번호'}
                  value={s.number}
                  change={(number) => patchStage(s.id, { number })}
                />
              </div>
              {(sLevel === '1심' || s.counter || s.mainValueTarget) && (
                <div className="min-w-[180px] flex-1 sm:max-w-xs">
                  <Pick
                    label={sLevel + ' 소가 대상'}
                    value={s.mainValueTarget || ''}
                    options={['신청인측', '피신청인측']}
                    names={valueTargetLabels}
                    change={(target) => {
                      if (target === '신청인측' || target === '피신청인측') {
                        patchStage(s.id, { mainValueTarget: target });
                      } else {
                        patchStage(s.id, { mainValueTarget: undefined, useIndividualValues: false, useCounterIndividualValues: false });
                      }
                    }}
                  />
                </div>
              )}
              <div className="min-w-[220px] flex-1 sm:max-w-xs">
                <Field
                  claimValue
                  label={sLevel + ' 소가 (원)'}
                  value={displayedValue}
                  change={useCalculatedValue ? undefined : (value) => patchStage(s.id, { value })}
                />
              </div>
              <label className={`${stageCheckbox} border-slate-300 bg-white text-slate-700 has-disabled:cursor-not-allowed has-disabled:text-slate-500`}>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-700"
                  checked={s.useIndividualValues !== false}
                  disabled={!canEditMainIndividualValues}
                  onChange={(e) => patchStage(s.id, { useIndividualValues: e.currentTarget.checked })}
                />
                개별소가
              </label>
              <label
                className={`${stageCheckbox} transition-colors ${
                  s.counter
                    ? 'border-blue-600 bg-blue-50 text-blue-950'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-700"
                  checked={Boolean(s.counter)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (
                      !checked &&
                      (s.rules.some((r) => r.claim) ||
                        s.counterValue ||
                        s.counterValues?.length ||
                        s.counterNumber ||
                        people.some((p) => s.members[p.id].counterRole || s.members[p.id].counterValue) ||
                        s.costs.some(c => c.claim || c.claimSplit || c.mainRuleId || c.counterRuleId))
                    ) {
                      setNotice('반소 사건번호·소가·반소 지위·부담 관계·비용 구분 입력을 먼저 비운 뒤 반소 선택을 해제하세요.');
                      return;
                    }
                    setNotice('');
                    patchStage(s.id, checked ? { counter: '반소', counterFeeMode: '합산' } : { counter: '', useCounterIndividualValues: false, counterFeeMode: undefined });
                  }}
                />
                반소
              </label>
            </div>
            {!s.counter && s.mainValueTarget && (
              <p className="text-xs text-slate-600">개별소가를 선택하면 양측 당사자별 가액을 입력할 수 있습니다. 각 보수는 해당 보수에 선택한 당사자의 가액을 합산·흡수해 한도를 계산하고, 비용 안분에는 각자의 가액을 사용합니다. 위 소가는 선택한 소가 대상 측을 기준으로 표시합니다.</p>
            )}
            {s.counter && (
              <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                <p className="text-sm text-slate-800" aria-live="polite">
                  <span className="font-semibold">반소 대상</span>{' '}
                  {s.mainValueTarget ? valueTargetLabels[counterTarget] : `${sLevel} 소가 대상을 선택하세요.`}
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[200px] flex-1 sm:max-w-xs">
                    <Field
                      label="반소 사건번호"
                      value={s.counterNumber || ''}
                      change={(counterNumber) => patchStage(s.id, { counterNumber })}
                    />
                  </div>
                  <div className="min-w-[220px] flex-1 sm:max-w-xs">
                    <Field
                      claimValue
                      label="반소 전체 소가 (원)"
                      value={displayedCounterValue}
                      change={useCalculatedCounterValue ? undefined : (counterValue) => patchStage(s.id, { counterValue })}
                    />
                  </div>
                  <label className={`${stageCheckbox} border-slate-300 bg-white text-slate-700 has-disabled:cursor-not-allowed has-disabled:text-slate-500`}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-blue-700"
                      checked={useCalculatedCounterValue}
                      disabled={!s.mainValueTarget}
                      onChange={(e) => patchStage(s.id, { useCounterIndividualValues: e.currentTarget.checked })}
                    />
                    반소 개별소가
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Pick
                    label="보수 산정 시 본소·반소 소가 적용"
                    value={s.counterFeeMode || ''}
                    options={['합산', '흡수']}
                    names={{ 합산: '합산 — 본소 + 반소', 흡수: '다액흡수 — 둘 중 큰 소가' }}
                    change={(value) => {
                      if (value === '합산' || value === '흡수') patchStage(s.id, { counterFeeMode: value });
                    }}
                  />
                  <div className="self-end rounded-md border border-blue-200 bg-white p-3 text-sm text-blue-950" aria-live="polite">
                    {(() => {
                      const main = stageEffectiveValue(s, parties), counter = counterEffectiveValue(s, parties);
                      if (main === null || counter === null || !s.counterFeeMode) return '본소·반소 소가와 보수 산정 기준을 선택하세요.';
                      const basis = s.counterFeeMode === '합산' ? main + counter : main > counter ? main : counter;
                      return <>양 청구 전체 기준 소가 <strong>{won(basis)}</strong><br />일반 본안 보수 한도 <strong>{won(ordinaryFeeLimit(basis))}</strong></>;
                    })()}
                  </div>
                </div>
                <p className="text-xs text-slate-600">본소·반소를 함께 대리한 양측 보수에 적용합니다. 대리 범위가 다르면 각 보수에서 지정하세요. 인지대 입력액과 당사자별 소가 합산·흡수 설정은 바뀌지 않습니다.</p>
              </div>
            )}
            {showParticipantChecks && (
              <Checks
                title={sLevel + ' 참여 당사자'}
                choices={parties.map((p) => ({
                  id: p.id,
                  side: isApplicantSideParty(p) ? '신청인측' : '피신청인측',
                  label: label(p),
                }))}
                selected={people.map((p) => p.id)}
                change={(ids) => {
                  const removed = people.find((p) => !ids.includes(p.id));
                  if (removed) {
                    const id = removed.id;
                    const links = [
                      ...(s.mainValues || []).flatMap((row,i) => row.ids.includes(id) ? [`공통소가 묶음 ${i+1}`] : []),
                      ...(s.counterValues || []).flatMap((row,i) => row.ids.includes(id) ? [`반소 소가 내역 ${i+1}`] : []),
                      ...s.costs.flatMap((c,i) => c.payer === id || c.ids.includes(id) ? [`비용 ${i+1} (${c.title || c.kind})`] : []),
                      ...s.rules.flatMap((r,i) => [...r.left,...r.right].includes(id) ? [`부담 관계 ${i+1}`] : []),
                      ...Object.entries(s.members).flatMap(([owner, m]) => Object.hasOwn(m.relationValues || {}, id) || Object.hasOwn(m.counterRelationValues || {}, id) ? [`관계별 소가 (${label(parties.find(p => p.id === owner)!)})`] : []),
                    ];
                    if (links.length || memberHasEntries(s.members[id])) {
                      setNotice(links.length ? `${label(removed)}: ${links.join(', ')}의 연결을 먼저 정리하세요.` : `${label(removed)}의 지위·번호·소가·반소 지위 입력을 먼저 정리하세요.`);
                      return;
                    }
                  }
                  setNotice('');
                  patchStage(s.id, {
                    members: Object.fromEntries(ids.map((id) => [id, s.members[id] || member()])),
                  });
                }}
              />
            )}

            {/* 3-1 & 3-2 통합: 좌측(신청인 측 당사자 + 지출비용) / 우측(피신청인 측 당사자 + 지출비용) */}
            <div className="grid items-start gap-3.5 lg:grid-cols-2">
              {/* 좌측 컬럼: 신청인 측 */}
              <div className="min-w-0 space-y-3 rounded-xl border border-blue-200 bg-blue-50/20 p-3.5">
                {renderSidePartySection(s, sLevel, applicantPeople, true)}

                <div className="space-y-2.5 border-t border-blue-200/70 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-sm font-bold text-blue-950">
                      신청인 측 지출 비용 ({applicantCosts.length}건)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {['변호사보수', '인지대', '송달료', '기타 비용'].map((kind) => (
                        <button
                          className={button}
                          key={kind}
                          disabled={
                            applicantPeople.length === 0 ||
                            (kind === '변호사보수' && allApplicantsFeeAssigned)
                          }
                          onClick={() =>
                            patchStage(s.id, {
                              costs: [...s.costs, createSideStageCost(s, 'applicant', kind)],
                            })
                          }
                        >
                          + {kind}
                        </button>
                      ))}
                    </div>
                  </div>
                  {applicantCosts.map((c) =>
                    costEditor(
                      c,
                      (patch) =>
                        patchStage(s.id, {
                          costs: s.costs.map((v) => (v.id === c.id ? { ...v, ...patch } : v)),
                        }),
                      () => patchStage(s.id, { costs: s.costs.filter((v) => v.id !== c.id) }),
                      s
                    )
                  )}
                </div>
              </div>

              {/* 우측 컬럼: 피신청인 측 */}
              <div className="min-w-0 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                {renderSidePartySection(s, sLevel, opponentPeople, false)}

                <div className="space-y-2.5 border-t border-slate-200 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-sm font-bold text-slate-900">
                      피신청인 측 지출 비용 ({opponentCosts.length}건)
                    </span>
                      <p className="text-xs text-slate-500">정산에 반영할 금액을 입력하세요. 판결 주문상 피신청인이 상환받을 비용이 없으면 입력을 생략할 수 있습니다. 그 외 반영할 비용이 없으면 비용 항목에 0원을 입력하세요.</p>
                    <div className="flex flex-wrap gap-1.5">
                      {['변호사보수', '인지대', '송달료', '기타 비용'].map((kind) => (
                        <button
                          className={button}
                          key={kind}
                          disabled={
                            opponentPeople.length === 0 ||
                            (kind === '변호사보수' && allOpponentsFeeAssigned)
                          }
                          onClick={() =>
                            patchStage(s.id, {
                              costs: [...s.costs, createSideStageCost(s, 'opponent', kind)],
                            })
                          }
                        >
                          + {kind}
                        </button>
                      ))}
                    </div>
                  </div>
                  {opponentCosts.map((c) =>
                    costEditor(
                      c,
                      (patch) =>
                        patchStage(s.id, {
                          costs: s.costs.map((v) => (v.id === c.id ? { ...v, ...patch } : v)),
                        }),
                      () => patchStage(s.id, { costs: s.costs.filter((v) => v.id !== c.id) }),
                      s
                    )
                  )}
                </div>
              </div>
            </div>
          </Section>
        );
      })}

      {/* 3. 판결의 소송비용부담 주문 (별도 독립 섹션) */}
      <BurdenOrderSection
        stages={stages}
        parties={parties}
        label={label}
        onUpdateStageRules={(stageId, rules) => patchStage(stageId, { rules })}
      />

      {/* 4. 소송비용액확정신청 */}
      <div className="space-y-3.5">
        <Section id="cost-application" title="소송비용액확정신청" open>
          <p className="rounded-lg border border-blue-200 bg-blue-50/40 p-3 text-sm text-slate-700">신청인 균분 · 피신청인 균분 · 판결 주문 기준으로 자동 계산합니다. 당사자별로 입력한 판결의 부담비율을 적용합니다.</p>
          <div className="flex flex-wrap gap-1.5">
            {['인지대', '송달료', '서기료', '서류 발급비', '기타 비용'].map(
              (kind) => (
                <button
                  key={kind}
                  className={button}
                  onClick={() => {
                    if (kind === '송달료') {
                      setDeliveryModalOpen(true);
                    } else {
                      setApplicationCosts([...applicationCosts, createApplicationCost(kind)]);
                    }
                  }}
                >
                  + {kind}
                </button>
              )
            )}
          </div>
          {applicationCosts.map((c) =>
            costEditor(
              c,
              (patch) =>
                setApplicationCosts(
                  applicationCosts.map((v) => (v.id === c.id ? { ...v, ...patch } : v))
                ),
              () => setApplicationCosts(applicationCosts.filter((v) => v.id !== c.id))
            )
          )}
        </Section>

        {deliveryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h4 className="text-base font-bold text-slate-900">확정신청 송달료 입력</h4>
                <button
                  type="button"
                  onClick={() => setDeliveryModalOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                기발생 송달료와 모바일단문(알림문자) 등을 입력하시면 송달료 합계가 자동으로 산출되어 소송비용계산서에 반영됩니다.
              </p>

              <div className="space-y-3">
                <Field
                  numeric
                  showAmountPreview
                  label="기발생 송달료 (원)"
                  value={deliveryInputs.incurred}
                  change={(incurred) => setDeliveryInputs({ ...deliveryInputs, incurred: incurred || '' })}
                />
                <Field
                  numeric
                  showAmountPreview
                  label="결정정본 송달료 (원)"
                  value={deliveryInputs.decision}
                  change={(decision) => setDeliveryInputs({ ...deliveryInputs, decision: decision || '' })}
                />
                <Field
                  numeric
                  showAmountPreview
                  label="모바일단문 (원)"
                  value={deliveryInputs.mobile}
                  change={(mobile) => setDeliveryInputs({ ...deliveryInputs, mobile: mobile || '' })}
                />
              </div>

              {(() => {
                const inc = BigInt(deliveryInputs.incurred || '0');
                const dec = BigInt(deliveryInputs.decision || '0');
                const mob = BigInt(deliveryInputs.mobile || '0');
                const total = inc + dec + mob;
                return (
                  <div className="rounded-lg bg-blue-50/80 border border-blue-200/80 p-3.5 flex justify-between items-baseline">
                    <span className="text-xs font-semibold text-blue-900">송달료 납부 합계</span>
                    <span className="text-lg font-bold text-blue-950 tabular-nums">
                      {total.toLocaleString('ko-KR')}원
                    </span>
                  </div>
                );
              })()}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  onClick={() => setDeliveryModalOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
                  onClick={() => {
                    const inc = BigInt(deliveryInputs.incurred || '0');
                    const dec = BigInt(deliveryInputs.decision || '0');
                    const mob = BigInt(deliveryInputs.mobile || '0');
                    const total = inc + dec + mob;
                    const newCost = createApplicationCost(
                      '송달료',
                      { ...deliveryInputs },
                      total > 0n ? total.toString() : ''
                    );
                    setApplicationCosts([...applicationCosts, newCost]);
                    setDeliveryModalOpen(false);
                    setDeliveryInputs({ incurred: '', decision: '5640', mobile: '' });
                  }}
                >
                  송달료 추가
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <CostReview
        parties={parties}
        stages={stages}
        applicationCosts={applicationCosts}
        applicationCaseNumber={caseNumber}
        label={label}
      />
      {notice && (
        <div
          role="status"
          className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950 shadow-md"
        >
          <span>{notice}</span>
          <button
            type="button"
            className="shrink-0 rounded border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            onClick={() => setNotice('')}
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}
