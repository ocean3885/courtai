'use client';

import { useState } from 'react';
import { isReferenced, type LitigationDraft } from '@/lib/litigation-costs-draft';
import { secondary } from './form-controls';

export type FinalInstance = '1심 확정' | '2심(항소심) 확정' | '3심(상고심) 확정';
export type ApplicantStanding = '원고(반소피고)' | '피고(반소원고)' | '승계인';

const mandateGroups = ['미지정', '공동선임 A그룹', '공동선임 B그룹', '개별선임 1', '개별선임 2'];
const REMAND_NOTE = '파기환송 사건 포함 (환송 전·후 항소심 변호사보수 1회 통합 기준 검토)';

export function detectFinalInstance(draft: LitigationDraft): FinalInstance {
  if (draft.stages.some(s => s.type === '상고심' || s.type === '재상고심')) return '3심(상고심) 확정';
  if (draft.stages.some(s => s.type === '항소심' || s.type === '환송심')) return '2심(항소심) 확정';
  return '1심 확정';
}

export function hasCounterclaim(draft: LitigationDraft): boolean {
  return draft.claims.some(c => c.kind === '반소');
}

export function hasRemandStage(draft: LitigationDraft): boolean {
  return draft.stages.some(s => s.type === '환송심') || draft.meta.scopeNote.includes('파기환송');
}

export function hasRespondentSetoff(draft: LitigationDraft): boolean {
  return draft.calculation.setoff === 'mutual' || draft.review.responseState === '기간 내 제출';
}

