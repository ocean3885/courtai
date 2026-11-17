// 입력·검토 모델. 직원 인정액의 배분 가계산과 법률상 확정 처리를 구분한다.
import { emptyCalculation, isCalculationInput, type CalculationInput } from './litigation-costs-calculation-types';
import { findAutoFeeConflict, getCostRecognition, isAttorneyFeeInput, type AttorneyFeeInput } from './litigation-costs-attorney-fee';
import { sampleCalculation } from './litigation-costs-sample-calculation';
export type Party = { id: string; name: string; mainRole: string; applicationRole: string };
export type Claim = { id: string; kind: string; title: string; claimantIds: string[]; opponentIds: string[]; value: string; relation: string };
export type Stage = { id: string; type: string; number: string; partyIds: string[]; appealScope: string; changes: string };
export type Ruling = { id: string; text: string; stageIds: string[]; claimIds: string[]; payerIds: string[]; receiverIds: string[]; numerator: string; denominator: string; reverseNumerator: string; reverseDenominator: string; status: string };
export type Mandate = { id: string; name: string; partyIds: string[]; stageIds: string[]; claimIds: string[]; start: string; end: string; endReason: string; agreed: string; paid: string; evidence: string };
export type Cost = { attorneyFee?: AttorneyFeeInput; id: string; title: string; kind: string; stageId: string; payerIds: string[]; claimIds: string[]; claimed: string; refund: string; recognized: string; evidence: string; allocation: string; targetIds: string[]; reason: string; note: string };
export type LitigationDraft = {
  version: 2;
  referenceCaseId?: string;
  meta: { title: string; court: string; number: string; applicationDate: string; requested: string; scopeNote: string };
  parties: Party[]; claims: Claim[]; stages: Stage[]; rulings: Ruling[]; mandates: Mandate[]; costs: Cost[];
  review: { highestDate: string; responseDeadline: string; responseState: string; setoff: string; rounding: string; notes: string };
  calculation: CalculationInput;
};

export const STORAGE_KEY = 'courtai.litigation-costs.draft.v2';
export const LEGACY_STORAGE_KEY = 'courtai.litigation-costs.draft.v1';
export const stageTypes = ['제1심', '항소심', '상고심', '환송심', '재상고심', '확정신청'];
export const allocationTypes = ['미정', '직접 귀속', '소가 비례', '인원 균등', '개별 검토'];
export const money = (n: number) => n.toLocaleString('ko-KR') + '원';
export function amount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
}
export function blankDraft(): LitigationDraft {
  return {
    version: 2,
    meta: { title: '', court: '', number: '', applicationDate: '', requested: '', scopeNote: '' },
    parties: [], claims: [], stages: [], rulings: [], mandates: [], costs: [],
    review: { highestDate: '', responseDeadline: '', responseState: '미확인', setoff: '미검토', rounding: '미확정', notes: '' },
    calculation: emptyCalculation(),
  };
}

