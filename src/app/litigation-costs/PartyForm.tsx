'use client';

import { useState, type ReactNode } from 'react';
import { ordinaryFeeLimit } from './ordinaryFee';

const groups = ['신청인', '피신청인', '신청외'] as const;
type Group = (typeof groups)[number];
type Party = { id: string; group: Group; name: string };
type Member = { role: string; number: string; value: string; counterRole: string };
type Cost = {
  id: string;
  payer: string;
  kind: string;
  paid: string;
  refund: string;
  shared: boolean;
  ids: string[];
  method: string;
  evidence: string;
  title: string;
};
type Rule = {
  id: string;
  left: string[];
  right: string[];
  mode: string;
  n: string;
  d: string;
  scope: string;
  claim: string;
  leftMethod: string;
  rightMethod: string;
};
type Stage = {
  id: string;
  number: string;
  value: string;
  members: Record<string, Member>;
  counter: string;
  counterValue: string;
  costs: Cost[];
  rules: Rule[];
};
const levels = ['1심', '항소심', '상고심'];
const roleOptions = [
  ['원고', '피고'],
  ['항소인', '피항소인', '항소인 겸 피항소인'],
  ['상고인', '피상고인', '상고인 겸 피상고인'],
];
const splitOptions = ['균분', '소가 비율'];
const initialParties: Party[] = [
  { id: 'a', name: '', group: '신청인' },
  { id: 'b', name: '', group: '피신청인' },
];
const member = (): Member => ({ role: '', number: '', value: '', counterRole: '' });
const stage = (id: string): Stage => ({
  id,
  number: '',
  value: '',
  members: {},
  counter: '',
  counterValue: '',
  costs: [],
  rules: [],
});
const uid = () => crypto.randomUUID();
const button =
  'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50';
const input =
  'mt-1 block w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-900';
const grid = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3';
const box = 'space-y-4 rounded-lg border border-slate-200 bg-white p-4';
const small = 'text-sm text-slate-600';