export function GuidedStep1Setup({ draft, onChange }: {
  draft: LitigationDraft;
  onChange: (fn: (old: LitigationDraft) => LitigationDraft) => void;
}) {
  const [selectedInstance, setSelectedInstance] = useState<FinalInstance | null>(null);
  const [selectedStanding, setSelectedStanding] = useState<ApplicantStanding | null>(null);
  const [selectedCounterclaim, setSelectedCounterclaim] = useState<boolean | null>(null);
  const [selectedRemand, setSelectedRemand] = useState<boolean | null>(null);
  const [selectedSetoff, setSelectedSetoff] = useState<boolean | null>(null);
  const [separatedPartyIds, setSeparatedPartyIds] = useState<string[]>([]);

  const finalInstance: FinalInstance = selectedInstance ?? detectFinalInstance(draft);
  const counterclaim: boolean = selectedCounterclaim ?? hasCounterclaim(draft);
  const remand: boolean = selectedRemand ?? hasRemandStage(draft);
  const respondentSetoff: boolean = selectedSetoff ?? hasRespondentSetoff(draft);

  const applicants = draft.parties.filter(p => p.applicationRole === '신청인');
  const respondents = draft.parties.filter(p => p.applicationRole === '피신청인');
  const detectedStanding: ApplicantStanding = applicants[0]?.mainRole === '피고'
    ? '피고(반소원고)'
    : applicants[0]?.mainRole === '승계인'
      ? '승계인'
      : '원고(반소피고)';
  const primaryStanding: ApplicantStanding = selectedStanding ?? detectedStanding;

  function applyFinalInstance(target: FinalInstance) {
    setSelectedInstance(target);
    const needed: ('제1심' | '항소심' | '상고심')[] = target === '1심 확정'
      ? ['제1심']
      : target === '2심(항소심) 확정'
        ? ['제1심', '항소심']
        : ['제1심', '항소심', '상고심'];
    const unwantedTypes = target === '1심 확정'
      ? ['항소심', '상고심']
      : target === '2심(항소심) 확정'
        ? ['상고심']
        : [];

    onChange(old => {
      const allPartyIds = old.parties.map(p => p.id);
      const upperPartyIds = allPartyIds.filter(id => !separatedPartyIds.includes(id));
      const removableIds = new Set(
        old.stages
          .filter(s => unwantedTypes.includes(s.type) && !old.costs.some(c => c.stageId === s.id) && !old.calculation.values.some(v => v.stageId === s.id) && !old.calculation.groups.some(g => g.stageId === s.id))
          .map(s => s.id)
      );
      const cleanedMandates = old.mandates.map(m => ({ ...m, stageIds: m.stageIds.filter(id => !removableIds.has(id)) }));
      const cleanedRulings = old.rulings.map(r => ({ ...r, stageIds: r.stageIds.filter(id => !removableIds.has(id)) }));
      const baseDraft = { ...old, mandates: cleanedMandates, rulings: cleanedRulings };
      const nextStages = baseDraft.stages.filter(s => !removableIds.has(s.id) || isReferenced(baseDraft, s.id));

      for (const type of needed) {
        if (!nextStages.some(s => s.type === type)) {
          nextStages.push({
            id: crypto.randomUUID(),
            type,
            number: '',
            partyIds: type === '제1심' ? allPartyIds : upperPartyIds,
            appealScope: '',
            changes: '',
          });
        }
      }
      if (!nextStages.some(s => s.type === '확정신청')) {
        nextStages.push({
          id: crypto.randomUUID(),
          type: '확정신청',
          number: old.meta.number || '',
          partyIds: allPartyIds,
          appealScope: '',
          changes: '',
        });
      }
      return { ...baseDraft, stages: nextStages };
    });
  }

  function applyApplicantStanding(standing: ApplicantStanding) {
    setSelectedStanding(standing);
    const appRole = standing === '피고(반소원고)' ? '피고' : standing === '승계인' ? '승계인' : '원고';
    const respRole = standing === '피고(반소원고)' ? '원고' : '피고';
    onChange(old => ({
      ...old,
      parties: old.parties.map(p => {
        if (p.applicationRole === '신청인') return { ...p, mainRole: appRole };
        if (p.applicationRole === '피신청인' && (p.mainRole === '원고' || p.mainRole === '피고')) return { ...p, mainRole: respRole };
        return p;
      }),
    }));
  }

  function toggleCounterclaim(checked: boolean) {
    setSelectedCounterclaim(checked);
    onChange(old => {
      if (checked) {
        if (old.claims.some(c => c.kind === '반소')) return old;
        const respIds = old.parties.filter(p => p.applicationRole === '피신청인').map(p => p.id);
        const appIds = old.parties.filter(p => p.applicationRole === '신청인').map(p => p.id);
        return {
          ...old,
          claims: [
            ...old.claims,
            {
              id: crypto.randomUUID(),
              kind: '반소',
              title: '반소 청구',
              claimantIds: respIds,
              opponentIds: appIds,
              value: '',
              relation: '',
            },
          ],
        };
      }
      const removableClaimIds = new Set(
        old.claims
          .filter(c => c.kind === '반소' && !old.costs.some(cost => cost.claimIds.includes(c.id)) && !old.calculation.values.some(v => v.claimId === c.id) && !old.calculation.groups.some(g => g.claimIds.includes(c.id)))
          .map(c => c.id)
      );
      const cleanedMandates = old.mandates.map(m => ({ ...m, claimIds: m.claimIds.filter(id => !removableClaimIds.has(id)) }));
      const cleanedRulings = old.rulings.map(r => ({ ...r, claimIds: r.claimIds.filter(id => !removableClaimIds.has(id)) }));
      const baseDraft = { ...old, mandates: cleanedMandates, rulings: cleanedRulings };
      return {
        ...baseDraft,
        claims: baseDraft.claims.filter(c => !removableClaimIds.has(c.id) || isReferenced(baseDraft, c.id)),
      };
    });
  }

  function toggleRemand(checked: boolean) {
    setSelectedRemand(checked);
    onChange(old => {
      if (checked) {
        const note = old.meta.scopeNote.includes('파기환송')
          ? old.meta.scopeNote
          : `${old.meta.scopeNote ? `${old.meta.scopeNote} · ` : ''}${REMAND_NOTE}`;
        const hasStage = old.stages.some(s => s.type === '환송심');
        return {
          ...old,
          meta: { ...old.meta, scopeNote: note },
          stages: hasStage
            ? old.stages
            : [
              ...old.stages,
              {
                id: crypto.randomUUID(),
                type: '환송심',
                number: '',
                partyIds: old.parties.map(p => p.id).filter(id => !separatedPartyIds.includes(id)),
                appealScope: '파기환송 후 항소심',
                changes: '환송 전·후 항소심 변호사보수 산입 범위 검토',
              },
            ],
        };
      }
      const removableIds = new Set(
        old.stages
          .filter(s => s.type === '환송심' && !old.costs.some(c => c.stageId === s.id) && !old.calculation.values.some(v => v.stageId === s.id) && !old.calculation.groups.some(g => g.stageId === s.id))
          .map(s => s.id)
      );
      const cleanedMandates = old.mandates.map(m => ({ ...m, stageIds: m.stageIds.filter(id => !removableIds.has(id)) }));
      const cleanedRulings = old.rulings.map(r => ({ ...r, stageIds: r.stageIds.filter(id => !removableIds.has(id)) }));
      const baseDraft = { ...old, mandates: cleanedMandates, rulings: cleanedRulings };
      const cleanedNote = old.meta.scopeNote
        .replace(` · ${REMAND_NOTE}`, '')
        .replace(REMAND_NOTE, '')
        .replace(/파기환송/g, '')
        .trim();
      return {
        ...baseDraft,
        meta: { ...baseDraft.meta, scopeNote: cleanedNote },
        stages: baseDraft.stages.filter(s => !removableIds.has(s.id) || isReferenced(baseDraft, s.id)),
      };
    });
  }

  function toggleRespondentSetoff(checked: boolean) {
    setSelectedSetoff(checked);
    onChange(old => ({
      ...old,
      review: {
        ...old.review,
        responseState: checked ? '기간 내 제출' : '기간 내 미제출',
        setoff: checked ? '제112조 본문 적용 검토' : '제111조 제2항 예외 검토',
      },
      calculation: {
        ...old.calculation,
        setoff: checked ? 'mutual' : 'applicantOnly',
      },
    }));
  }

  function currentMandateGroup(partyId: string): string {
    const preset = draft.mandates.find(m => m.partyIds.includes(partyId) && mandateGroups.includes(m.name));
    if (preset) return preset.name;
    const anyMandate = draft.mandates.find(m => m.partyIds.includes(partyId));
    if (!anyMandate) return '미지정';
    return anyMandate.name;
  }

  function mandateOptionsForParty(partyId: string): string[] {
    const current = currentMandateGroup(partyId);
    return mandateGroups.includes(current) ? mandateGroups : [current, ...mandateGroups];
  }

  function assignMandateGroup(partyId: string, groupName: string) {
    onChange(old => {
      const cleaned = old.mandates.map(m => (
        mandateGroups.includes(m.name)
          ? { ...m, partyIds: m.partyIds.filter(id => id !== partyId) }
          : m
      ));
      if (groupName === '미지정') return { ...old, mandates: cleaned };
      const existing = cleaned.find(m => m.name === groupName);
      const stageIds = old.stages.filter(s => s.type !== '확정신청').map(s => s.id);
      const claimIds = old.claims.map(c => c.id);
      if (existing) {
        return {
          ...old,
          mandates: cleaned.map(m => m.id === existing.id ? { ...m, partyIds: [...new Set([...m.partyIds, partyId])] } : m),
        };
      }
      return {
        ...old,
        mandates: [
          ...cleaned,
          {
            id: crypto.randomUUID(),
            name: groupName,
            partyIds: [partyId],
            stageIds,
            claimIds,
            start: '',
            end: '',
            endReason: '',
            agreed: '',
            paid: '',
            evidence: '',
          },
        ],
      };
    });
  }

  function isFirstInstanceSeparated(partyId: string): boolean {
    if (separatedPartyIds.includes(partyId)) return true;
    const upperStages = draft.stages.filter(s => ['항소심', '상고심', '환송심', '재상고심'].includes(s.type));
    if (!upperStages.length) return false;
    return upperStages.every(s => !s.partyIds.includes(partyId));
  }

  function toggleFirstInstanceSeparated(partyId: string, separated: boolean) {
    setSeparatedPartyIds(prev => separated ? [...new Set([...prev, partyId])] : prev.filter(id => id !== partyId));
    onChange(old => ({
      ...old,
      stages: old.stages.map(s => {
        if (!['항소심', '상고심', '환송심', '재상고심'].includes(s.type)) return s;
        return {
          ...s,
          partyIds: separated
            ? s.partyIds.filter(id => id !== partyId)
            : [...new Set([...s.partyIds, partyId])],
        };
      }),
    }));
  }

  function addSideParty(applicationRole: '신청인' | '피신청인') {
    const defaultMainRole = applicationRole === '신청인'
      ? (primaryStanding === '피고(반소원고)' ? '피고' : primaryStanding === '승계인' ? '승계인' : '원고')
      : (primaryStanding === '피고(반소원고)' ? '원고' : '피고');
    onChange(old => {
      if (old.parties.length >= 500) return old;
      const newId = crypto.randomUUID();
      const nextParties = [...old.parties, { id: newId, name: '', mainRole: defaultMainRole, applicationRole }];
      const nextClaims = old.claims.length
        ? old.claims.map((c, idx) => idx === 0 && c.kind === '본소'
          ? {
            ...c,
            claimantIds: defaultMainRole === '원고' ? [...new Set([...c.claimantIds, newId])] : c.claimantIds,
            opponentIds: defaultMainRole === '피고' ? [...new Set([...c.opponentIds, newId])] : c.opponentIds,
          }
          : c)
        : [{
          id: crypto.randomUUID(),
          kind: '본소',
          title: '본소 청구',
          claimantIds: applicationRole === '신청인' && defaultMainRole === '원고' ? [newId] : [],
          opponentIds: applicationRole === '피신청인' && defaultMainRole === '피고' ? [newId] : [],
          value: '',
          relation: '',
        }];
      const nextStages = old.stages.map(s => ({ ...s, partyIds: [...new Set([...s.partyIds, newId])] }));
      return { ...old, parties: nextParties, claims: nextClaims, stages: nextStages };
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/30 p-4 sm:p-5" data-testid="guided-step1">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-blue-700">Step 1 가이드 설정</p>
        <p className="mt-1 text-sm text-slate-600">확정 최종 심급, 병합·특수 절차, 신청인/피신청인 명단과 변호사 선임 그룹을 선택하면 이후 단계의 심급과 조건부 입력란이 자동으로 구성됩니다.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <fieldset className="rounded-lg border border-slate-200 bg-white p-3.5">
          <legend className="px-1 text-xs font-semibold text-slate-700">1-1. 확정된 최종 심급 선택</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['1심 확정', '2심(항소심) 확정', '3심(상고심) 확정'] as const).map(option => (
              <label key={option} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${finalInstance === option ? 'border-blue-400 bg-blue-50 font-semibold text-blue-950' : 'border-slate-200 text-slate-700'}`}>
                <input
                  type="radio"
                  name="guided-final-instance"
                  className="h-4 w-4 accent-blue-700"
                  checked={finalInstance === option}
                  onChange={() => applyFinalInstance(option)}
                />
                {option}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">선택 시 Step 2~4에 해당 심급 절차(제1심·항소심·상고심 및 확정신청)가 자동 구성됩니다.</p>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-200 bg-white p-3.5">
          <legend className="px-1 text-xs font-semibold text-slate-700">1-1. 신청인의 본안 지위</legend>
          <div className="mt-1 flex flex-wrap gap-2">
            {(['원고(반소피고)', '피고(반소원고)', '승계인'] as const).map(standing => (
              <label key={standing} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${primaryStanding === standing ? 'border-blue-400 bg-blue-50 font-semibold text-blue-950' : 'border-slate-200 text-slate-700'}`}>
                <input
                  type="radio"
                  name="guided-applicant-standing"
                  className="h-4 w-4 accent-blue-700"
                  checked={primaryStanding === standing}
                  onChange={() => applyApplicantStanding(standing)}
                />
                {standing}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">신청인 측 기본 본안 지위와 피신청인 상대 지위를 설정합니다.</p>
        </fieldset>
      </div>

      <fieldset className="rounded-lg border border-slate-200 bg-white p-3.5">
        <legend className="px-1 text-xs font-semibold text-slate-700">1-2. 병합 및 특수 절차 여부 (복수 선택 가능)</legend>
        <div className="mt-1 grid gap-2.5 sm:grid-cols-3">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-700" checked={counterclaim} onChange={e => toggleCounterclaim(e.target.checked)} />
            <span><strong className="font-semibold">반소(예비적 반소 포함) 병합 사건</strong><span className="mt-0.5 block text-xs text-slate-500">Step 2·3에 반소 소가 및 분리 부담 입력 노출</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-700" checked={remand} onChange={e => toggleRemand(e.target.checked)} />
            <span><strong className="font-semibold">파기환송 사건 포함</strong><span className="mt-0.5 block text-xs text-slate-500">환송심 절차 추가 및 환송 전·후 항소심 보수 검토 표시</span></span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 text-sm text-slate-800 hover:bg-slate-50">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-blue-700" checked={respondentSetoff} onChange={e => toggleRespondentSetoff(e.target.checked)} />
            <span><strong className="font-semibold">피신청인의 상계 의견서 제출</strong><span className="mt-0.5 block text-xs text-slate-500">체크 시 쌍방 상계 적용 및 피신청인 지출 비용 탭 활성화</span></span>
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">1-3. 신청인 측 목록 ({applicants.length}명)</p>
              <p className="text-xs text-slate-500">성명·본안 지위 및 변호사 선임 그룹을 지정합니다.</p>
            </div>
            <button type="button" className={secondary} onClick={() => addSideParty('신청인')}>+ 신청인 행 추가</button>
          </div>
          {!applicants.length ? (
            <p className="rounded bg-slate-50 p-3 text-xs text-slate-500">등록된 신청인이 없습니다. ‘+ 신청인 행 추가’를 누르세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr><th className="p-2">성명/법인명</th><th className="p-2">본안 지위</th><th className="p-2">변호사 선임 그룹</th></tr>
                </thead>
                <tbody>
                  {applicants.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="p-1.5">
                        <input
                          type="text"
                          aria-label={`신청인 ${p.name || ''} 성명`}
                          placeholder="예: 박경임"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          value={p.name}
                          onChange={e => onChange(old => ({ ...old, parties: old.parties.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) }))}
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          aria-label={`신청인 ${p.name || ''} 지위`}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          value={p.mainRole}
                          onChange={e => onChange(old => ({ ...old, parties: old.parties.map(x => x.id === p.id ? { ...x, mainRole: e.target.value } : x) }))}
                        >
                          {['원고', '피고', '승계인', '독립당사자참가인', '보조참가인', '기타'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5">
                        <select
                          aria-label={`신청인 ${p.name || ''} 선임 그룹`}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          value={currentMandateGroup(p.id)}
                          onChange={e => assignMandateGroup(p.id, e.target.value)}
                        >
                          {mandateOptionsForParty(p.id).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3.5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">1-3. 피신청인 측 목록 ({respondents.length}명)</p>
              <p className="text-xs text-slate-500">1심 분리확정 체크 시 2·3심 참여 당사자에서 자동 제외합니다.</p>
            </div>
            <button type="button" className={secondary} onClick={() => addSideParty('피신청인')}>+ 피신청인 행 추가</button>
          </div>
          {!respondents.length ? (
            <p className="rounded bg-slate-50 p-3 text-xs text-slate-500">등록된 피신청인이 없습니다. ‘+ 피신청인 행 추가’를 누르세요.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr><th className="p-2">성명/법인명</th><th className="p-2">본안 지위</th><th className="p-2">1심 분리확정</th><th className="p-2">변호사 선임 그룹</th></tr>
                </thead>
                <tbody>
                  {respondents.map(p => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="p-1.5">
                        <input
                          type="text"
                          aria-label={`피신청인 ${p.name || ''} 성명`}
                          placeholder="예: 이종현"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          value={p.name}
                          onChange={e => onChange(old => ({ ...old, parties: old.parties.map(x => x.id === p.id ? { ...x, name: e.target.value } : x) }))}
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          aria-label={`피신청인 ${p.name || ''} 지위`}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          value={p.mainRole}
                          onChange={e => onChange(old => ({ ...old, parties: old.parties.map(x => x.id === p.id ? { ...x, mainRole: e.target.value } : x) }))}
                        >
                          {['피고', '원고', '보조참가인', '승계인', '독립당사자참가인', '기타'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5 text-center">
                        <input
                          type="checkbox"
                          aria-label={`피신청인 ${p.name || ''} 1심 분리확정`}
                          className="h-4 w-4 accent-blue-700"
                          checked={isFirstInstanceSeparated(p.id)}
                          onChange={e => toggleFirstInstanceSeparated(p.id, e.target.checked)}
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          aria-label={`피신청인 ${p.name || ''} 선임 그룹`}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs"
                          value={currentMandateGroup(p.id)}
                          onChange={e => assignMandateGroup(p.id, e.target.value)}
                        >
                          {mandateOptionsForParty(p.id).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