const strings = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
function fields(x: unknown, names: string[], lists: string[] = []) {
  return strings(x) && names.every(k => typeof x[k] === 'string' && (x[k] as string).length <= 20000)
    && lists.every(k => Array.isArray(x[k]) && (x[k] as unknown[]).length <= 500 && (x[k] as unknown[]).every(v => typeof v === 'string' && v.length <= 200));
}
export function parseDraft(raw: string): LitigationDraft {
  if (raw.length > 2_000_000) throw new Error('초안 크기가 너무 큽니다.');
  const x: unknown = JSON.parse(raw);
  const fail = () => { throw new Error('저장된 초안의 형식이 맞지 않습니다.'); };
  if (!strings(x) || ![1, 2].includes(Number(x.version)) || typeof x.version !== 'number') return fail();
  if (x.referenceCaseId !== undefined && (typeof x.referenceCaseId !== 'string' || x.referenceCaseId.length > 200)) return fail();
  const shape: Record<string, [string[], string[]]> = {
    parties: [['id', 'name', 'mainRole', 'applicationRole'], []],
    claims: [['id', 'kind', 'title', 'value', 'relation'], ['claimantIds', 'opponentIds']],
    stages: [['id', 'type', 'number', 'appealScope', 'changes'], ['partyIds']],
    rulings: [['id', 'text', 'numerator', 'denominator', 'status'], ['stageIds', 'claimIds', 'payerIds', 'receiverIds']],
    mandates: [['id', 'name', 'start', 'end', 'endReason', 'agreed', 'paid', 'evidence'], ['partyIds', 'stageIds', 'claimIds']],
    costs: [['id', 'title', 'kind', 'stageId', 'claimed', 'refund', 'recognized', 'evidence', 'allocation', 'reason', 'note'], ['payerIds', 'claimIds', 'targetIds']],
  };
  if (!fields(x.meta, ['title', 'court', 'number', 'applicationDate', 'requested', 'scopeNote']) ||
      !fields(x.review, ['highestDate', 'responseDeadline', 'responseState', 'setoff', 'rounding', 'notes'])) return fail();
  for (const [key, [names, lists]] of Object.entries(shape)) {
    const values = x[key];
    if (!Array.isArray(values) || values.length > 500 || !values.every(v => fields(v, names, lists))) return fail();
    const ids = values.map(v => v.id);
    if (ids.some(id => !id) || new Set(ids).size !== ids.length) return fail();
  }
  if (!(x.costs as Record<string, unknown>[]).every(c => c.attorneyFee === undefined || isAttorneyFeeInput(c.attorneyFee))) return fail();
  if (x.version === 1) return { ...x, version: 2, rulings: (x.rulings as Record<string, unknown>[]).map(r => ({ ...r, reverseNumerator: '', reverseDenominator: '' })), calculation: emptyCalculation() } as unknown as LitigationDraft;
  if (!(x.rulings as unknown[]).every(r => fields(r, ['reverseNumerator', 'reverseDenominator']))) return fail();
  if (!isCalculationInput(x.calculation)) return fail();
  return x as unknown as LitigationDraft;
}

