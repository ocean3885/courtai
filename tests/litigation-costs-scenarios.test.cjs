const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { referenceCases, draftFromReferenceCase, referenceCaseDraft } = load('src/lib/litigation-costs-case-library.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const { parseDraft } = load('src/lib/litigation-costs-draft.ts');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const oracle = require('../docs/examples/litigation-costs-scenario-oracle.json');
const compact = result => result.rows.map(r => [r.applicantId, r.respondentId, r.forward.numerator, r.forward.denominator,
  r.reverse.numerator, r.reverse.denominator, r.forwardRounded, r.reverseRounded, r.net]).sort((a,b) => JSON.stringify(a.slice(0,2)).localeCompare(JSON.stringify(b.slice(0,2))));
const sort = rows => [...rows].sort((a,b) => JSON.stringify(a.slice(0,2)).localeCompare(JSON.stringify(b.slice(0,2))));
function build(c) {
  const entry = structuredClone(referenceCases.find(r => r.id === c.baseId));
  entry.sourceAmounts = []; entry.rounding = { unit: c.unit, timing: c.timing }; entry.setoff = c.setoff;
  entry.costs.forEach((cost, i) => {
    if (c.variant === 'awkward') cost.recognized = String(BigInt(i + 1) * 10003n + 200n + BigInt(cost.recognized) % 997n);
    if (c.variant === 'zero') cost.recognized = '0';
  });
  const d = draftFromReferenceCase(entry);
  // Explicit synthetic procedural facts; never infer these from the source case.
  d.review.responseState = c.setoff === 'mutual' ? '기간 내 제출' : '기간 내 미제출';
  d.review.setoff = c.setoff === 'mutual' ? '제112조 본문 적용 검토' : '제111조 제2항 예외 검토';
  return d;
}

test('independent scenario oracle matches its source and covers the full declared matrix', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/fixtures/litigation-costs-cases.json'));
  assert.equal(createHash('sha256').update(source).digest('hex'), oracle.sourceSha256);
  assert.equal(oracle.scenarios.length, 384);
  assert.equal(new Set(oracle.scenarios.map(c => c.id)).size, 384);
  for (const base of referenceCases.filter(c => c.expectedStatus === 'preview')) assert.equal(oracle.scenarios.filter(c => c.baseId === base.id).length, 24);
});
for (const c of oracle.scenarios) {
  test(`scenario ${c.id}: exact directions, setoff, truncation and conservation`, () => {
    const d = build(c), original = JSON.stringify(d), r = calculateAllocation(d);
    assert.equal(r.status, 'preview', r.errors.join('\n'));
    assert.deepEqual(compact(r), sort(c.rows));
    assert.equal(r.traces.length, c.traceCount);
    assert.equal(r.budgets.length, d.costs.length);
    for (const b of r.budgets) assert.equal(BigInt(b.allocated.numerator), BigInt(b.recognized) * BigInt(b.allocated.denominator));
    assert.equal(JSON.stringify(d), original, 'calculation must not mutate its input');
    assert.deepEqual(compact(calculateAllocation(parseDraft(original))), compact(r));
  });
}

test('reordering identifiers and expense rows preserves amounts for every supported geometry', () => {
  for (const base of referenceCases.filter(c => c.expectedStatus === 'preview')) {
    const d = build(oracle.scenarios.find(c => c.baseId === base.id && c.variant === 'awkward'));
    const before = compact(calculateAllocation(d));
    for (const key of ['parties','claims','stages','rulings','mandates','costs']) d[key].reverse();
    d.calculation.plans.reverse(); d.calculation.values.reverse(); d.calculation.groups.reverse();
    assert.deepEqual(compact(calculateAllocation(d)), before, base.id);
  }
});

test('splitting an expense with the same route does not introduce intermediate truncation', () => {
  for (const base of referenceCases.filter(c => c.expectedStatus === 'preview')) {
    const d = build(oracle.scenarios.find(c => c.baseId === base.id && c.variant === 'awkward' && c.timing === 'direction' && c.unit === '10'));
    const before = compact(calculateAllocation(d)), originalCost = d.costs[0];
    const first = BigInt(originalCost.recognized) / 2n, second = BigInt(originalCost.recognized) - first;
    const extra = structuredClone(originalCost); extra.id += '-split';
    originalCost.recognized = originalCost.claimed = String(first); extra.recognized = extra.claimed = String(second);
    const plan = structuredClone(d.calculation.plans.find(p => p.costId === originalCost.id)); plan.costId = extra.id;
    d.costs.push(extra); d.calculation.plans.push(plan);
    const result = calculateAllocation(d); assert.equal(result.status, 'preview', result.errors.join('\n'));
    assert.deepEqual(compact(result), before, base.id);
  }
});

test('invalid references, amounts and unsupported relations clear all result payloads', () => {
  const mutations = [
    d => d.costs[0].recognized = '', d => d.costs[0].recognized = '-1', d => d.costs[0].recognized = '1e6',
    d => d.costs[0].recognized = '9007199254740992', d => d.costs[0].refund = 'oops',
    d => d.costs[0].refund = '99999999999999', d => d.rulings[0].denominator = '0',
    d => d.rulings[0].reverseDenominator = '0', d => d.costs[0].stageId = 'removed',
    d => d.calculation.plans.pop(), d => d.calculation.plans.push(d.calculation.plans[0]),
    d => d.calculation.rounding.unit = '', d => d.calculation.setoff = 'unreviewed',
    d => d.rulings[0].payerIds.push(d.rulings[0].receiverIds[0]),
  ];
  for (const mutate of mutations) {
    const d = referenceCaseDraft('B01'); mutate(d); const r = calculateAllocation(d);
    assert.equal(r.status, 'blocked'); assert.ok(r.errors.length);
    for (const key of ['rows','traces','budgets','attorneyFees']) assert.deepEqual(r[key], []);
  }
  for (const id of ['S05','S06']) assert.equal(calculateAllocation(referenceCaseDraft(id)).status, 'blocked');
});
