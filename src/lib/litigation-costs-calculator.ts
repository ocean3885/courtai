import { findAutoFeeConflict, getCostRecognition, type AttorneyFeeCalculation } from './litigation-costs-attorney-fee';
import type { LitigationDraft, Cost } from './litigation-costs-draft';
import type { AllocationNode, AllocationWeight } from './litigation-costs-calculation-types';

type Rational = { n: bigint; d: bigint };
export type ExactAmount = { numerator: string; denominator: string };
const ZERO = BigInt(0), ONE = BigInt(1);
const abs = (v: bigint) => v < ZERO ? -v : v;
function rational(n: bigint, d = ONE): Rational {
  if (d <= ZERO) throw new Error('분모는 0보다 커야 합니다.');
  let a = abs(n), b = d;
  while (b !== ZERO) { const r = a % b; a = b; b = r; }
  const g = a || ONE;
  return { n: n / g, d: d / g };
}
const add = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const multiply = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
const subtract = (a: Rational, b: Rational) => add(a, { n: -b.n, d: b.d });
const equal = (a: Rational, b: Rational) => a.n * b.d === b.n * a.d;
const sum = (values: Rational[]) => values.reduce(add, rational(ZERO));
const exact = (v: Rational): ExactAmount => ({ numerator: String(v.n), denominator: String(v.d) });
function integer(value: string, label: string): bigint {
  if (!/^\d{1,16}$/.test(value) || BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label}: 0 이상의 안전한 정수 금액·가중치를 입력하세요.`);
  return BigInt(value);
}
function rounded(v: Rational, unit: bigint) { return (v.n < ZERO ? -ONE : ONE) * (abs(v.n) / (v.d * unit)) * unit; }
export function formatExact(value: ExactAmount): string {
  const n = BigInt(value.numerator), d = BigInt(value.denominator);
  const whole = abs(n) / d, rest = abs(n) % d;
  const decimal = (rest * BigInt(10000) / d).toString().padStart(4, '0');
  return `${n < ZERO ? '-' : ''}${whole.toLocaleString('ko-KR')}${rest ? `.${decimal}…` : ''}원`;
}

export type AllocationTrace = {
  costId: string; costTitle: string; ownerId: string; otherId: string; claimId: string; rulingId: string;
  recognized: string; basisGroupId: string; basisValue: string; path: string[];
  allocated: ExactAmount; burden: ExactAmount; reimbursable: ExactAmount; included: boolean;
};
export type PairResult = {
  applicantId: string; respondentId: string; forward: ExactAmount; reverse: ExactAmount;
  forwardRounded: string | null; reverseRounded: string | null; net: string;
};
export type CalculationResult = {
  status: 'blocked' | 'preview'; errors: string[]; warnings: string[]; traces: AllocationTrace[]; rows: PairResult[];
  attorneyFees: { costId: string; calculation: AttorneyFeeCalculation }[];
  budgets: { costId: string; recognized: string; allocated: ExactAmount }[];
};

// 명시한 배분 계획과 선택한 보수 별표를 실행한다. 주문 해석·소가의 법률상 적정성은 추론하지 않는다.
export function calculateAllocation(draft: LitigationDraft): CalculationResult {
  const result: CalculationResult = { status: 'blocked', errors: [], warnings: [], traces: [], rows: [], budgets: [], attorneyFees: [] };
  const warningSet = new Set<string>();
  function fail(message: string): never { throw new Error(message); }
  try {
    const c = draft.calculation;
    const map = <T extends { id: string }>(rows: T[], label: string) => {
      if (rows.some(x => !x.id) || new Set(rows.map(x => x.id)).size !== rows.length) fail(`${label}: 빈 식별자나 중복 항목이 있습니다.`);
      return new Map(rows.map(x => [x.id, x]));
    };
    const parties = map(draft.parties, '당사자'), claims = map(draft.claims, '청구'), stages = map(draft.stages, '절차');
    const rulings = map(draft.rulings, '부담 관계'), mandates = map(draft.mandates, '대리 관계');
    const values = map(c.values, '가액'), groups = map(c.groups, '산정 그룹');
    map(draft.costs, '비용');
    if (!draft.costs.length) fail('계산할 비용이 없습니다.');
    const feeConflict = findAutoFeeConflict(draft.costs);
    if (feeConflict) fail(feeConflict);
    if (!c.rounding.unit || !c.rounding.timing) fail('절사 단위와 시점을 선택하세요.');
    if (c.setoff === 'unreviewed') fail('비용 상계 계산 방식을 선택하세요.');
    if (c.setoff === 'mutual' && (draft.review.responseState === '기간 내 미제출' || draft.review.setoff === '제111조 제2항 예외 검토')) fail('상대방 미제출·제111조 제2항 예외와 쌍방 상계 설정이 충돌합니다. 계산 방식을 다시 검토하세요.');
    if (draft.review.responseState === '미확인' || draft.review.responseState === '추가 확인 필요') warningSet.add('상대방 최고·자료 제출 사실이 미확인입니다. 선택한 상계 방식을 가정한 가계산입니다.');
    if (draft.review.setoff === '미검토' || draft.review.setoff === '개별 검토 필요') warningSet.add('법정상계의 적용 요건·예외를 별도로 확인해야 합니다.');
    const checkRefs = (ids: string[], available: Map<string, unknown>, label: string) => {
      if (new Set(ids).size !== ids.length || ids.some(id => !available.has(id))) fail(`${label}: 중복되거나 삭제된 대상이 연결되어 있습니다.`);
    };
    for (const claim of claims.values()) {
      checkRefs(claim.claimantIds, parties, `${claim.title} 청구자`); checkRefs(claim.opponentIds, parties, `${claim.title} 상대방`);
      if (!claim.claimantIds.length || !claim.opponentIds.length || claim.claimantIds.some(id => claim.opponentIds.includes(id))) fail(`${claim.title}: 청구자와 상대방의 누락·겹침을 확인하세요.`);
    }
    for (const stage of stages.values()) checkRefs(stage.partyIds, parties, `${stage.type} 참여 당사자`);
    const groupAmounts = new Map<string, bigint>();
    for (const v of c.values) {
      if (!v.label.trim() || !stages.has(v.stageId) || !claims.has(v.claimId)) fail('가액의 명칭·절차·청구 연결을 확인하세요.');
      checkRefs([v.partyId, v.opponentId].filter(Boolean), parties, `${v.label} 당사자`);
      if (v.partyId && v.opponentId && v.partyId === v.opponentId) fail(`${v.label}: 당사자와 상대방이 같습니다.`);
      const claim = claims.get(v.claimId)!;
      if ([v.partyId, v.opponentId].filter(Boolean).some(p => ![...claim.claimantIds, ...claim.opponentIds].includes(p))) fail(`${v.label}: 청구와 무관한 당사자가 연결되어 있습니다.`);
      integer(v.amount, v.label);
    }
    for (const g of c.groups) {
      if (!g.label.trim() || !stages.has(g.stageId) || !g.valueIds.length || !g.claimIds.length) fail('산정 그룹의 명칭·절차·청구·가액을 입력하세요.');
      checkRefs(g.claimIds, claims, `${g.label} 청구`); checkRefs(g.valueIds, values, `${g.label} 가액`);
      if (g.valueIds.some(id => values.get(id)!.stageId !== g.stageId || !g.claimIds.includes(values.get(id)!.claimId))) fail(`${g.label}: 가액의 절차 또는 청구 범위가 그룹과 다릅니다.`);
      if (g.mandateId) {
        const m = mandates.get(g.mandateId);
        if (!m || !m.stageIds.includes(g.stageId) || g.claimIds.some(id => !m.claimIds.includes(id))) fail(`${g.label}: 수임 범위와 연결된 절차·청구를 확인하세요.`);
      }
      const ns = g.valueIds.map(id => integer(values.get(id)!.amount, g.label));
      groupAmounts.set(g.id, g.method === '최다액' ? ns.reduce((a, b) => a > b ? a : b, ZERO) : ns.reduce((a, b) => a + b, ZERO));
    }
    if (new Set(c.plans.map(p => p.costId)).size !== c.plans.length) fail('한 비용에 배분 계획이 중복되어 있습니다.');
    if (c.plans.some(p => !draft.costs.some(cost => cost.id === p.costId))) fail('삭제된 비용의 배분 계획이 남아 있습니다.');
    const missing = draft.costs.filter(cost => !c.plans.some(p => p.costId === cost.id));
    if (missing.length) fail(`배분 계획이 없는 비용 ${missing.length}건: ${missing.slice(0, 3).map(x => x.title || '이름 없음').join(', ')}. 메모에서 산식을 추정하지 않습니다.`);
    const pairs = new Map<string, { applicantId: string; respondentId: string; forward: Rational; reverse: Rational }>();
    function weight(w: AllocationWeight, cost: Cost): { value: Rational; claims: string[]; text: string } {
      if (w.kind === 'fraction') {
        const n = integer(w.numerator, '가중치 분자'), den = integer(w.denominator, '가중치 분모');
        if (den === ZERO) fail('배분 가중치의 분모는 0일 수 없습니다.');
        return { value: rational(n, den), claims: [], text: `${n}/${den}` };
      }
      const record = w.kind === 'value' ? values.get(w.refId) : groups.get(w.refId);
      if (!record || record.stageId !== cost.stageId) fail(`${cost.title}: 가중치의 가액·그룹이 없거나 비용과 다른 절차입니다.`);
      const n = w.kind === 'value' ? integer(values.get(w.refId)!.amount, cost.title) : groupAmounts.get(w.refId)!;
      return { value: rational(n), claims: w.kind === 'value' ? [values.get(w.refId)!.claimId] : groups.get(w.refId)!.claimIds, text: `${record.label} ${n.toLocaleString('ko-KR')}` };
    }
    for (const cost of draft.costs) {
      if (!stages.has(cost.stageId)) fail(`${cost.title}: 발생 절차를 확인하세요.`);
      checkRefs(cost.payerIds, parties, `${cost.title} 귀속자`); checkRefs(cost.targetIds, parties, `${cost.title} 배분 대상`);
      checkRefs(cost.claimIds, claims, `${cost.title} 청구`);
      const recognition = getCostRecognition(cost);
      if (recognition.status === 'blocked') fail(`${cost.title}: ${recognition.errors.join(' ')}`);
      const recognized = BigInt(recognition.recognized);
      if (recognition.attorneyFee) {
        if (!['제1심', '항소심', '상고심'].includes(stages.get(cost.stageId)!.type)) fail(`${cost.title}: 자동 보수는 제1심·항소심·상고심 본안 비용에만 적용합니다.`);
        result.attorneyFees.push({ costId: cost.id, calculation: recognition.attorneyFee });
      }
      const claimed = integer(cost.claimed, `${cost.title} 청구액`), refund = integer(cost.refund, `${cost.title} 환급액`);
      if (refund > claimed) fail(`${cost.title}: 환급액이 청구액보다 큽니다.`);
      if (recognized > claimed - refund && !cost.note.trim()) fail(`${cost.title}: 순청구액 초과 인정 사유를 입력하세요.`);
      if (!cost.evidence.trim()) warningSet.add('증빙·기록 참조가 없는 비용이 있습니다.');
      const plan = c.plans.find(p => p.costId === cost.id)!;
      let basisValue = '';
      if (cost.kind === '변호사보수' && !cost.attorneyFee && !plan.basisGroupId) fail(`${cost.title}: 보수 산정 기초 그룹을 연결하세요.`);
      if (cost.attorneyFee) basisValue = cost.attorneyFee.litigationValue;
      if (plan.basisGroupId && !cost.attorneyFee) {
        const group = groups.get(plan.basisGroupId), mandate = group?.mandateId ? mandates.get(group.mandateId) : null;
        if (!group || group.stageId !== cost.stageId) fail(`${cost.title}: 산정 기초 그룹의 절차를 확인하세요.`);
        if (cost.kind === '변호사보수' && (!mandate || cost.payerIds.some(id => !mandate.partyIds.includes(id)))) fail(`${cost.title}: 공동대리 산정 그룹의 의뢰인 범위를 확인하세요.`);
        basisValue = String(groupAmounts.get(group.id));
      }
      const nodes = new Set<string>();
      function walk(node: AllocationNode, value: Rational, path: string[], allowedClaims: string[], depth: number): Rational {
        if (!node.id || nodes.has(node.id) || depth > 8 || nodes.size >= 256) fail(`${cost.title}: 배분 단계의 중복·깊이를 확인하세요.`);
        nodes.add(node.id);
        if (node.type === 'split') {
          if (!node.label.trim() || !node.branches.length || node.branches.length > 50 || new Set(node.branches.map(b => b.id)).size !== node.branches.length) fail(`${cost.title}: 배분 단계 명칭과 분기를 확인하세요.`);
          const ws = node.branches.map(b => node.method === 'equal' ? { value: rational(ONE), claims: [], text: '동일 가중치 1' } : weight(b.weight, cost));
          const total = sum(ws.map(w => w.value));
          if (total.n === ZERO) fail(`${cost.title}: 배분 가중치 합계가 0입니다.`);
          return sum(node.branches.map((b, i) => {
            if (!b.label.trim()) fail(`${cost.title}: 분기 명칭을 입력하세요.`);
            const share = multiply(ws[i].value, rational(total.d, total.n));
            const scope = ws[i].claims.length ? ws[i].claims.filter(id => !allowedClaims.length || allowedClaims.includes(id)) : allowedClaims;
            if (ws[i].claims.length && !scope.length) fail(`${cost.title}: 가중치와 비용의 청구 범위가 다릅니다.`);
            return walk(b.node, multiply(value, share), [...path, `${node.label} → ${b.label}: ${ws[i].text}, 비율 ${share.n}/${share.d}`], scope, depth + 1);
          }));
        }
        const owner = parties.get(node.ownerId), other = parties.get(node.otherId), ruling = rulings.get(node.rulingId);
        if (!owner || !other || node.ownerId === node.otherId || !ruling) fail(`${cost.title}: 말단의 귀속자·상대방·부담 관계를 선택하세요.`);
        if (![owner.id, other.id].every(id => stages.get(cost.stageId)!.partyIds.includes(id))) fail(`${cost.title}: 비용 관계의 당사자가 이 절차에 참여하지 않습니다.`);
        if (!cost.payerIds.includes(owner.id) || !cost.targetIds.includes(owner.id) || !cost.targetIds.includes(other.id)) fail(`${cost.title}: 말단의 당사자가 비용 귀속·배분 대상과 다릅니다.`);
        if (node.claimId) {
          const claim = claims.get(node.claimId);
          if (!claim || (allowedClaims.length && !allowedClaims.includes(node.claimId))) fail(`${cost.title}: 말단 청구와 배분 범위가 다릅니다.`);
          if (!((claim.claimantIds.includes(owner.id) && claim.opponentIds.includes(other.id)) || (claim.opponentIds.includes(owner.id) && claim.claimantIds.includes(other.id)))) fail(`${cost.title}: 이 청구의 상대방 관계가 아닙니다.`);
        } else if (cost.claimIds.length) fail(`${cost.title}: 말단 청구를 선택하세요.`);
        if (ruling.payerIds.length !== 1 || ruling.receiverIds.length !== 1) fail('복수·연대 부담 관계의 자동 분해는 아직 지원하지 않습니다. 관계별 검토가 필요합니다.');
        checkRefs(ruling.stageIds, stages, '부담 주문 절차'); checkRefs(ruling.claimIds, claims, '부담 주문 청구');
        const direct = ruling.payerIds[0] === other.id && ruling.receiverIds[0] === owner.id;
        const reverse = ruling.payerIds[0] === owner.id && ruling.receiverIds[0] === other.id;
        if (!direct && !reverse) fail(`${cost.title}: 말단과 부담 주문의 당사자가 다릅니다.`);
        const application = stages.get(cost.stageId)!.type === '확정신청';
        if (!ruling.stageIds.includes(cost.stageId) && !(application && plan.applicationBasis.trim())) fail(`${cost.title}: 부담 주문 적용 절차가 다릅니다. 신청비용은 준용 근거를 기록하세요.`);
        if (node.claimId && !ruling.claimIds.includes(node.claimId)) fail(`${cost.title}: 부담 주문 적용 청구가 다릅니다.`);
        if (!ruling.text.trim()) fail(`${cost.title}: 주문 원문·해석이 비어 있습니다.`);
        if (ruling.status !== '검토함') warningSet.add('주문의 적용 범위·효력이 미확인인 부담 관계를 가정하여 계산했습니다.');
        const rn = integer(ruling.numerator, '부담 비율 분자'), rd = integer(ruling.denominator, '부담 비율 분모');
        if (rd === ZERO || rn > rd) fail('부담 비율은 0~1의 분수여야 하며 분모는 0일 수 없습니다.');
        const revN = integer(ruling.reverseNumerator, '역방향 부담 비율 분자'), revD = integer(ruling.reverseDenominator, '역방향 부담 비율 분모');
        if (revD === ZERO || revN > revD) fail('역방향 부담 비율을 0~1의 분수로 확인하세요. 정방향의 보완 비율을 추정하지 않습니다.');
        const burden = direct ? rational(rn, rd) : rational(revN, revD);
        const reimbursable = multiply(value, burden);
        const applicant = owner.applicationRole === '신청인' ? owner : other.applicationRole === '신청인' ? other : null;
        const respondent = owner.applicationRole === '피신청인' ? owner : other.applicationRole === '피신청인' ? other : null;
        if (!applicant || !respondent || applicant.id === respondent.id) fail('현재 계산은 신청인·피신청인 사이의 쌍별 관계만 지원합니다. 신청 대상 외 당사자의 몫을 임의로 제외하지 않습니다.');
        const forward = owner.id === applicant.id;
        const included = c.setoff !== 'applicantOnly' || forward;
        result.traces.push({ costId: cost.id, costTitle: cost.title, ownerId: owner.id, otherId: other.id, claimId: node.claimId, rulingId: ruling.id, recognized: String(recognized), basisGroupId: cost.attorneyFee ? '' : plan.basisGroupId, basisValue, path, allocated: exact(value), burden: exact(burden), reimbursable: exact(reimbursable), included });
        const key = JSON.stringify([applicant.id, respondent.id]);
        if (!pairs.has(key)) pairs.set(key, { applicantId: applicant.id, respondentId: respondent.id, forward: rational(ZERO), reverse: rational(ZERO) });
        const pair = pairs.get(key)!;
        if (included) pair[forward ? 'forward' : 'reverse'] = add(pair[forward ? 'forward' : 'reverse'], reimbursable);
        return value;
      }
      const allocated = walk(plan.root, rational(recognized), [], cost.claimIds, 0);
      if (!equal(allocated, rational(recognized))) fail(`${cost.title}: 배분 전후 비용 총액이 일치하지 않습니다.`);
      result.budgets.push({ costId: cost.id, recognized: String(recognized), allocated: exact(allocated) });
    }
    const unit = BigInt(c.rounding.unit);
    for (const pair of pairs.values()) {
      const f = rounded(pair.forward, unit), r = rounded(pair.reverse, unit);
      const net = c.rounding.timing === 'direction' ? f - r : rounded(subtract(pair.forward, pair.reverse), unit);
      result.rows.push({ applicantId: pair.applicantId, respondentId: pair.respondentId, forward: exact(pair.forward), reverse: exact(pair.reverse), forwardRounded: c.rounding.timing === 'direction' ? String(f) : null, reverseRounded: c.rounding.timing === 'direction' ? String(r) : null, net: String(net) });
    }
    if (draft.meta.requested) {
      const requested = integer(draft.meta.requested, '신청총액');
      const applicantTotal = result.rows.reduce((n, row) => n + (BigInt(row.net) > ZERO ? BigInt(row.net) : ZERO), ZERO);
      if (applicantTotal > requested) fail('가계산 합계가 신청총액을 초과합니다. 신청 범위별 한도 배분은 아직 지원하지 않으므로 결과를 보류합니다.');
    } else warningSet.add('신청총액 상한은 미입력입니다. 신청 범위·선행 확정결정을 별도로 검토하세요.');
    warningSet.add(result.attorneyFees.length ? '입력 소가·실비와 선택한 별표로 산입액을 자동 계산한 가계산입니다. 소가·지급의무의 적정성, 적용 시점·특례·재량 조정 및 결정문 확정은 별도 검토합니다.' : '직원 인정액과 명시한 배분 계획을 실행한 가계산입니다. 소가의 법률상 적정성·보수 한도·재량 조정·결정문 확정을 대신하지 않습니다.');
    result.status = 'preview';
    result.warnings = [...warningSet];
    return result;
  } catch (error) {
    return { status: 'blocked', errors: [error instanceof Error ? error.message : '계산 설정을 확인하세요.'], warnings: [...warningSet], traces: [], rows: [], budgets: [], attorneyFees: [] };
  }
}