function Field({
  label,
  value,
  change,
  numeric = false,
}: {
  label: string;
  value: string;
  change: (v: string) => void;
  numeric?: boolean;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className={input}
        value={value}
        inputMode={numeric ? 'numeric' : 'text'}
        aria-invalid={numeric && value !== '' && natural(value) === null}
        onChange={(e) => change(e.target.value)}
      />
      {numeric && value !== '' && natural(value) === null && (
        <span className="text-xs text-red-700">0 이상의 정수를 입력하세요 (최대 16자리).</span>
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
    <label className="block text-sm font-medium">
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
function Section({ title, children, open }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className={box}>
      <summary className="cursor-pointer text-lg font-semibold">{title}</summary>
      {children}
    </details>
  );
}
function Checks({
  title,
  choices,
  selected,
  change,
}: {
  title: string;
  choices: { id: string; label: string }[];
  selected: string[];
  change: (ids: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {choices.map((p) => (
          <label key={p.id} className={small}>
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={(e) =>
                change(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))
              }
            />{' '}
            {p.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
const natural = (v: string) => (/^\d{1,16}$/.test(v) ? BigInt(v) : null);
const won = (v: bigint) => v.toLocaleString('ko-KR') + '원';

export default function PartyForm() {
  const [parties, setParties] = useState<Party[]>(initialParties);
  const [stages, setStages] = useState<Stage[]>(() => [
    { ...stage('first'), members: { a: member(), b: member() } },
  ]);
  const [applicationCosts, setApplicationCosts] = useState<Cost[]>([]);
  const [reviews, setReviews] = useState<Record<string, { submission?: string; treatment?: string }>>({});
  const [notice, setNotice] = useState('');
  const [fullyOpen, setFullyOpen] = useState(false);
  const label = (p: Party) =>
    [p.group, parties.filter((q) => q.group === p.group).findIndex((q) => q.id === p.id) + 1, p.name]
      .filter(Boolean)
      .join(' ');
  const side = (p: Party) => p.group === '신청인';
  function patchStage(id: string, patch: Partial<Stage>) {
    setStages((old) => old.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addParty(group: Group) {
    const id = uid();
    setParties((old) => [...old, { id, group, name: '' }]);
    setStages((old) =>
      old.map((s, i) => (i === 0 ? { ...s, members: { ...s.members, [id]: member() } } : s))
    );
  }
  function referenced(s: Stage, id: string) {
    return (
      s.costs.some((c) => c.payer === id || c.ids.includes(id)) ||
      s.rules.some((r) => [...r.left, ...r.right].includes(id))
    );
  }
  function dropParty(p: Party) {
    if (
      Object.values(reviews[p.id] || {}).some(Boolean) ||
      stages.some((s) => referenced(s, p.id) || Object.values(s.members[p.id] || {}).some(Boolean)) ||
      applicationCosts.some((c) => c.payer === p.id)
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
  function newCost(payer: string, kind: string): Cost {
    return {
      id: uid(),
      payer,
      kind,
      paid: '',
      refund: '0',
      shared: false,
      ids: [],
      method: '',
      evidence: '',
      title: '',
    };
  }
  function costEditor(c: Cost, update: (patch: Partial<Cost>) => void, remove: () => void, s?: Stage) {
    const paid = natural(c.paid),
      refund = natural(c.refund);
    const net = paid !== null && refund !== null && paid >= refund ? paid - refund : null;
    const eligible = parties.filter((p) => s?.members[p.id]);
    const weights = c.ids.map((id) =>
      c.method === '균분' ? BigInt(1) : natural(s?.members[id]?.value || '')
    );
    const sum = weights.reduce<bigint>((total, w) => total + (w ?? BigInt(0)), BigInt(0));
    const value = natural(s?.value || '');
    const feeLimit =
      s && c.kind === '변호사보수' && !s.counter && !c.shared && parties.length === 2 && value !== null
        ? ordinaryFeeLimit(value)
        : null;
    return (
      <div key={c.id} className={box}>
        <div className="flex items-center justify-between">
          <strong>{c.kind}</strong>
          <button className={button} onClick={remove}>
            항목 삭제
          </button>
        </div>
        {c.kind === '기타 비용' && (
          <Field label="비용명" value={c.title} change={(title) => update({ title })} />
        )}
        <div className={grid}>
          <Field
            numeric
            label={c.kind === '변호사보수' ? '해당 심급 실지급 보수 (원)' : '납부액 (원)'}
            value={c.paid}
            change={(paid) => update({ paid })}
          />
          {c.kind === '송달료' && (
            <Field numeric label="환급액 (원)" value={c.refund} change={(refund) => update({ refund })} />
          )}
        </div>
        {c.paid !== '' && (
          <p className={small}>{net === null ? '납부액과 환급액을 확인하세요.' : '실지출액 ' + won(net)}</p>
        )}
        {feeLimit !== null && net !== null && (
          <p className={small}>
            일반 본안 별표 기준 (2020.12.28.) · 한도 {won(feeLimit)}와 실비 {won(net)} 중 작은 금액{' '}
            {won(feeLimit < net ? feeLimit : net)}
          </p>
        )}
        {s && eligible.length > 1 && (
          <label className="block text-sm">
            <input
              type="checkbox"
              checked={c.shared}
              onChange={(e) => update({ shared: e.target.checked, ids: [], method: '' })}
            />{' '}
            여러 당사자에게 지출 비용 안분
          </label>
        )}
        {s && c.shared && (
          <>
            <Checks
              title="비용 귀속 당사자"
              choices={eligible.map((p) => ({ id: p.id, label: label(p) }))}
              selected={c.ids}
              change={(ids) => update({ ids })}
            />
            <Pick
              label="지출 비용 안분 기준"
              value={c.method}
              options={splitOptions}
              change={(method) => update({ method })}
            />
            <p className={small}>
              {c.ids.length < 2
                ? '대상 당사자를 두 명 이상 선택하세요.'
                : !c.method
                  ? '안분 기준을 선택하세요.'
                  : weights.includes(null) || !sum
                    ? '대상 당사자의 심급별 소가를 확인하세요.'
                    : c.ids
                        .map((id, i) => {
                          const weight = weights[i]!;
                          const share =
                            net !== null && (net * weight) % sum === BigInt(0)
                              ? ' = ' + won((net * weight) / sum)
                              : '';
                          return (
                            label(parties.find((p) => p.id === id)!) +
                            ' ' +
                            (net === null ? '' : won(net) + ' × ') +
                            weight +
                            '/' +
                            sum +
                            share
                          );
                        })
                        .join(' · ')}
            </p>
          </>
        )}
        <details>
          <summary className="cursor-pointer text-sm">증빙 문서·쪽수</summary>
          <Field label="증빙 참조" value={c.evidence} change={(evidence) => update({ evidence })} />
        </details>
      </div>
    );
  }
  return (
    <div
      className="space-y-4"
      onClickCapture={() => {
        if (notice) setNotice('');
      }}
    >
      <div className="flex justify-end">
        <button
          className={button}
          onClick={(e) => {
            const next = !fullyOpen;
            e.currentTarget
              .closest('main')
              ?.querySelectorAll<HTMLDetailsElement>('[data-case-form] details')
              .forEach((d) => {
                d.open = next;
              });
            setFullyOpen(next);
          }}
        >
          {fullyOpen ? '전체 접기' : '전체 펼치기'}
        </button>
      </div>
      <Section title="사건·당사자" open>
        <div className={grid}>
          {['신청 법원', '확정신청 사건번호'].map((x) => (
            <label className="text-sm" key={x}>
              {x}
              <input className={input} />
            </label>
          ))}
        </div>
        {groups.map((group) => (
          <div key={group} className="space-y-2 border-t border-slate-200 pt-3">
            {parties
              .filter((p) => p.group === group)
              .map((p) => (
                <div className="flex items-end gap-2" key={p.id}>
                  <div className="max-w-md flex-1">
                    <Field
                      label={label({ ...p, name: '' }) + ' 이름'}
                      value={p.name}
                      change={(name) =>
                        setParties((old) => old.map((q) => (q.id === p.id ? { ...q, name } : q)))
                      }
                    />
                  </div>
                  {(group === '신청외' || parties.filter((q) => q.group === group).length > 1) && (
                    <button className={button} aria-label={label(p) + ' 삭제'} onClick={() => dropParty(p)}>
                      삭제
                    </button>
                  )}
                </div>
              ))}
            <button className={button} onClick={() => addParty(group)}>
              + {group} 추가
            </button>
          </div>
        ))}
      </Section>
      {stages.map((s, index) => {
        const people = parties.filter((p) => s.members[p.id]);
        const choices = people.map((p) => ({
          id: p.id,
          label: [label(p), s.members[p.id].role, s.members[p.id].number].filter(Boolean).join(' '),
        }));
        const changeMember = (id: string, patch: Partial<Member>) =>
          patchStage(s.id, { members: { ...s.members, [id]: { ...s.members[id], ...patch } } });
        const priorCounter = stages.slice(0, index).some((t) => t.counter);
        return (
          <Section key={s.id} title={levels[index] + ' · 참여자와 비용'} open>
            {index > 0 && index === stages.length - 1 && (
              <button
                className={button}
                onClick={() => {
                  if (s.number || s.value || s.counter || people.length || s.costs.length || s.rules.length) {
                    setNotice('사건번호·참여자 등 입력한 심급 정보를 먼저 정리하세요.');
                    return;
                  }
                  setStages(stages.slice(0, -1));
                }}
              >
                {levels[index]} 삭제
              </button>
            )}
            <div className={grid}>
              <Field
                label={levels[index] + ' 사건번호'}
                value={s.number}
                change={(number) => patchStage(s.id, { number })}
              />
              <Field
                numeric
                label="본소 소가 (원)"
                value={s.value}
                change={(value) => patchStage(s.id, { value })}
              />
            </div>
            {index > 0 && (
              <Checks
                title={levels[index] + ' 참여 당사자'}
                choices={parties.map((p) => ({ id: p.id, label: label(p) }))}
                selected={people.map((p) => p.id)}
                change={(ids) => {
                  const removed = people.find((p) => !ids.includes(p.id));
                  if (
                    removed &&
                    (referenced(s, removed.id) || Object.values(s.members[removed.id]).some(Boolean))
                  ) {
                    setNotice('연결된 심급 정보·비용·부담 관계를 먼저 정리하세요.');
                    return;
                  }
                  patchStage(s.id, {
                    members: Object.fromEntries(ids.map((id) => [id, s.members[id] || member()])),
                  });
                }}
              />
            )}
            <details open={s.counter ? true : undefined}>
              <summary className="cursor-pointer text-sm font-medium">반소</summary>
              <Pick
                label="이 심급의 반소"
                value={s.counter}
                options={priorCounter ? ['기존 반소 심판 대상', '이 심급에서 제기'] : ['이 심급에서 제기']}
                change={(counter) => {
                  if (
                    !counter &&
                    (s.rules.some((r) => r.claim) ||
                      s.counterValue ||
                      people.some((p) => s.members[p.id].counterRole) ||
                      stages.slice(index + 1).some((t) => t.counter === '기존 반소 심판 대상'))
                  ) {
                    setNotice('반소 소가·당사자·부담 관계 및 후속 심급 연결을 먼저 확인하세요.');
                    return;
                  }
                  patchStage(s.id, { counter });
                }}
              />
              {s.counter && (
                <Field
                  numeric
                  label="반소 소가 (원)"
                  value={s.counterValue}
                  change={(counterValue) => patchStage(s.id, { counterValue })}
                />
              )}
            </details>
            {people.map((p) => (
              <div key={p.id} className={box}>
                <h3 className="font-semibold">{label(p)}</h3>
                <div className={grid}>
                  <Pick
                    label="판결문상 지위"
                    value={s.members[p.id].role}
                    options={roleOptions[index]}
                    change={(role) => changeMember(p.id, { role })}
                  />
                  <Field
                    numeric
                    label="판결문상 번호 (있는 경우)"
                    value={s.members[p.id].number}
                    change={(number) => changeMember(p.id, { number })}
                  />
                  {(parties.length > 2 ||
                    s.members[p.id].value ||
                    s.costs.some((c) => c.shared && c.method === '소가 비율')) && (
                    <Field
                      numeric
                      label="안분용 당사자 소가 (원)"
                      value={s.members[p.id].value}
                      change={(value) => changeMember(p.id, { value })}
                    />
                  )}
                  {s.counter && (
                    <Pick
                      label="반소 지위"
                      value={s.members[p.id].counterRole}
                      options={['반소원고', '반소피고']}
                      change={(counterRole) => changeMember(p.id, { counterRole })}
                    />
                  )}
                </div>
                {s.costs
                  .filter((c) => c.payer === p.id)
                  .map((c) =>
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
                <div className="flex flex-wrap gap-2">
                  {['변호사보수', '인지대', '송달료', '기타 비용'].map((kind) => (
                    <button
                      className={button}
                      key={kind}
                      disabled={
                        kind === '변호사보수' && s.costs.some((c) => c.payer === p.id && c.kind === kind)
                      }
                      onClick={() => patchStage(s.id, { costs: [...s.costs, newCost(p.id, kind)] })}
                    >
                      + {kind}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {s.rules.map((r, i) => {
              const edit = (patch: Partial<Rule>) =>
                patchStage(s.id, { rules: s.rules.map((v) => (v.id === r.id ? { ...v, ...patch } : v)) });
              const n = natural(r.n),
                d = natural(r.d);
              const sideLabel = (ids: string[]) =>
                ids.map((id) => choices.find((p) => p.id === id)?.label).join(', ');
              return (
                <div key={r.id} className={box}>
                  <div className="flex justify-between">
                    <strong>부담 관계 {i + 1}</strong>
                    <button
                      className={button}
                      onClick={() => patchStage(s.id, { rules: s.rules.filter((v) => v.id !== r.id) })}
                    >
                      관계 삭제
                    </button>
                  </div>
                  {index > 0 && (
                    <Pick
                      label="주문 적용 범위"
                      value={r.scope}
                      options={[levels[index] + ' 비용', '소송총비용']}
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
                  {(['left', 'right'] as const).map((key, j) => {
                    const other = key === 'left' ? r.right : r.left;
                    const method = key === 'left' ? 'leftMethod' : 'rightMethod';
                    return (
                      <div key={key}>
                        {people.length === 2 && r.left.length === 1 && r.right.length === 1 ? (
                          <p className={small}>
                            {j + 1}측 · {sideLabel(r[key])}
                          </p>
                        ) : (
                          <Checks
                            title={j + 1 + '측 당사자'}
                            choices={choices.filter((c) => !other.includes(c.id))}
                            selected={r[key]}
                            change={(ids) => edit({ [key]: ids })}
                          />
                        )}
                        {r[key].length > 1 && (
                          <Pick
                            label={j + 1 + '측 내부 부담 안분 기준'}
                            options={splitOptions}
                            value={r[method]}
                            change={(v) => edit({ [method]: v })}
                          />
                        )}
                      </div>
                    );
                  })}
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
                  {r.mode === '비율로 분담' && (
                    <>
                      <div className={grid}>
                        <Field numeric label="1측 부담 분자" value={r.n} change={(n) => edit({ n })} />
                        <Field numeric label="분모" value={r.d} change={(d) => edit({ d })} />
                      </div>
                      <p className={small}>
                        {n !== null && d !== null && d > 0 && n <= d
                          ? '2측 부담 ' + (d - n) + '/' + d
                          : '0 이상이고 분모 이하인 분자를 입력하세요. 분모는 1 이상입니다.'}
                      </p>
                    </>
                  )}
                </div>
              );
            })}
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
                      scope: levels[index] + ' 비용',
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
          </Section>
        );
      })}
      {stages.length < levels.length && (
        <button className={button} onClick={() => setStages([...stages, stage(uid())])}>
          + {levels[stages.length]} 추가
        </button>
      )}
      <Section title="확정신청 비용">
        {parties.filter(side).map((p) => (
          <div key={p.id} className="space-y-3">
            <h3 className="font-medium">{label(p)}</h3>
            {applicationCosts
              .filter((c) => c.payer === p.id)
              .map((c) =>
                costEditor(
                  c,
                  (patch) =>
                    setApplicationCosts(
                      applicationCosts.map((v) => (v.id === c.id ? { ...v, ...patch } : v))
                    ),
                  () => setApplicationCosts(applicationCosts.filter((v) => v.id !== c.id))
                )
              )}
            <div className="flex gap-2">
              {['인지대', '송달료', '기타 비용'].map((kind) => (
                <button
                  key={kind}
                  className={button}
                  onClick={() => setApplicationCosts([...applicationCosts, newCost(p.id, kind)])}
                >
                  + {kind}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Section>
      <Section title="비용자료 제출·상계 검토">
        {parties
          .filter((p) => p.group === '피신청인')
          .map((p) => (
            <div key={p.id} className={box}>
              <strong>{label(p)}</strong>
              <div className={grid}>
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
                  change={(treatment) => setReviews({ ...reviews, [p.id]: { ...reviews[p.id], treatment } })}
                />
                {reviews[p.id]?.submission === '기간 내 미제출' &&
                  reviews[p.id]?.treatment === '쌍방 비용 상계' && (
                    <p className={small}>기간 내 미제출 상태입니다. 상계 적용 근거를 다시 확인하세요.</p>
                  )}
              </div>
            </div>
          ))}
      </Section>
      {notice && (
        <p role="status" className="sticky bottom-3 rounded-lg bg-amber-100 p-3">
          {notice}
        </p>
      )}
    </div>
  );
}
