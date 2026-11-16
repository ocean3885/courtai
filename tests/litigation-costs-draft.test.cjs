const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { amount, blankDraft, sampleDraft, parseDraft, reviewDraft, isReferenced, matchesSample, sampleReference } = load('src/lib/litigation-costs-draft.ts');

test('draft round trip preserves empty amounts, counterclaim parties and scope of representation', () => {
  const d = sampleDraft();
  const restored = parseDraft(JSON.stringify(d));
  assert.deepEqual(restored, d);
  assert.equal(restored.meta.requested, '');
  assert.deepEqual(restored.claims[1].claimantIds, ['A']);
  assert.deepEqual(restored.claims[1].opponentIds, ['p1', 'p2']);
  assert.equal(restored.costs.filter(c => c.claimIds.length === 1 && c.claimIds[0] === 'counter').some(c => c.targetIds.includes('B')), false);
  assert.deepEqual(parseDraft(JSON.stringify(blankDraft())), blankDraft());
});

test('corrupt storage, incompatible versions and malformed nested references are rejected', () => {
  for (const raw of ['null', '{}', '{', JSON.stringify({ ...blankDraft(), version: 2 })]) assert.throws(() => parseDraft(raw));
  const d = sampleDraft();
  d.costs[0].payerIds = null;
  assert.throws(() => parseDraft(JSON.stringify(d)));
  const duplicate = sampleDraft(); duplicate.parties.push({ ...duplicate.parties[0] });
  assert.throws(() => parseDraft(JSON.stringify(duplicate)));
});

test('reference amounts are only identified with the unchanged reference input', () => {
  const d = sampleDraft();
  assert.equal(matchesSample(d), true);
  assert.equal(sampleReference.length, 8);
  assert.equal(sampleReference.reduce((sum, row) => sum + row[2], 0), 15245400);
  d.costs[0].recognized = '1';
  assert.equal(matchesSample(d), false);
  const p = sampleDraft(); p.parties[0].name = '다른 당사자';
  assert.equal(matchesSample(p), false);
});

test('source costs retain refund history and match both sides of the verified case', () => {
  const d = sampleDraft();
  const total = ids => d.costs.filter(c => c.payerIds.some(id => ids.includes(id))).reduce((s, c) => s + amount(c.recognized), 0);
  assert.equal(total(['p1', 'p2', 'p3', 'p4']), 26400329);
  assert.equal(total(['A', 'B']), 12667663);
  const c = d.costs.find(c => c.id === 'p1service');
  assert.equal(amount(c.claimed) - amount(c.refund), 30956);
  assert.equal(c.recognized, '30956');
});

test('review catches invalid ratios, missing relations, over-refunds and reversed mandate dates', () => {
  const d = sampleDraft();
  d.rulings[0].denominator = '0';
  d.costs[0].stageId = 'missing-stage';
  d.costs[1].refund = '999999999';
  d.claims[0].opponentIds.push('p1');
  d.mandates[0].start = '2026-11-16'; d.mandates[0].end = '2026-01-01';
  const messages = reviewDraft(d).map(i => i.message).join('\n');
  assert.match(messages, /분모는 0일 수 없습니다/);
  assert.match(messages, /연결된 대상을 확인/);
  assert.match(messages, /환급액이 청구액보다/);
  assert.match(messages, /청구자와 상대방이 겹칩니다/);
  assert.match(messages, /종료일이 선임일보다/);
  assert.equal(isReferenced(d, 'p1'), true);
  assert.equal(isReferenced(d, 's1'), true);
  assert.equal(isReferenced(d, 'main'), true);
  assert.equal(isReferenced(d, 'unused-id'), false);
});

test('zero is distinct from unknown and unsafe or non-integer money is not accepted', () => {
  assert.equal(amount('0'), 0);
  for (const value of ['', '-1', '1.5', '1e5', 'NaN', '9007199254740992']) assert.equal(amount(value), null);
  const d = sampleDraft();
  d.costs[0].recognized = '';
  assert.ok(reviewDraft(d).some(i => i.message.includes('원고 1심 변호사보수 직원 검토 인정액')));
});
