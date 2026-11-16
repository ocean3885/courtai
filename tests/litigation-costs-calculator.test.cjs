const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { sampleDraft, blankDraft, parseDraft } = load('src/lib/litigation-costs-draft.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const reference = require('../docs/examples/litigation-costs-hwp-case.json');
// Python의 큰 정수 분자는 JS Number를 거치면 손실된다. 원문 정수를 문자열로 읽는다.
const precisionText = require('node:fs').readFileSync(require('node:path').join(__dirname, '../docs/examples/litigation-costs-hwp-results.json'), 'utf8');
const precisionReference = JSON.parse(precisionText.replace(/("(?:numerator|denominator)"\s*:\s*)(-?\d+)/g, '$1"$2"'));

function run(d) { const r = calculateAllocation(d); assert.equal(r.status, 'preview', JSON.stringify(r.errors)); return r; }
function row(result, debtor = 'A', creditor = 'p2') { return result.rows.find(r => r.respondentId === debtor && r.applicantId === creditor); }
function blocked(d, pattern) {
  const r = calculateAllocation(d);
  assert.equal(r.status, 'blocked'); assert.equal(r.rows.length, 0); assert.equal(r.traces.length, 0);
  assert.match(r.errors.join('\n'), pattern);
}
function sameExact(a, b) { assert.equal(BigInt(a.numerator) * BigInt(b.denominator), BigInt(b.numerator) * BigInt(a.denominator)); }
function leaves(node) { return node.type === 'pair' ? [node] : node.branches.flatMap(b => leaves(b.node)); }

test('all eight directional and net results match independently verified Python fractions', () => {
  const d = sampleDraft(), r = run(d);
  assert.equal(r.rows.length, 8); assert.equal(r.budgets.length, 14);
  assert.equal(r.rows.reduce((n, r) => n + BigInt(r.net), 0n), 15245400n);
  for (const ref of reference.published_directions_floor10) {
    const result = row(r, ref.debtor, ref.creditor);
    assert.equal(result.forwardRounded, String(ref.forward)); assert.equal(result.reverseRounded, String(ref.reverse));
    assert.equal(result.net, String(ref.net));
    const precise = precisionReference.rows.find(p => p.debtor === ref.debtor && p.creditor === ref.creditor);
    sameExact(result.forward, precise.forward_exact); sameExact(result.reverse, precise.reverse_exact);
  }
  for (const budget of r.budgets) sameExact(budget.allocated, { numerator: budget.recognized, denominator: '1' });
  assert.equal(r.budgets.reduce((n, b) => n + BigInt(b.recognized), 0n), 39067992n);
  assert.ok(r.traces.every(t => t.path.length && t.rulingId && t.costId));
});

test('changing cost, valuation or an explicit allocation changes calculated results', () => {
  const initial = run(sampleDraft());
  const changedCost = sampleDraft(); changedCost.costs.find(c => c.id === 'p1fee').recognized = '0';
  assert.notEqual(row(run(changedCost)).net, row(initial).net);
  const changedValue = sampleDraft(); changedValue.calculation.values.find(v => v.id === 's1-main-p2').amount = '100000000';
  assert.notEqual(row(run(changedValue)).net, row(initial).net);
  const changedPlan = sampleDraft(); changedPlan.calculation.plans.find(p => p.costId === 'p1stamp').root.method = 'equal';
  assert.notEqual(row(run(changedPlan)).net, row(initial).net);
});

test('rounding timing reproduces the known ten-won difference without intermediate rounding', () => {
  const d = sampleDraft(); assert.equal(row(run(d)).net, '4764820');
  d.calculation.rounding.timing = 'net';
  const r = run(d); assert.equal(row(r).net, '4764810'); assert.equal(row(r).forwardRounded, null);
  d.calculation.rounding.unit = '1';
  assert.equal(row(run(d)).net, '4764818');
});

test('zero is a real recognized amount, unknown is blocked, and reverse reimbursement is retained', () => {
  const d = sampleDraft(); d.costs[0].recognized = '';
  blocked(d, /직원 인정액/);
  const zero = sampleDraft(); zero.costs.filter(c => c.payerIds.includes('p1')).forEach(c => c.recognized = '0');
  assert.equal(row(run(zero)).net, '-1239220');
});

test('reverse burden is explicit and is never inferred as one minus the forward ratio', () => {
  const d = sampleDraft(); const ruling = d.rulings.find(r => r.id === 'A-p1');
  ruling.reverseNumerator = '0';
  assert.equal(row(run(d), 'A', 'p1').net, '3399630');
  ruling.reverseNumerator = '';
  blocked(d, /역방향 부담 비율/);
});

test('missing plans and unsupported multi-party rulings block the entire output', () => {
  const d = sampleDraft(); d.calculation.plans.pop(); blocked(d, /계획이 없는 비용/);
  const multi = sampleDraft(); multi.rulings[0].payerIds.push('B'); blocked(multi, /복수·연대/);
  const omittedParty = sampleDraft(); omittedParty.parties[0].applicationRole = '신청 대상 아님'; blocked(omittedParty, /신청 대상 외/);
});

test('dangling stages, incorrect claim scope and absent application basis are not silently ignored', () => {
  const d = sampleDraft(); d.costs[0].stageId = 'missing'; blocked(d, /발생 절차/);
  const scope = sampleDraft();
  const counterLeaf = leaves(scope.calculation.plans.find(p => p.costId === 'd1stamp').root)[0];
  counterLeaf.claimId = 'main'; blocked(scope, /말단 청구/);
  const application = sampleDraft(); application.calculation.plans.find(p => p.costId === 'application').applicationBasis = '';
  blocked(application, /신청비용은 준용 근거/);
  const participant = sampleDraft(); participant.stages[0].partyIds = participant.stages[0].partyIds.filter(id => id !== 'p1');
  blocked(participant, /절차에 참여하지 않습니다/);
});

test('zero weights, duplicate plans and invalid ratios clear all result rows', () => {
  const zero = sampleDraft(); zero.calculation.values.forEach(v => v.amount = '0'); blocked(zero, /가중치 합계가 0/);
  const duplicate = sampleDraft(); duplicate.calculation.plans.push(duplicate.calculation.plans[0]); blocked(duplicate, /중복/);
  const ratio = sampleDraft(); ratio.rulings[0].denominator = '0'; blocked(ratio, /분모는 0/);
  const negative = sampleDraft(); negative.costs[0].recognized = '-1'; blocked(negative, /직원 인정액/);
});

test('the non-submission exception excludes respondent expenses without destroying their audit paths', () => {
  const d = sampleDraft(); d.review.responseState = '기간 내 미제출'; blocked(d, /충돌/);
  d.calculation.setoff = 'applicantOnly';
  const r = run(d); assert.equal(row(r).net, '6004040'); assert.equal(row(r).reverseRounded, '0');
  assert.ok(r.traces.some(t => !t.included && t.ownerId === 'A'));
});

test('requested total is a guard, not a silently apportioned cap', () => {
  const d = sampleDraft(); d.meta.requested = '100'; blocked(d, /신청총액을 초과/);
});

test('legacy drafts preserve all prior data but do not infer new weights, plans or reverse ratios', () => {
  const legacy = sampleDraft(); legacy.version = 1; delete legacy.calculation;
  legacy.rulings.forEach(r => { delete r.reverseNumerator; delete r.reverseDenominator; });
  const raw = JSON.stringify(legacy), restored = parseDraft(raw);
  assert.equal(JSON.stringify(legacy), raw); assert.equal(restored.version, 2);
  assert.deepEqual(restored.meta, legacy.meta); assert.deepEqual(restored.costs, legacy.costs);
  assert.equal(restored.calculation.plans.length, 0); assert.equal(restored.rulings[0].reverseNumerator, '');
  blocked(restored, /절사 단위/);
  assert.deepEqual(parseDraft(JSON.stringify(sampleDraft())), sampleDraft());
});

test('corrupt calculation trees and unsupported versions fail restoration, not the current draft', () => {
  const bad = sampleDraft(); bad.calculation.plans[0].root.branches[0].weight.kind = 'script';
  assert.throws(() => parseDraft(JSON.stringify(bad)));
  const wrong = blankDraft(); wrong.version = 3; assert.throws(() => parseDraft(JSON.stringify(wrong)));
  const deep = sampleDraft(); let node = deep.calculation.plans[0].root;
  for (let i = 0; i < 10; i++) { const child = { id: `deep-${i}`, type: 'split', label: 'x', method: 'equal', branches: [] }; node.branches = [{ id: `branch-${i}`, label: 'x', weight: { kind: 'fraction', refId: '', numerator: '1', denominator: '1' }, node: child }]; node = child; }
  assert.throws(() => parseDraft(JSON.stringify(deep)));
});