export type ReviewIssue = { step: number; message: string };
export function reviewDraft(d: LitigationDraft): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const add = (step: number, message: string) => issues.push({ step, message });
  const ids = (rows: { id: string }[]) => new Set(rows.map(x => x.id));
  const parties = ids(d.parties), claims = ids(d.claims), stages = ids(d.stages);
  function refs(step: number, label: string, selected: string[], available: Set<string>) {
    if (!selected.length) add(step, `${label}: 대상을 선택하세요.`);
    else if (new Set(selected).size !== selected.length || selected.some(id => !available.has(id))) add(step, `${label}: 연결된 대상을 확인하세요.`);
  }
  function numeric(step: number, label: string, v: string, required = true) {
    if ((!v && required) || (v && amount(v) === null)) add(step, `${label}: 0 이상의 정수 금액을 입력하세요.`);
  }
  if (!d.meta.court.trim() || !d.meta.number.trim()) add(0, '신청 법원과 사건번호를 확인하세요.');
  numeric(0, '신청총액', d.meta.requested, false);
  if (d.parties.length < 2) add(0, '신청인과 피신청인을 포함해 당사자를 등록하세요.');
  if (!d.parties.some(p => p.applicationRole === '신청인') || !d.parties.some(p => p.applicationRole === '피신청인')) add(0, '신청인·피신청인 지정을 확인하세요.');
  d.parties.forEach((p, i) => { if (!p.name.trim()) add(0, `당사자 ${i + 1}: 표시명을 입력하세요.`); });
  if (!d.claims.length) add(0, '본소·반소 청구를 등록하세요.');
  d.claims.forEach((c, i) => {
    const label = c.title || `청구 ${i + 1}`;
    if (!c.title.trim()) add(0, `${label}: 청구명을 입력하세요.`);
    numeric(0, `${label} 소가`, c.value);
    refs(0, `${label} 청구자`, c.claimantIds, parties); refs(0, `${label} 상대방`, c.opponentIds, parties);
    if (c.claimantIds.some(id => c.opponentIds.includes(id))) add(0, `${label}: 청구자와 상대방이 겹칩니다.`);
  });
  if (!d.stages.length) add(1, '심급 또는 절차를 등록하세요.');
  d.stages.forEach(s => {
    if (!s.number.trim()) add(1, `${s.type}: 사건번호를 입력하세요.`);
    refs(1, `${s.type} 참여 당사자`, s.partyIds, parties);
    if (!stageTypes.includes(s.type)) add(1, '절차 유형을 확인하세요.');
  });
  if (!d.rulings.length) add(2, '비용 부담 주문과 적용 관계를 등록하세요.');
  d.rulings.forEach((r, i) => {
    const label = `부담 관계 ${i + 1}`;
    if (!r.text.trim()) add(2, `${label}: 주문 원문을 입력하세요.`);
    refs(2, `${label} 절차`, r.stageIds, stages); refs(2, `${label} 청구`, r.claimIds, claims);
    refs(2, `${label} 부담자`, r.payerIds, parties); refs(2, `${label} 상대방`, r.receiverIds, parties);
    if (r.payerIds.some(id => r.receiverIds.includes(id))) add(2, `${label}: 부담자와 상대방이 겹칩니다.`);
    const n = amount(r.numerator), den = amount(r.denominator);
    if (n === null || den === null || den === 0 || n > den) add(2, `${label}: 부담 비율은 0~1의 분수여야 합니다. 분모는 0일 수 없습니다.`);
    const rev = amount(r.reverseNumerator), revDen = amount(r.reverseDenominator);
    if (rev === null || revDen === null || revDen === 0 || rev > revDen) add(2, `${label}: 역방향 부담 비율을 0~1의 분수로 확인하세요.`);
    if (r.status !== '검토함') add(2, `${label}: 주문의 적용 범위·효력을 확인하세요.`);
  });
  d.mandates.forEach((m, i) => {
    const label = m.name || `대리 관계 ${i + 1}`;
    refs(3, `${label} 의뢰인`, m.partyIds, parties); refs(3, `${label} 절차`, m.stageIds, stages); refs(3, `${label} 청구`, m.claimIds, claims);
    numeric(3, `${label} 약정보수`, m.agreed, false); numeric(3, `${label} 지급보수`, m.paid, false);
    if (m.start && m.end && m.start > m.end) add(3, `${label}: 종료일이 선임일보다 빠릅니다.`);
  });
  if (!d.costs.length) add(3, '비용 항목을 등록하세요.');
  const feeConflict = findAutoFeeConflict(d.costs);
  if (feeConflict) add(3, feeConflict);
  d.costs.forEach((c, i) => {
    const label = c.title || `비용 ${i + 1}`;
    if (!c.title.trim()) add(3, `${label}: 항목명을 입력하세요.`);
    refs(3, `${label} 절차`, c.stageId ? [c.stageId] : [], stages);
    refs(3, `${label} 지출·귀속 당사자`, c.payerIds, parties);
    // 신청비용 등 청구와 무관한 비용은 청구 연결을 선택하지 않을 수 있다.
    if (c.claimIds.length) refs(3, `${label} 청구`, c.claimIds, claims);
    numeric(3, `${label} 청구액`, c.claimed); numeric(3, `${label} 환급액`, c.refund);
    const recognition = getCostRecognition(c);
    if (c.attorneyFee) { if (recognition.status === 'blocked') recognition.errors.forEach(message => add(3, `${label}: ${message}`)); }
    else numeric(3, `${label} 직원 검토 인정액`, c.recognized);
    if (c.attorneyFee && !['제1심', '항소심', '상고심'].includes(d.stages.find(s => s.id === c.stageId)?.type || '')) add(3, `${label}: 자동 보수는 제1심·항소심·상고심 본안 비용에 적용합니다.`);
    const gross = amount(c.claimed), refund = amount(c.refund);
    if (gross !== null && refund !== null && refund > gross) add(3, `${label}: 환급액이 청구액보다 큽니다.`);
    if (!c.evidence.trim()) add(3, `${label}: 증빙 또는 기록 참조를 입력하세요.`);
    if (c.allocation === '미정' || !allocationTypes.includes(c.allocation)) add(4, `${label}: 배분 방식을 검토하세요.`);
    refs(4, `${label} 배분 대상`, c.targetIds, parties);
    if (!c.reason.trim()) add(4, `${label}: 배분 근거·순서를 입력하세요.`);
    const recognized = recognition.status === 'ready' ? amount(recognition.recognized) : null;
    if (gross !== null && refund !== null && recognized !== null && recognized > gross - refund && !c.note.trim()) add(4, `${label}: 순청구액 초과 인정의 검토 사유를 입력하세요.`);
  });
  if (d.review.responseState === '미확인') add(4, '상대방 최고·자료 제출 상태를 확인하세요.');
  if (d.review.setoff === '미검토') add(4, '비용 법정상계의 적용 또는 예외를 검토하세요.');
  if (!['1', '10'].includes(d.calculation.rounding.unit) || !['direction', 'net'].includes(d.calculation.rounding.timing)) add(4, '절사 단위와 적용 시점이 미확정입니다.');
  return issues;
}

