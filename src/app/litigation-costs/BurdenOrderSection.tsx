'use client';

import React, { useState, useEffect } from 'react';
import { type Party, type Rule, type Stage, stageLevel } from './caseInput';

type Props = {
  stages: Stage[];
  parties: Party[];
  label: (p: Party) => string;
  onUpdateStageRules: (stageId: string, rules: Rule[]) => void;
  onUpdateAllStageRules: (rules: Rule[]) => void;
};

const uid = () => crypto.randomUUID();

export function BurdenOrderSection({
  stages,
  parties,
  label,
  onUpdateStageRules,
  onUpdateAllStageRules,
}: Props) {
  const applicants = parties.filter((p) => p.group === '신청인');
  const respondents = parties.filter((p) => p.group === '피신청인');

  const appIds = applicants.map((p) => p.id);
  const respIds = respondents.map((p) => p.id);

  const applicantNames = applicants.map((p) => label(p)).join(', ') || '신청인';
  const respondentNames = respondents.map((p) => label(p)).join(', ') || '피신청인';

  // 심급별 주문 분리 여부
  const [splitByStage, setSplitByStage] = useState<boolean>(() => {
    if (stages.length <= 1) return false;
    const firstRule = stages[0]?.rules?.[0];
    if (!firstRule) return false;
    // 심급 간 rule이 서로 다르면 true로 시작
    return stages.some((s) => {
      const r = s.rules?.[0];
      if (!r) return false;
      return r.mode !== firstRule.mode || r.n !== firstRule.n || r.d !== firstRule.d;
    });
  });

  // 일괄 적용 모드의 설정 상태
  const currentFirstRule = stages[0]?.rules?.[0];
  const initialMode = currentFirstRule?.mode || '2측 전부 부담';
  const initialN = currentFirstRule?.n || '1';
  const initialD = currentFirstRule?.d || '1';

  const [globalMode, setGlobalMode] = useState<string>(initialMode);
  // 비율 입력 방식: 'percent' (백분율) | 'fraction' (분수)
  const [rateFormat, setRateFormat] = useState<'percent' | 'fraction'>('percent');
  const [globalPercent, setGlobalPercent] = useState<string>(() => {
    if (initialD && initialD !== '0' && initialN) {
      const p = Math.round((Number(initialN) / Number(initialD)) * 100);
      return isNaN(p) ? '40' : String(p);
    }
    return '40';
  });
  const [globalN, setGlobalN] = useState<string>(initialN || '1');
  const [globalD, setGlobalD] = useState<string>(initialD || '2');

  // 개별 심급별 비율 입력 형식
  const [stageRateFormats, setStageRateFormats] = useState<Record<string, 'percent' | 'fraction'>>({});
  const [stagePercents, setStagePercents] = useState<Record<string, string>>({});

  // 일괄 적용 모드 업데이트 전파
  const applyGlobalOrder = (
    mode: string,
    format: 'percent' | 'fraction',
    percentVal: string,
    nVal: string,
    dVal: string
  ) => {
    let finalN = nVal;
    let finalD = dVal;

    if (mode === '비율로 분담') {
      if (format === 'percent') {
        const p = Math.min(100, Math.max(0, parseInt(percentVal || '0', 10)));
        finalN = String(p);
        finalD = '100';
      } else {
        finalN = nVal || '1';
        finalD = dVal || '1';
      }
    }

    stages.forEach((s, idx) => {
      const sLevel = stageLevel(s, idx);
      const newRule: Rule = {
        id: s.rules?.[0]?.id || uid(),
        left: appIds,
        right: respIds,
        mode,
        n: finalN,
        d: finalD,
        scope: sLevel === '1심' ? '1심 비용' : '소송총비용',
        claim: s.counter ? '본소와 반소' : '',
        leftMethod: '균분',
        rightMethod: '균분',
      };
      onUpdateStageRules(s.id, [newRule]);
    });
  };

  const handleGlobalModeChange = (newMode: string) => {
    setGlobalMode(newMode);
    applyGlobalOrder(newMode, rateFormat, globalPercent, globalN, globalD);
  };

  const handleGlobalPercentChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '');
    const num = Math.min(100, Math.max(0, parseInt(cleaned || '0', 10)));
    const str = cleaned === '' ? '' : String(num);
    setGlobalPercent(str);
    applyGlobalOrder(globalMode, 'percent', str, globalN, globalD);
  };

  const handleGlobalFractionChange = (n: string, d: string) => {
    setGlobalN(n);
    setGlobalD(d);
    applyGlobalOrder(globalMode, 'fraction', globalPercent, n, d);
  };

  // 개별 심급 업데이트
  const updateSingleStageRule = (
    stageId: string,
    sLevel: string,
    patch: Partial<Rule>,
    currentRule?: Rule
  ) => {
    const existing: Rule = currentRule || {
      id: uid(),
      left: appIds,
      right: respIds,
      mode: '2측 전부 부담',
      n: '1',
      d: '1',
      scope: sLevel + ' 비용',
      claim: '',
      leftMethod: '균분',
      rightMethod: '균분',
    };
    const updated = { ...existing, ...patch };
    onUpdateStageRules(stageId, [updated]);
  };

  return (
    <section
      id="cost-burden-orders"
      className="space-y-4 rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
      aria-label="판결의 소송비용부담 주문"
    >
      {/* 1. 섹션 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">판결의 소송비용부담 주문</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            본안 확정 판결문 주문에 기재된 소송비용 부담 내용을 설정합니다. 판결문 문구에 맞춰 바로 선택하실 수 있습니다.
          </p>
        </div>

        {stages.length > 1 && (
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition">
            <input
              type="checkbox"
              checked={splitByStage}
              onChange={(e) => {
                const checked = e.target.checked;
                setSplitByStage(checked);
                if (!checked) {
                  // 일괄 모드로 복귀 시 현재 global 설정으로 전 심급 동기화
                  applyGlobalOrder(globalMode, rateFormat, globalPercent, globalN, globalD);
                }
              }}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            심급별로 판결 주문이 다릅니다 (항소/상고 기각 등)
          </label>
        )}
      </div>

      {/* 2. [모드 1] 전체 심급 일괄 적용 모드 */}
      {!splitByStage && (
        <div className="space-y-4 rounded-lg bg-slate-50/70 p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">
              최종 확정 판결 주문 (전체 {stages.length}개 심급 일괄 적용)
            </span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
              일괄 적용
            </span>
          </div>

          {/* 부담 방식 빠른 선택 버튼 그룹 */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => handleGlobalModeChange('2측 전부 부담')}
              className={`rounded-lg border p-3 text-left transition-all ${
                globalMode === '2측 전부 부담'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs ring-2 ring-blue-600/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">상대방 전부 부담 (100%)</div>
              <div className="mt-1 text-xs font-normal text-slate-500">
                {respondentNames} 전부 부담
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleGlobalModeChange('1측 전부 부담')}
              className={`rounded-lg border p-3 text-left transition-all ${
                globalMode === '1측 전부 부담'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs ring-2 ring-blue-600/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">신청인 전부 부담 (100%)</div>
              <div className="mt-1 text-xs font-normal text-slate-500">
                {applicantNames} 전부 부담
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleGlobalModeChange('비율로 분담')}
              className={`rounded-lg border p-3 text-left transition-all ${
                globalMode === '비율로 분담'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs ring-2 ring-blue-600/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">비율로 분담 (일부 분담)</div>
              <div className="mt-1 text-xs font-normal text-slate-500">
                % 또는 분자/분모로 지정
              </div>
            </button>

            <button
              type="button"
              onClick={() => handleGlobalModeChange('각자 부담')}
              className={`rounded-lg border p-3 text-left transition-all ${
                globalMode === '각자 부담'
                  ? 'border-blue-600 bg-blue-50 text-blue-950 font-bold shadow-xs ring-2 ring-blue-600/20'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="text-sm">각자 부담 (상환 없음)</div>
              <div className="mt-1 text-xs font-normal text-slate-500">
                각자 지출한 비용 부담
              </div>
            </button>
          </div>

          {/* 비율로 분담 세부 입력 영역 */}
          {globalMode === '비율로 분담' && (
            <div className="mt-3 rounded-lg border border-blue-200 bg-white p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-slate-800">분담 비율 입력 방식 선택</span>
                <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setRateFormat('percent');
                      applyGlobalOrder(globalMode, 'percent', globalPercent, globalN, globalD);
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      rateFormat === 'percent'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    % (백분율)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRateFormat('fraction');
                      applyGlobalOrder(globalMode, 'fraction', globalPercent, globalN, globalD);
                    }}
                    className={`px-3 py-1 rounded-md font-medium transition ${
                      rateFormat === 'fraction'
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    분수 (분모 / 분자)
                  </button>
                </div>
              </div>

              {rateFormat === 'percent' ? (
                <div className="space-y-2">
                  <div className="grid gap-3 sm:grid-cols-2 items-center">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        신청인({applicantNames}) 부담 비율
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={globalPercent}
                          onChange={(e) => handleGlobalPercentChange(e.target.value)}
                          placeholder="예: 40"
                          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 pr-8 text-base text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        <span className="absolute right-3 text-sm font-bold text-slate-500">%</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        상대방({respondentNames}) 부담 비율 (자동)
                      </label>
                      <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm font-bold text-blue-900">
                        {100 - (parseInt(globalPercent || '0', 10) || 0)} %
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 bg-slate-50 rounded p-2">
                    주문 예시: &ldquo;소송 총비용 중 {globalPercent || 0}%는 {applicantNames}이(가), 나머지는 {respondentNames}이(가) 각 부담한다.&rdquo;
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        신청인 부담 분자
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={globalN}
                        onChange={(e) => handleGlobalFractionChange(e.target.value.replace(/\D/g, ''), globalD)}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        분모
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={globalD}
                        onChange={(e) => handleGlobalFractionChange(globalN, e.target.value.replace(/\D/g, ''))}
                        className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-base text-slate-900 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-xs font-medium text-slate-700">
                        상대방 부담:{' '}
                        <strong className="ml-1 text-blue-900 font-bold">
                          {Number(globalD) > Number(globalN)
                            ? `${Number(globalD) - Number(globalN)}/${globalD}`
                            : '0'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. [모드 2] 심급별 분리 지정 모드 */}
      {splitByStage && (
        <div className="space-y-3">
          {stages.map((s, idx) => {
            const sLevel = stageLevel(s, idx);
            const r = s.rules?.[0];
            const currentMode = r?.mode || '2측 전부 부담';
            const fmt = stageRateFormats[s.id] || 'percent';
            const curP = stagePercents[s.id] ?? (r?.d && r?.d !== '0' ? String(Math.round((Number(r.n) / Number(r.d)) * 100)) : '40');

            const handleSinglePercent = (val: string) => {
              const cleaned = val.replace(/\D/g, '');
              const num = Math.min(100, Math.max(0, parseInt(cleaned || '0', 10)));
              const str = cleaned === '' ? '' : String(num);
              setStagePercents((prev) => ({ ...prev, [s.id]: str }));
              updateSingleStageRule(s.id, sLevel, { n: str || '0', d: '100', mode: '비율로 분담' }, r);
            };

            return (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{sLevel} 판결 주문</span>
                    {s.number && (
                      <span className="text-xs text-slate-500">({s.number})</span>
                    )}
                  </div>
                  {sLevel !== '1심' && (
                    <select
                      value={r?.scope || (sLevel + ' 비용')}
                      onChange={(e) => updateSingleStageRule(s.id, sLevel, { scope: e.target.value }, r)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      <option value={sLevel + ' 비용'}>{sLevel} 비용만 적용</option>
                      <option value="소송총비용">소송총비용 주문</option>
                    </select>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  <button
                    type="button"
                    onClick={() => updateSingleStageRule(s.id, sLevel, { mode: '2측 전부 부담' }, r)}
                    className={`rounded border p-2 text-xs text-left transition ${
                      currentMode === '2측 전부 부담'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    상대방 전부 부담 (100%)
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSingleStageRule(s.id, sLevel, { mode: '1측 전부 부담' }, r)}
                    className={`rounded border p-2 text-xs text-left transition ${
                      currentMode === '1측 전부 부담'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    신청인 전부 부담 (100%)
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSingleStageRule(s.id, sLevel, { mode: '비율로 분담' }, r)}
                    className={`rounded border p-2 text-xs text-left transition ${
                      currentMode === '비율로 분담'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    비율로 분담
                  </button>

                  <button
                    type="button"
                    onClick={() => updateSingleStageRule(s.id, sLevel, { mode: '각자 부담' }, r)}
                    className={`rounded border p-2 text-xs text-left transition ${
                      currentMode === '각자 부담'
                        ? 'border-blue-600 bg-blue-50 text-blue-900 font-bold ring-1 ring-blue-600'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    각자 부담
                  </button>
                </div>

                {/* 심급별 비율 분담 상세 */}
                {currentMode === '비율로 분담' && (
                  <div className="rounded border border-blue-200 bg-white p-3 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-xs font-semibold text-slate-700">분담 비율 설정</span>
                      <div className="inline-flex rounded border border-slate-300 p-0.5 bg-slate-50 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setStageRateFormats((prev) => ({ ...prev, [s.id]: 'percent' }))}
                          className={`px-2 py-0.5 rounded ${
                            fmt === 'percent' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600'
                          }`}
                        >
                          %
                        </button>
                        <button
                          type="button"
                          onClick={() => setStageRateFormats((prev) => ({ ...prev, [s.id]: 'fraction' }))}
                          className={`px-2 py-0.5 rounded ${
                            fmt === 'fraction' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-600'
                          }`}
                        >
                          분수
                        </button>
                      </div>
                    </div>

                    {fmt === 'percent' ? (
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div className="relative flex items-center">
                          <input
                            type="text"
                            inputMode="numeric"
                            value={curP}
                            onChange={(e) => handleSinglePercent(e.target.value)}
                            placeholder="신청인 비율"
                            className="h-9 w-full rounded border border-slate-300 px-2.5 pr-6 text-sm text-slate-900"
                          />
                          <span className="absolute right-2 text-xs text-slate-500 font-bold">%</span>
                        </div>
                        <div className="text-xs font-medium text-slate-700">
                          상대방 부담: <strong className="text-blue-900">{100 - (parseInt(curP || '0', 10) || 0)}%</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r?.n || '1'}
                          onChange={(e) => updateSingleStageRule(s.id, sLevel, { n: e.target.value.replace(/\D/g, '') }, r)}
                          placeholder="분자"
                          className="h-9 rounded border border-slate-300 px-2 text-sm"
                        />
                        <input
                          type="text"
                          inputMode="numeric"
                          value={r?.d || '2'}
                          onChange={(e) => updateSingleStageRule(s.id, sLevel, { d: e.target.value.replace(/\D/g, '') }, r)}
                          placeholder="분모"
                          className="h-9 rounded border border-slate-300 px-2 text-sm"
                        />
                        <div className="text-xs font-medium text-slate-700">
                          상대방: <strong className="text-blue-900">
                            {Number(r?.d) > Number(r?.n) ? `${Number(r?.d) - Number(r?.n)}/${r?.d}` : '0'}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
