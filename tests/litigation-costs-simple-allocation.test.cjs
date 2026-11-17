const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { getSimpleAllocationContext: context, applySimpleAllocation: apply } = load('src/lib/litigation-costs-simple-allocation.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const { reportCaseDraft, reportValidationCases } = load('src/lib/litigation-costs-report-cases.ts');
const { buildCostReport } = load('src/lib/litigation-costs-report.ts');
const { sampleDraft, parseDraft } = load('src/lib/litigation-costs-draft.ts');
function ready(d, id = d.costs[0].id) { const c = context(d, id); assert.equal(c.status, 'ready', c.reason); return c; }
function applyAll(d) {
  const selections = new Map(d.costs.map(cost => {
    const c = ready(d, cost.id);
    return [cost.id, { rulingId: c.pair.rulingId, applicationBasis: c.plan.applicationBasis, basisGroupId: c.plan.basisGroupId }];
  }));
  d.calculation.plans = [];
  d.costs.forEach(cost => { cost.targetIds = []; cost.allocation = '미정'; cost.reason = ''; });
  for (const cost of d.costs) {
    const r = apply(d, cost.id, selections.get(cost.id), `simple-${cost.id}`);
    assert.equal(r.ok, true, r.error); d = r.draft;
    // Manual fee groups are an explicit independent choice in the UI.
    d.calculation.plans.find(p => p.costId === cost.id).basisGroupId = selections.get(cost.id).basisGroupId;
  }
  return d;
}

test('ten independent report cases retain amounts, directions, budget conservation and report totals after simple plan generation', () => {
  for (const entry of reportValidationCases) {
    const original = reportCaseDraft(entry.id), before = calculateAllocation(original);
    assert.equal(before.status, 'preview');
    const changed = applyAll(reportCaseDraft(entry.id)), after = calculateAllocation(changed);
    assert.equal(after.status, 'preview', after.errors.join('\n'));
    assert.deepEqual(after.rows, before.rows, entry.id);
    assert.deepEqual(after.budgets, before.budgets, entry.id);
    assert.deepEqual(after.attorneyFees, before.attorneyFees, entry.id);
    assert.ok(after.traces.every(t => t.allocated.numerator === t.recognized && t.allocated.denominator === '1'));
    const beforeReport = buildCostReport(original), afterReport = buildCostReport(changed);
    assert.equal(afterReport.status, 'preview', JSON.stringify(afterReport));
    assert.deepEqual(afterReport.report.result, beforeReport.report.result, entry.id);
    assert.equal(afterReport.report.result.net, entry.expected.net, entry.id);
    assert.deepEqual(parseDraft(JSON.stringify(changed)), changed);
    changed.costs.forEach((c, i) => {
      for (const key of ['claimed', 'refund', 'recognized', 'attorneyFee', 'evidence', 'note', 'payerIds', 'claimIds']) assert.deepEqual(c[key], original.costs[i][key]);
    });
  }
});

test('existing one-child equal trees and basis groups survive explicit editing without flattening or mutation', () => {
  const d = reportCaseDraft('R01'), id = d.costs[0].id, c = ready(d, id), raw = JSON.stringify(d);
  const r = apply(d, id, { rulingId: c.pair.rulingId, applicationBasis: c.plan.applicationBasis }, 'unused');
  assert.equal(r.ok, true); assert.equal(JSON.stringify(d), raw);
  assert.deepEqual(r.draft.calculation.plans, d.calculation.plans);
  assert.deepEqual(r.draft.calculation.groups, d.calculation.groups);
  assert.deepEqual(r.draft.calculation.values, d.calculation.values);
  assert.equal(r.draft.costs[0].reason, d.costs[0].reason);
  assert.deepEqual(r.draft.review, d.review);
});

test('application costs require explicit grounds when borrowing an order from a different stage', () => {
  const d = reportCaseDraft('F01'), cost = d.costs.find(c => c.stageId === 'app'), c = ready(d, cost.id);
  const before = JSON.stringify(d);
  const invalid = apply(d, cost.id, { rulingId: c.pair.rulingId, applicationBasis: '  ' }, 'app-plan');
  assert.equal(invalid.ok, false); assert.match(invalid.error, /준용 근거/); assert.equal(JSON.stringify(d), before);
  const ruling = d.rulings.find(r => r.id === c.pair.rulingId); ruling.stageIds.push('app');
  assert.equal(apply(d, cost.id, { rulingId: ruling.id, applicationBasis: '' }, 'app-plan').ok, true);
});

test('partial success uses both explicit directions and each-own-cost orders retain zero rather than complement inference', () => {
  for (const id of ['R03', 'R04', 'R05', 'R06']) {
    const d = applyAll(reportCaseDraft(id)), r = calculateAllocation(d);
    assert.equal(r.status, 'preview');
    for (const t of r.traces) {
      const order = d.rulings.find(o => o.id === t.rulingId);
      const direct = order.receiverIds[0] === t.ownerId;
      const n = direct ? order.numerator : order.reverseNumerator;
      const den = direct ? order.denominator : order.reverseDenominator;
      assert.equal(BigInt(t.burden.numerator) * BigInt(den), BigInt(t.burden.denominator) * BigInt(n));
    }
  }
});

test('multi-party, counterclaim, shared ownership, remand and complex trees remain untouched', () => {
  const examples = [sampleDraft()];
  const counter = reportCaseDraft('F01'); counter.claims[0].kind = '반소'; examples.push(counter);
  const shared = reportCaseDraft('F01'); shared.costs[0].payerIds = ['p', 'd']; examples.push(shared);
  const remand = reportCaseDraft('F01'); remand.stages[0].type = '환송심'; examples.push(remand);
  const weighted = reportCaseDraft('F01'); weighted.calculation.plans[0].root.method = 'weighted'; examples.push(weighted);
  const branched = reportCaseDraft('F01'); branched.calculation.plans[0].root.branches.push(structuredClone(branched.calculation.plans[0].root.branches[0])); examples.push(branched);
  const mismatched = reportCaseDraft('F01'); let leaf = mismatched.calculation.plans[0].root; while (leaf.type === 'split') leaf = leaf.branches[0].node; leaf.ownerId = 'p'; examples.push(mismatched);
  for (const d of examples) {
    const before = JSON.stringify(d), id = d.costs[0].id;
    assert.equal(context(d, id).status, 'unavailable');
    assert.equal(apply(d, id, { rulingId: 'burden', applicationBasis: '근거' }, 'new').ok, false);
    assert.equal(JSON.stringify(d), before);
  }
});

test('candidate rules respect stage, parties, claim scope, unique identifiers and both ratios', () => {
  const mutations = [
    d => d.rulings[0].stageIds = ['app'],
    d => d.rulings[0].claimIds = [],
    d => d.rulings[0].receiverIds = ['p', 'd'],
    d => d.rulings[0].reverseDenominator = '0',
    d => d.rulings[0].numerator = '2',
    d => d.rulings[0].text = '',
    d => d.rulings.push(structuredClone(d.rulings[0])),
  ];
  for (const mutate of mutations) {
    const d = reportCaseDraft('F01'); mutate(d);
    assert.equal(ready(d).rulings.length, 0);
    const before = JSON.stringify(d);
    assert.equal(apply(d, d.costs[0].id, { rulingId: d.rulings[0].id, applicationBasis: '' }, 'new').ok, false);
    assert.equal(JSON.stringify(d), before);
  }
  const d = reportCaseDraft('F01'); d.rulings.push({ ...d.rulings[0], id: 'second', numerator: '1', denominator: '2' });
  assert.equal(ready(d).rulings.length, 2);
  assert.equal(apply(d, d.costs[0].id, { rulingId: '', applicationBasis: '' }, 'new').ok, false);
});

test('duplicate plans, stale cost scope and foreign targets cannot be overwritten by the simple editor', () => {
  const mutations = [
    d => d.calculation.plans.push(structuredClone(d.calculation.plans[0])),
    d => d.costs[0].claimIds = [],
    d => d.costs[0].targetIds = ['deleted'],
    d => d.stages[0].partyIds = ['p'],
  ];
  for (const mutate of mutations) {
    const d = reportCaseDraft('F01'); mutate(d);
    assert.equal(context(d, d.costs[0].id).status, 'unavailable');
  }
});

test('simple plan creation does not fill missing financial amounts, manual fee groups or global calculation decisions', () => {
  const d = reportCaseDraft('F01'), c = ready(d); d.calculation.plans = [];
  d.costs[0].attorneyFee.litigationValue = ''; d.calculation.rounding.unit = '';
  const r = apply(d, c.cost.id, { rulingId: c.pair.rulingId, applicationBasis: '' }, 'new');
  assert.equal(r.ok, true); assert.equal(r.draft.calculation.rounding.unit, '');
  assert.equal(r.draft.costs[0].attorneyFee.litigationValue, '');
  assert.equal(calculateAllocation(r.draft).status, 'blocked');
  const manual = applyAll(reportCaseDraft('R01'));
  manual.calculation.plans.forEach(p => p.basisGroupId = '');
  assert.equal(calculateAllocation(manual).status, 'blocked'); // manual fee basis groups still must be connected
  assert.ok(manual.calculation.plans.some(p => p.basisGroupId === ''));
});


test('non-submission exclusion and phase-specific order scope survive simple generation', () => {
  const original = reportCaseDraft('R03');
  original.calculation.setoff = 'applicantOnly'; original.review.responseState = '기간 내 미제출';
  const changed = applyAll(structuredClone(original));
  const before = calculateAllocation(original), after = calculateAllocation(changed);
  assert.equal(after.status, 'preview'); assert.deepEqual(after.rows, before.rows);
  assert.ok(after.traces.some(t => !t.included));
  const multiPhase = reportCaseDraft('F03');
  for (const cost of multiPhase.costs.filter(c => c.stageId !== 'app')) {
    const c = ready(multiPhase, cost.id);
    assert.ok(c.rulings.every(r => r.stageIds.includes(cost.stageId)));
    assert.ok(c.rulings.length > 0);
  }
});