export function isReferenced(d: LitigationDraft, id: string): boolean {
  const linked = (x: unknown): boolean => {
    if (Array.isArray(x)) return x.some(linked);
    if (!x || typeof x !== 'object') return false;
    return Object.entries(x).some(([key, value]) => key !== 'id' &&
      ((key.endsWith('Id') && value === id) || (key.endsWith('Ids') && Array.isArray(value) && value.includes(id)) || linked(value)));
  };
  return linked(d.calculation) || [...d.claims, ...d.stages, ...d.rulings, ...d.mandates, ...d.costs].some(row =>
    Object.entries(row).some(([key, value]) => key !== 'id' && (Array.isArray(value) ? value.includes(id) : key === 'stageId' && value === id)));
}

export function sampleDraft(): LitigationDraft {
  const d = blankDraft();
  const p = ['p1', 'p2', 'p3', 'p4'], defendants = ['A', 'B'], all = [...p, ...defendants];
  d.meta = { title: '검증 사례 · 본소·반소와 다수 당사자', court: '사례 법원', number: '2023카확○○○○○', applicationDate: '', requested: '', scopeNote: '2023.12.15. 첨부자료 별지 2. 익명화된 입력 예시이며 실제 사건이 아닙니다.' };
  d.parties = [...p.map((id, i) => ({ id, name: ['가', '나', '다', '라'][i], mainRole: '원고', applicationRole: '신청인' })), ...defendants.map(id => ({ id, name: id, mainRole: '피고', applicationRole: '피신청인' }))];
  d.claims = [
    { id: 'main', kind: '본소', title: '위자료 공동 지급 청구', claimantIds: p, opponentIds: defendants, value: '311706817', relation: '가 102,385,183 / 나 201,321,634 / 다·라 각 4,000,000원. 피고 사이 중복 청구. 보수용 소가와 안분 가중치는 별도 검토.' },
    { id: 'counter', kind: '반소', title: '치료비 등 연대 지급 청구', claimantIds: ['A'], opponentIds: ['p1', 'p2'], value: '24257250', relation: '본소와 목적이 다른 사례. B·다·라는 반소 비용의 대상이 아님.' },
  ];
  d.stages = [
    { id: 's1', type: '제1심', number: '2019가합○○○○○', partyIds: all, appealScope: '본소 일부승소, 반소 기각', changes: '항소심 감축 관련 소가 335,964,067원: 첨부자료의 채택값. 적용 법리 추가 검토.' },
    { id: 's2', type: '항소심', number: '2021나○○○○○', partyIds: all, appealScope: '피고 항소 182,579,375원 / 원고 부대항소 153,384,692원', changes: '청구감축 후 화해권고결정. 인지용 불복 범위와 보수용 소가 구별.' },
    { id: 'app', type: '확정신청', number: '2023카확○○○○○', partyIds: all, appealScope: '', changes: '' },
  ];
  d.rulings = defendants.flatMap(defendant => p.map((person, i) => ({
    id: `${defendant}-${person}`, text: i < 2 ? '가·나와 각 피고 사이의 소송총비용: 원고 30%, 해당 피고 70%. A와의 관계는 본소·반소를 통틀어 정함.' : '다·라와 각 피고 사이의 비용은 피고들이 부담한다.',
    stageIds: ['s1', 's2'], claimIds: defendant === 'A' && i < 2 ? ['main', 'counter'] : ['main'], payerIds: [defendant], receiverIds: [person], numerator: i < 2 ? '7' : '1', denominator: i < 2 ? '10' : '1', reverseNumerator: i < 2 ? '3' : '0', reverseDenominator: i < 2 ? '10' : '1', status: '미확인',
  })));
  d.mandates = [
    { id: 'mp', name: '원고 측 공동대리 (자료상 표기)', partyIds: p, stageIds: ['s1', 's2'], claimIds: ['main', 'counter'], start: '', end: '', endReason: '', agreed: '', paid: '', evidence: '첨부자료 별지 2. 계약서·선임일은 별도 자료 없음.' },
    { id: 'md', name: '피고 측 공동대리 (자료상 표기)', partyIds: defendants, stageIds: ['s1', 's2'], claimIds: ['main', 'counter'], start: '', end: '', endReason: '', agreed: '', paid: '', evidence: '첨부자료 별지 2. 1심 인정 보수 7,150,000원, 2심 4,050,000원.' },
  ];
  function cost(id: string, title: string, kind: string, stageId: string, payerIds: string[], claimIds: string[], claimed: number, refund: number, allocation: string, targetIds: string[], reason: string): Cost {
    return { id, title, kind, stageId, payerIds, claimIds, claimed: String(claimed), refund: String(refund), recognized: String(claimed - refund), evidence: '첨부자료 별지 2', allocation, targetIds, reason, note: '자료의 인정액을 입력한 사례. 운영 산식에 의한 자동 계산값이 아닙니다.' };
  }
  d.costs = [
    cost('p1fee', '원고 1심 변호사보수', '변호사보수', 's1', p, ['main', 'counter'], 11759640, 0, '개별 검토', all, '본소/반소 소가 비례 → 본소 청구자 소가 비례·피고 2명 균등. 반소는 가·나와 A만.'),
    cost('p1stamp', '원고 1심 인지대', '인지대', 's1', p, ['main'], 1171600, 0, '소가 비례', all, '본소 직접 귀속 → 원고별 소가 비례 → 피고 2명 균등.'),
    cost('p1service', '원고 1심 송달료', '송달료', 's1', p, ['main'], 135000, 104044, '인원 균등', all, '환급 후 본소 비용. 원고 4명·피고 2명.'),
    cost('p1expert', '원고 1심 감정료', '감정료', 's1', p, ['main'], 1600000, 400000, '인원 균등', all, '본소만 귀속. 원고 4명·피고 2명.'),
    cost('p2fee', '원고 항소심 변호사보수', '변호사보수', 's2', p, ['main', 'counter'], 11759640, 0, '개별 검토', all, '보수용 소가 335,964,067원. 1심과 같은 단계 배분.'),
    cost('p2stamp', '원고 항소심 순인지대', '인지대', 's2', p, ['main'], 451200, 0, '소가 비례', all, '자료의 환급 후 순액. 환급액을 다시 차감하지 않음.'),
    cost('d1fee', '피고 1심 변호사보수', '변호사보수', 's1', defendants, ['main', 'counter'], 7150000, 0, '개별 검토', all, '본소/반소 소가 비례. 본소는 원고별 가액·피고 2명, 반소는 A와 가·나.'),
    cost('d1stamp', '피고 1심 반소 인지대', '인지대', 's1', ['A'], ['counter'], 102600, 0, '직접 귀속', ['A', 'p1', 'p2'], '반소만 귀속, 가·나 2명 균등.'),
    cost('d1service', '피고 1심 반소 송달료', '송달료', 's1', ['A'], ['counter'], 141000, 108669, '인원 균등', ['A', 'p1', 'p2'], '반소만 귀속, 가·나 2명 균등.'),
    cost('d2fee', '피고 항소심 변호사보수', '변호사보수', 's2', defendants, ['main', 'counter'], 4050000, 0, '개별 검토', all, '보수용 소가 비례 후 관련 당사자별 배분.'),
    cost('d2stamp', '피고 항소심 순인지대', '인지대', 's2', defendants, ['main', 'counter'], 530050, 0, '개별 검토', all, '피고 불복 합계 182,579,375원을 분모로 본소·반소 안분. 이미 환급 반영된 순액.'),
    cost('d2service', '피고 항소심 송달료', '송달료', 's2', defendants, ['main', 'counter'], 244800, 142118, '개별 검토', all, '본소/반소 절반 배분 후 관련 인원으로 균등. 이 사례의 방식.'),
    cost('d2expert', '피고 항소심 감정료', '감정료', 's2', defendants, ['main'], 700000, 0, '인원 균등', all, '본소만 귀속, 원고 4명·피고 2명.'),
    cost('application', '확정신청 인지·송달료', '신청비용', 'app', p, [], 27293, 0, '인원 균등', all, '원고 4명·피고 2명에 배분한 후 가·나 70%, 다·라 100% 상대방 부담.'),
  ];
  d.review.notes = '방향별 10원 미만 절사 후 상계 시 8개 금액 재현. 총괄표 정밀 합계 1원 차이 미해결. 이 사례에는 상고·사임 사례가 포함되지 않음.';
  d.calculation = sampleCalculation();
  return d;
}

export const sampleReference = [
  ['A', '가', 2677030], ['A', '나', 4764820], ['A', '다', 307700], ['A', '라', 307700],
  ['B', '가', 2242480], ['B', '나', 4330270], ['B', '다', 307700], ['B', '라', 307700],
] as const;
export function matchesSample(d: LitigationDraft) { return JSON.stringify(d) === JSON.stringify(sampleDraft()); }
