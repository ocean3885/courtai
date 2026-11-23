const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateSteps, fraction, money, reviewCosts, add, nothing, truncateWon } = load('src/app/litigation-costs/costReview.ts');
const { reviewApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const { calculateLitigationCosts } = load('src/app/litigation-costs/litigationCalculation.ts');
const part = (n, d, label) => ({ factor: fraction(BigInt(n), BigInt(d)), label });

test('중간 배분값의 소수 부분을 보존하여 곱셈 순서와 관계없이 같은 결과', () => {
  const factors = [part(1, 3, '상대방별 배분'), part(3, 5, '부담률 적용')];
  for (const steps of [factors, [...factors].reverse()]) {
    const r = calculateSteps(fraction(10000n), steps);
    assert.equal(money(r.amount), '2,000원');
    assert.deepEqual(r.amount, r.exactAmount);
    assert(r.steps.every(s => s.discarded.n === 0n));
  }
  const r = calculateSteps(fraction(10000n), factors);
  assert.equal(money(r.steps[1].input), '10,000/3원');
});

test('1원 미만도 보존하고 최종 절사 함수는 10원이 아닌 1원 단위로 처리', () => {
  assert.equal(money(calculateSteps(fraction(5n), [part(1, 2, '배분')]).amount), '5/2원');
  assert.equal(money(calculateSteps(fraction(961n), [part(1, 1, '부담')]).amount), '961원');
  assert.equal(money(calculateSteps(fraction(100n), [part(0, 1, '부담 없음')]).amount), '0원');
  assert.equal(money(truncateWon(fraction(10049n, 10n))), '1,004원');
  assert.equal(money(truncateWon(fraction(0n))), '0원');
});

test('큰 금액의 반복 배분에서도 부동소수점 오차 없이 계산', () => {
  const r = calculateSteps(fraction(9999999999999999n), [part(1, 3, '배분'), part(2, 5, '부담')]);
  assert.deepEqual(r.amount, { n: 6666666666666666n, d: 5n });
});

const people = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i ? '피신청인' : '신청인' }));
const cost = (id = 'main', paid = '10040', payer = 'a') => ({ id, paid, payer, kind: '송달료', refund: '0', ids: [payer], shared: false, method: '' });
const rule = { id: 'r', left: ['a'], right: ['b', 'c', 'd'], mode: '비율로 분담', n: '1', d: '3', scope: '1심 비용', rightMethod: '균분' };
const stage = () => ({ id: 'first', level: '1심', members: Object.fromEntries(people.map(p => [p.id, {}])), rules: [{ ...rule }], costs: [cost()] });

test('부담률 2/3 적용 후 3명 균분한 정밀값을 본안·신청비용에 동일 사용', () => {
  const s = stage();
  const main = reviewCosts([s], people);
  const app = reviewApplicationCosts([cost('app')], people, [s], { mode: '판결 기준', stageId: 'first' });
  for (const r of [main, app]) {
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.lines.map(l => money(l.amount)), ['20,080/9원', '20,080/9원', '20,080/9원']);
    assert.equal(money(r.lines.reduce((sum, l) => add(sum, l.amount), nothing)), '20,080/3원');
    assert.deepEqual(r.lines[0].steps.map(s => s.label), ['부담률 적용', '상대방별 배분']);
  }
  assert.deepEqual(main.lines[0].steps, app.lines[0].steps);
  const result = calculateLitigationCosts(people, [s], []);
  assert(result.settlements.every(row => money(row.payable) === '2,231원'));
});

test('비목별·심급별 소수 부분을 합산한 뒤 마지막에만 절사', () => {
  const s = stage();
  s.rules[0].mode = '2측 전부 부담';
  s.costs = [cost('one', '1'), cost('two', '1')];
  const appeal = { ...stage(), id: 'appeal', level: '항소심', costs: [cost('three', '1')], rules: [{ ...s.rules[0], scope: '항소심 비용' }] };
  const result = calculateLitigationCosts(people, [s, appeal], []);
  assert.deepEqual(result.errors, []);
  assert(result.settlements.every(row => money(row.forward) === '1원' && money(row.payable) === '1원'));
});

test('A와 B를 먼저 절사하지 않고 상계·신청비용 가산 후 양방향 최종 지급액 절사', () => {
  const parties = [people[0], people[1]];
  // A=5*2/3, B=2*1/3, application=1*2/3 => 10/3, payable=3.
  // Truncating each component or the net first would incorrectly yield 2.
  const s = { ...stage(), members: { a: {}, b: {} }, rules: [{ ...rule, right: ['b'] }], costs: [cost('a', '5'), cost('b', '2', 'b')] };
  let row = calculateLitigationCosts(parties, [s], [cost('app', '1')]).settlements[0];
  assert.equal(money(row.net), '8/3원');
  assert.equal(money(row.combinedAmount), '10/3원');
  assert.equal(money(row.payable), '3원');
  assert.equal(money(row.discarded), '1/3원');
  assert.equal(row.payer.id, 'b');
  // A=2/3, B=11/3, application=2/3 => -7/3, payable=2 (not 3).
  s.costs = [cost('a', '1'), cost('b', '11', 'b')];
  row = calculateLitigationCosts(parties, [s], [cost('app', '1')]).settlements[0];
  assert.equal(money(row.combinedAmount), '-7/3원');
  assert.equal(money(row.payable), '2원');
  assert.equal(row.payer.id, 'a');
  assert.equal(row.receiver.id, 'b');
  assert.equal(money(row.discarded), '1/3원');
});

test('부분 상소에도 원래 상대방 분모를 유지한 정밀액을 최종 절사', () => {
  const first = stage(); first.rules[0].mode = '2측 전부 부담'; first.costs[0].paid = '10000';
  const appeal = { ...stage(), id: 'appeal', level: '항소심', members: { a: {}, b: {}, c: {} }, costs: [], rules: [{ ...rule, right: ['b', 'c'], scope: '소송총비용', n: '1', d: '2' }] };
  const r = calculateLitigationCosts(people, [first, appeal], []);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.main.lines.map(l => money(l.amount)), ['5,000/3원', '5,000/3원', '10,000/3원']);
  assert.deepEqual(r.settlements.map(row => money(row.payable)), ['1,666원', '1,666원', '3,333원']);
});

test('본소·반소 배분·공동귀속·부담률·상대방 배분의 전 단계를 정밀 계산', () => {
  const parties = ['a', 'a2', 'b', 'c'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
  const s = { ...stage(), value: '20000', counter: '반소', counterValue: '10000', useIndividualValues: false,
    members: Object.fromEntries(parties.map(p => [p.id, {}])),
    costs: [{ ...cost('main', '10000'), shared: true, ids: ['a', 'a2'], method: '균분', claim: '공통', claimSplit: '소가 비율' }],
    rules: ['본소', '반소'].map(claim => ({ ...rule, id: claim, claim, n: '2', d: '5', left: ['a', 'a2'], right: ['b', 'c'], leftMethod: '균분' })),
  };
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  const counter = r.lines.find(l => l.owner === 'a' && l.debtor === 'b' && l.kind.includes('반소'));
  assert.deepEqual(counter.steps.map(s => money(s.amount)), ['10,000/3원', '5,000/3원', '1,000원', '500원']);
  assert.equal(money(counter.amount), '500원');
  assert.equal(money(r.lines.find(l => l.owner === 'a' && l.kind.includes('본소')).amount), '1,000원');
});
