'use client';

import { useState, type ReactNode } from 'react';
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
  type Rule,
  type Stage,
  type Cost,
  type Reviews,
} from './caseInput';
import { CostReview } from './CostReview';
import {
  allocationMemberValue,
  counterEffectiveValue,
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
  rules: [],
});
const sortStagesByLevel = (list: Stage[]): Stage[] =>
  [...list].sort(
    (a, b) =>
      levels.indexOf(stageLevel(a, list.indexOf(a))) - levels.indexOf(stageLevel(b, list.indexOf(b)))
  );
const uid = () => crypto.randomUUID();
const button =
  'rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40';
const input =
  'mt-1 block h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-blue-600 focus:outline-2 focus:outline-blue-600';
const stageCheckbox =
  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3.5 text-sm font-semibold';
const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
const box = 'space-y-3 rounded-lg border border-slate-200 bg-white p-3.5 shadow-2xs';
const partyBox = 'space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5';
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
  return Boolean(m.role || m.number || m.value || m.counterRole || m.counterValue);
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
  const [reviews, setReviews] = useState<Reviews>({});
  const [notice, setNotice] = useState('');
  const [fullyOpen, setFullyOpen] = useState(false);

  const label = (p: Party) => {
    const bucket = parties.filter(
      (q) => q.group === p.group && (p.group !== '신청외' || isApplicantSideParty(q) === isApplicantSideParty(p))
    );
    const groupText =
      p.group === '신청외' ? (isApplicantSideParty(p) ? '신청인측 신청외' : '피신청인측 신청외') : p.group;
    return [groupText, bucket.findIndex((q) => q.id === p.id) + 1, p.name].filter(Boolean).join(' ');
  };
  const side = (p: Party) => p.group === '신청인';
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
      s.rules.some((r) => [...r.left, ...r.right].includes(id))
    );
  }
  function dropParty(p: Party) {
    if (
      Object.values(reviews[p.id] || {}).some(Boolean) ||
      stages.some((s) => referenced(s, p.id) || (s.members[p.id] && memberHasEntries(s.members[p.id]))) ||
      applicationCosts.some((c) => c.payer === p.id || c.ids.includes(p.id))
    ) {
      setNotice('이 당사자의 심급 정보, 제출·상계 검토 또는 연결된 비용·부담 관계를 먼저 정리하세요.');
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

  function createApplicationCost(kind: string): Cost {
    const applicantIds = parties.filter(side).map((p) => p.id);
    const firstId = applicantIds.length === 1 ? applicantIds[0] : '';
    return {
      id: uid(),
      payer: firstId,
      kind,
      paid: '',
      refund: '0',
      shared: false,
      ids: firstId ? [firstId] : [],
      method: '',
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
    const hasMainValue = s.mainValueTarget
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
        ? 'grid-cols-[minmax(80px,1fr)_86px_50px_84px_minmax(120px,1.3fr)]'
        : 'grid-cols-[minmax(80px,1fr)_86px_50px_84px]'
      : hasClaimValue
        ? 'grid-cols-[minmax(88px,1.1fr)_94px_56px_minmax(130px,1.5fr)]'
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
      <div className="space-y-2.5">
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
          <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-2xs">
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
      : parties.filter(side);
    const owners = (c.shared ? c.ids : [c.payer]).filter(Boolean);
    const normalizedMethod = c.method === '소가 비율' ? '안분' : c.method;
    const weights = owners.map((id) => {
      if (normalizedMethod === '균분') return BigInt(1);
      const party = parties.find((p) => p.id === id);
      return s && party ? allocationMemberValue(s, party) : null;
    });
    const sum = weights.reduce<bigint>((total, w) => total + (w ?? BigInt(0)), BigInt(0));
    const feeBasis = s && c.kind === '변호사보수' ? resolveFeeBasisValue(c, s, parties) : null;
    const feeLimit = feeBasis !== null ? ordinaryFeeLimit(feeBasis) : null;
    const candidateRules =
      s?.rules.filter(
        (r) => owners.length && owners.every((id) => r.left.includes(id) || r.right.includes(id))
      ) || [];
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
      if (!s) {
        setCostOwners([partyId]);
        return;
      }
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
                부담대상 · {label(eligible[0])}
              </span>
            )}
            {c.paid !== '' && (
              <span className={small}>
                {net === null ? (
                  <span className="font-medium text-amber-800">금액 확인</span>
                ) : (
                  <span>
                    실지출 <strong className="font-semibold text-slate-900">{won(net)}</strong>
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
        {(eligible.length > 1 || owners.length === 0) && (
          <div className="rounded-md bg-slate-50 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-slate-600">부담대상</span>
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
            label={c.kind === '변호사보수' ? '실지급 보수 (원)' : '납부액 (원)'}
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

        {s && (candidateRules.length > 1 || c.ruleId) && (
          <label className="block text-sm font-medium text-slate-800">
            이 비용 전액에 적용할 부담 관계
            <select
              className={input}
              value={c.ruleId || ''}
              onChange={(e) => update({ ruleId: e.target.value })}
            >
              <option value="">당사자 범위로 확인</option>
              {candidateRules.map((r) => (
                <option key={r.id} value={r.id}>
                  관계 {s.rules.indexOf(r) + 1} ·{' '}
                  {r.left.map((id) => label(parties.find((p) => p.id === id)!)).join(', ')} /{' '}
                  {r.right.map((id) => label(parties.find((p) => p.id === id)!)).join(', ')}
                </option>
              ))}
            </select>
          </label>
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
            ['cost-submission', '제출·상계'],
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
        <button
          className={button}
          onClick={(e) => {
            const next = !fullyOpen;
            setShowAllStages(next);
            requestAnimationFrame(() => {
              e.currentTarget
                .closest('main')
                ?.querySelectorAll<HTMLDetailsElement>('[data-case-form] details')
                .forEach((d) => {
                  d.open = next;
                });
            });
            setFullyOpen(next);
          }}
        >
          {fullyOpen ? '전체 접기' : '전체 펼치기'}
        </button>
      </div>

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
          <div className="space-y-2.5 rounded-lg border border-blue-200 bg-blue-50/30 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-blue-950">신청인 측</span>
              <div className="flex gap-1.5">
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
          <div className="space-y-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">피신청인 측</span>
              <div className="flex gap-1.5">
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
        const choices: CheckChoice[] = people.map((p) => ({
          id: p.id,
          side: isApplicantSideParty(p) ? '신청인측' : '피신청인측',
          label: [label(p), s.members[p.id].role, s.members[p.id].number].filter(Boolean).join(' '),
        }));
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
                        people.some((p) => s.members[p.id].counterRole || s.members[p.id].counterValue))
                    ) {
                      setNotice('반소 사건번호·소가·반소 지위·부담 관계 입력을 먼저 비운 뒤 반소 선택을 해제하세요.');
                      return;
                    }
                    setNotice('');
                    patchStage(s.id, checked ? { counter: '반소' } : { counter: '', useCounterIndividualValues: false });
                  }}
                />
                반소
              </label>
            </div>
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
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/20 p-3.5">
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
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                {renderSidePartySection(s, sLevel, opponentPeople, false)}

                <div className="space-y-2.5 border-t border-slate-200 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="text-sm font-bold text-slate-900">
                      피신청인 측 지출 비용 ({opponentCosts.length}건)
                    </span>
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

            {/* 3-3. 판결의 비용 부담 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5">
              <div>
                <h3 className="text-base font-bold text-slate-900">판결의 비용 부담</h3>
                <p className={small}>적용할 당사자와 분담비율을 입력하세요.</p>
              </div>
              <button
                className={button}
                disabled={people.length < 2}
                onClick={() =>
                  patchStage(s.id, {
                    rules: [
                      ...s.rules,
                      {
                        id: uid(),
                        left: people.length === 2 ? [people[0].id] : [],
                        right: people.length === 2 ? [people[1].id] : [],
                        mode: '',
                        n: '',
                        d: '',
                        scope: sLevel + ' 비용',
                        claim: '',
                        leftMethod: '',
                        rightMethod: '',
                      },
                    ],
                  })
                }
              >
                + 부담 관계 추가
              </button>
            </div>
            {s.rules.length > 0 && (
              <div className="grid gap-3 lg:grid-cols-2">
                {s.rules.map((r, i) => {
                  const edit = (patch: Partial<Rule>) =>
                    patchStage(s.id, { rules: s.rules.map((v) => (v.id === r.id ? { ...v, ...patch } : v)) });
                  const n = natural(r.n),
                    d = natural(r.d);
                  const sideLabel = (ids: string[]) =>
                    ids.map((id) => choices.find((p) => p.id === id)?.label).join(', ');
                  return (
                    <div key={r.id} className={partyBox}>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <strong className="text-sm font-bold text-slate-900">부담 관계 {i + 1}</strong>
                        <button
                          className={button}
                          onClick={() => {
                            if (s.costs.some((c) => c.ruleId === r.id)) {
                              setNotice('비용에 지정된 부담 관계를 먼저 해제하세요.');
                              return;
                            }
                            setNotice('');
                            patchStage(s.id, { rules: s.rules.filter((v) => v.id !== r.id) });
                          }}
                        >
                          관계 삭제
                        </button>
                      </div>
                      {(['left', 'right'] as const).map((key, j) => {
                        const other = key === 'left' ? r.right : r.left;
                        const method = key === 'left' ? 'leftMethod' : 'rightMethod';
                        return (
                          <div key={key}>
                            {people.length === 2 && r.left.length === 1 && r.right.length === 1 ? (
                              <span className="mr-3 inline-block text-sm text-slate-600">
                                <strong className="font-semibold text-slate-800">{j + 1}측</strong> ·{' '}
                                {sideLabel(r[key])}
                              </span>
                            ) : (
                              <Checks
                                title={j + 1 + '측 당사자'}
                                choices={choices.filter((c) => !other.includes(c.id))}
                                selected={r[key]}
                                change={(ids) => edit({ [key]: ids })}
                              />
                            )}
                            {r[key].length > 1 && (
                              <div className="mt-1.5">
                                <Pick
                                  label={j + 1 + '측 내부 부담 기준'}
                                  options={splitOptions}
                                  value={r[method] === '소가 비율' ? '안분' : r[method]}
                                  change={(v) => edit({ [method]: v })}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <div className="grid gap-2.5 sm:grid-cols-2">
                        {sLevel !== '1심' && (
                          <Pick
                            label="주문 적용 범위"
                            value={r.scope}
                            options={[sLevel + ' 비용', '소송총비용']}
                            change={(scope) => edit({ scope })}
                          />
                        )}
                        {s.counter && (
                          <Pick
                            label="적용 청구"
                            value={r.claim}
                            options={['본소와 반소', '본소', '반소']}
                            change={(claim) => edit({ claim })}
                          />
                        )}
                        <Pick
                          label="부담 방식"
                          names={{
                            '1측 전부 부담': (sideLabel(r.left) || '1측') + ' 전부 부담',
                            '2측 전부 부담': (sideLabel(r.right) || '2측') + ' 전부 부담',
                          }}
                          value={r.mode}
                          options={['1측 전부 부담', '2측 전부 부담', '비율로 분담', '각자 부담']}
                          change={(mode) => edit({ mode })}
                        />
                      </div>
                      {r.mode === '비율로 분담' && (
                        <>
                          <div className="grid grid-cols-2 gap-2.5">
                            <Field numeric label="1측 부담 분자" value={r.n} change={(n) => edit({ n })} />
                            <Field numeric label="분모" value={r.d} change={(d) => edit({ d })} />
                          </div>
                          <p className={small}>
                            {n !== null && d !== null && d > 0 && n <= d ? (
                              <span>
                                2측 부담 <strong className="font-semibold text-blue-900">{d - n}/{d}</strong>
                              </span>
                            ) : (
                              '0 이상이고 분모 이하인 분자를 입력하세요. 분모는 1 이상입니다.'
                            )}
                          </p>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        );
      })}

      {/* 4. 소송비용액확정신청 및 비용자료 제출·상계 검토 */}
      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <Section id="cost-application" title="소송비용액확정신청" open>
          <div className="flex flex-wrap gap-1.5">
            {['인지대', '기발생 송달료', '결정정본 송달료', '서기료', '서류 발급비', '기타 비용'].map(
              (kind) => (
                <button
                  key={kind}
                  className={button}
                  onClick={() =>
                    setApplicationCosts([...applicationCosts, createApplicationCost(kind)])
                  }
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

        <Section id="cost-submission" title="비용자료 제출·상계 검토" open>
          {parties
            .filter((p) => p.group === '피신청인')
            .map((p) => (
              <div key={p.id} className={partyBox}>
                <strong className="block text-sm font-bold text-slate-900">{label(p)}</strong>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Pick
                    label="비용자료 제출"
                    options={['기간 내 제출', '기간 내 미제출', '추가 확인 필요']}
                    value={reviews[p.id]?.submission || ''}
                    change={(submission) =>
                      setReviews({ ...reviews, [p.id]: { ...reviews[p.id], submission } })
                    }
                  />
                  <Pick
                    label="상계 검토"
                    options={['쌍방 비용 상계', '신청인 비용만 반영', '추가 확인 필요']}
                    value={reviews[p.id]?.treatment || ''}
                    change={(treatment) =>
                      setReviews({ ...reviews, [p.id]: { ...reviews[p.id], treatment } })
                    }
                  />
                  <label className="col-span-full flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
                    <input
                      type="checkbox"
                      className="accent-blue-700"
                      checked={!!reviews[p.id]?.zeroConfirmed}
                      onChange={(e) =>
                        setReviews({
                          ...reviews,
                          [p.id]: { ...reviews[p.id], zeroConfirmed: e.target.checked },
                        })
                      }
                    />{' '}
                    본안 귀속 비용 0원 확인
                  </label>
                  {reviews[p.id]?.submission === '기간 내 미제출' &&
                    reviews[p.id]?.treatment === '쌍방 비용 상계' && (
                      <p className="col-span-full rounded-md bg-amber-50 p-2.5 text-sm text-amber-900">
                        기간 내 미제출 상태입니다. 상계 적용 근거를 다시 확인하세요.
                      </p>
                    )}
                </div>
              </div>
            ))}
        </Section>
      </div>

      <CostReview
        parties={parties}
        stages={stages}
        reviews={reviews}
        applicationCosts={applicationCosts}
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
