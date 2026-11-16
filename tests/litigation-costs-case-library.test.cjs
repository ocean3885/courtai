const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { referenceCases, referenceCaseDraft, matchesReferenceCase, compareReferenceAmounts } = load('src/lib/litigation-costs-case-library.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const { parseDraft } = load('src/lib/litigation-costs-draft.ts');
const oracle = require('../docs/examples/litigation-costs-case-oracle.json');
const key = row => `${row.applicantId}/${row.respondentId}`;
const sorted = rows => [...rows].sort((a, b) => key(a).localeCompare(key(b)));
const run = id => {
  const d = referenceCaseDraft(id), r = calculateAllocation(d);
  assert.equal(r.status, 'preview', JSON.stringify(r.errors));
  return { d, r };
};

for (const entry of referenceCases) {
  test(`${entry.id}: ${entry.title} matches independent Fraction oracle`, () => {
    const draft = referenceCaseDraft(entry.id), result = calculateAllocation(draft);
    const expected = oracle.cases.find(c => c.id === entry.id);
    assert.deepEqual(parseDraft(JSON.stringify(draft)), draft);
    assert.equal(result.status, expected.status);
    if (expected.status === 'blocked') {
      assert.match(result.errors.join('\n'), new RegExp(expected.reason));
      assert.deepEqual(result.rows, []); assert.deepEqual(result.traces, []); assert.deepEqual(result.budgets, []);
    } else {
      assert.deepEqual(sorted(result.rows), sorted(expected.rows));
      assert.deepEqual(result.budgets, expected.budgets);
      assert.equal(result.traces.length, expected.traceCount);
      assert.deepEqual(compareReferenceAmounts(entry, result), expected.sourceComparison);
    }
  });
}

test('source discrepancies remain unresolved data, separate from reconstructed and blocked cases', () => {
  assert.equal(referenceCases.filter(c => c.category === '기본').length, 12);
  assert.equal(referenceCases.filter(c => c.category === '특수').length, 6);
  const source = referenceCases.filter(c => c.provenance === '원문 사례');
  assert.equal(source.length, 13);
  const mismatched = source.filter(c => compareReferenceAmounts(c, calculateAllocation(referenceCaseDraft(c.id))).some(r => r.difference !== '0'));
  assert.deepEqual(mismatched.map(c => c.id), ['B06', 'B09', 'B10', 'B11', 'S01']);
  assert.equal(source.length - mismatched.length, 8);
  for (const c of referenceCases.filter(c => c.provenance === '구조 재구성')) assert.deepEqual(c.sourceAmounts, []);
});

test('some parties appeal and fewer reach the Supreme Court without reallocating the earlier stage', () => {
  const { r } = run('B08');
  const stage1 = r.traces.filter(t => t.costId === 'cost-1');
  const appeal = r.traces.filter(t => t.costId === 'cost-2');
  const supreme = r.traces.filter(t => t.costId === 'cost-3');
  assert.equal(stage1.length, 17); assert.equal(appeal.length, 7); assert.equal(supreme.length, 6);
  assert.ok(appeal.some(t => t.otherId === 'P13'));
  assert.ok(supreme.every(t => t.otherId !== 'P13'));
  const net = id => r.rows.find(row => row.respondentId === id).net;
  assert.equal(net('P1'), '1151710'); assert.equal(net('P13'), '635050'); assert.equal(net('P3'), '192190');
});

test('different common mandates by stage keep an unrepresented party out of the first-stage fee', () => {
  const { d, r } = run('B10');
  assert.deepEqual(d.mandates.find(m => m.stageIds.includes('s1')).partyIds, ['P1', 'P2', 'P3']);
  assert.deepEqual(d.mandates.find(m => m.stageIds.includes('s2')).partyIds, ['P1', 'P2', 'P3', 'P4']);
  assert.ok(r.traces.filter(t => t.costId === 'cost-1').every(t => t.ownerId !== 'P4'));
  assert.ok(r.traces.some(t => t.costId === 'cost-4' && t.ownerId === 'P4'));
});

test('six by fourteen relationships conserve all shared costs before burden and truncation', () => {
  const { r } = run('B11');
  assert.equal(r.rows.length, 84); assert.equal(r.traces.length, 168);
  assert.equal(r.budgets.reduce((n, b) => n + BigInt(b.recognized), 0n), 8583775n);
  assert.ok(r.budgets.every(b => b.allocated.denominator === '1' && b.allocated.numerator === b.recognized));
});

test('counterclaim stamp discrepancy is exposed and neither source nor computed amount is overwritten', () => {
  const entry = referenceCases.find(c => c.id === 'S01');
  const { d, r } = run('S01');
  assert.deepEqual(compareReferenceAmounts(entry, r).map(c => [c.net, c.computed, c.difference]), [['1614630', '1696480', '81850']]);
  const stamp = r.traces.filter(t => t.costId === 'cost-2');
  assert.equal(stamp.length, 1); assert.equal(stamp[0].claimId, 'counter');
  assert.deepEqual(stamp[0].reimbursable, { numerator: '81850', denominator: '1' });
  assert.equal(d.review.responseState, '미확인'); // don't invent a non-submission fact
  d.costs.find(c => c.id === 'cost-2').recognized = '0';
  assert.equal(calculateAllocation(d).rows[0].net, '1614630');
  assert.equal(entry.sourceAmounts[0].net, '1614630');
});

test('stage-specific rulings and final total-cost ruling use only the explicitly selected orders', () => {
  const staged = run('S02'); assert.equal(staged.r.rows[0].net, '700000');
  const total = run('S04'); assert.equal(total.r.rows[0].net, '600000');
  const old = total.d.rulings[0];
  assert.ok(total.r.traces.every(t => t.rulingId !== old.id));
  old.numerator = '0'; old.reverseNumerator = '1';
  assert.equal(calculateAllocation(total.d).rows[0].net, '600000');
});

test('each bearing their own costs sets both reimbursement directions to zero and retains all allocations', () => {
  const { r } = run('S03');
  assert.equal(r.rows[0].net, '0');
  assert.equal(r.rows[0].forward.numerator, '0'); assert.equal(r.rows[0].reverse.numerator, '0');
  assert.equal(r.budgets.reduce((n, b) => n + BigInt(b.recognized), 0n), 800000n);
});

test('case drafts are isolated, persist their reference, and stop matching after changes', () => {
  const first = referenceCaseDraft('B01');
  assert.ok(matchesReferenceCase(first));
  assert.ok(matchesReferenceCase(parseDraft(JSON.stringify(first))));
  first.parties[0].name = '수정'; first.costs[0].recognized = '1'; first.rulings[0].stageIds.pop();
  assert.ok(!matchesReferenceCase(first));
  assert.ok(matchesReferenceCase(referenceCaseDraft('B01')));
  const invalid = referenceCaseDraft('B01'); invalid.referenceCaseId = {};
  assert.throws(() => parseDraft(JSON.stringify(invalid)));
  assert.throws(() => referenceCaseDraft('unknown'));
});
