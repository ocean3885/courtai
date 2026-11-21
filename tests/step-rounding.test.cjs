const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateSteps, fraction, money, reviewCosts, add, nothing, subtract } = load('src/app/litigation-costs/costReview.ts');
const { reviewApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const part = (n, d, label) => ({ factor: fraction(BigInt(n), BigInt(d)), label });

test('나눗셈 결과를 10원 미만 버린 금액이 다음 부담률 계산의 입력', () => {
  const r = calculateSteps(fraction(10000n), [part(1, 3, '상대방별 배분'), part(3, 5, '부담률 적용')]);
  assert.equal(money(r.amount), '1,990원');
  assert.equal(money(r.exactAmount), '2,000원');
  assert.deepEqual(r.steps.map(s => money(s.amount)), ['3,330원', '1,990원']);
  assert.equal(money(r.steps[1].input), '3,330원');
  assert.equal(money(r.steps[1].raw), '1,998원');
  assert.equal(money(r.steps[1].discarded), '8원');
});

test('청구 배분·공동 귀속·상대방 배분·부담률의 순서를 고정', () => {
  const r = calculateSteps(fraction(10000n), [part(1, 3, '본소·반소 배분'), part(1, 2, '공동비용 귀속'), part(1, 2, '상대방별 배분'), part(3, 5, '부담률 적용')]);
  assert.deepEqual(r.steps.map(s => money(s.amount)), ['3,330원', '1,660원', '830원', '490원']);
  assert.equal(money(r.exactAmount), '500원');
  for (let i = 1; i < r.steps.length; i++) assert.deepEqual(r.steps[i].input, r.steps[i - 1].amount);
});

test('정수 결과도 10원 단위로 버리지만 배분 없는 비용과 0원은 보존', () => {
  assert.equal(money(calculateSteps(fraction(50n), [part(1, 2, '배분')]).amount), '20원');
  assert.equal(money(calculateSteps(fraction(5n), [part(1, 2, '배분')]).amount), '0원');
  assert.equal(money(calculateSteps(fraction(961n), [part(1, 1, '귀속'), part(1, 1, '부담')]).amount), '961원');
  assert.equal(calculateSteps(fraction(961n), [part(1, 1, '부담')]).steps.length, 0);
  assert.equal(money(calculateSteps(fraction(0n), [part(1, 3, '배분')]).amount), '0원');
  assert.equal(money(calculateSteps(fraction(100n), [part(0, 1, '부담 없음')]).amount), '0원');
});

test('큰 금액도 부동소수점 없이 계산하고 정밀 비교 모드는 별도로 보존', () => {
  const factors = [part(1, 3, '배분'), part(2, 5, '부담')];
  assert.equal(calculateSteps(fraction(9999999999999999n), factors).amount.n, 1333333333333330n);
  const exact = calculateSteps(fraction(10000n), factors, '정밀');
  assert.deepEqual(exact.amount, exact.exactAmount);
});

const people = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i ? '피신청인' : '신청인' }));
const cost = (id = 'main', paid = '10000', payer = 'a') => ({ id, paid, payer, kind: '송달료', refund: '0', ids: [payer], shared: false, method: '' });
const rule = { id: 'r', left: ['a'], right: ['b', 'c', 'd'], mode: '비율로 분담', n: '2', d: '5', scope: '1심 비용', rightMethod: '균분' };
const stage = () => ({ id: 'first', level: '1심', members: Object.fromEntries(people.map(p => [p.id, {}])), rules: [{ ...rule }], costs: [cost()] });

test('본안과 공통 판결 기준을 따르는 신청비용이 동일한 단계별 계산을 사용', () => {
  const s = stage();
  const main = reviewCosts([s], people);
  const app = reviewApplicationCosts([cost('app')], people, [s], { mode: '판결 기준', stageId: 'first' });
  assert.deepEqual(main.errors, []); assert.deepEqual(app.errors, []);
  for (const result of [main, app]) {
    assert.deepEqual(result.lines.map(l => money(l.amount)), ['1,990원', '1,990원', '1,990원']);
    assert.equal(money(result.lines.reduce((sum, l) => add(sum, l.amount), nothing)), '5,970원');
    assert.equal(money(result.lines[0].exactAmount), '2,000원');
  }
  assert.deepEqual(main.lines[0].steps, app.lines[0].steps);
});

test('절사된 행들을 합산·상계하며 원래 인정 비용으로 재계산하지 않음', () => {
  const s = stage(); s.costs.push(cost('reverse', '10003', 'b'));
  const r = reviewCosts([s], people);
  const forward = r.lines.find(l => l.owner === 'a' && l.debtor === 'b').amount;
  const reverse = r.lines.find(l => l.owner === 'b').amount;
  assert.equal(money(reverse), '4,000원');
  assert.equal(money(subtract(forward, reverse)), '-2,010원');
});

test('부분 상소에도 원래 상대방 분모를 적용하고 각 단계 절사', () => {
  const first = stage(); first.rules[0].mode = '2측 전부 부담';
  const appeal = { ...stage(), id: 'appeal', level: '항소심', members: { a: {}, b: {}, c: {} }, costs: [], rules: [{ ...rule, right: ['b', 'c'], scope: '소송총비용', n: '1', d: '2' }] };
  const r = reviewCosts([first, appeal], people);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['1,660원', '1,660원', '3,330원']);
  assert.equal(money(r.lines[0].steps[0].amount), '3,330원');
});

test('본소·반소 공통비용의 실제 계산 경로에 네 단계 절사를 적용', () => {
  const parties = ['a', 'a2', 'b', 'c'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
  const s = { ...stage(), value: '20000', counter: '반소', counterValue: '10000', useIndividualValues: false,
    members: Object.fromEntries(parties.map(p => [p.id, {}])),
    costs: [{ ...cost(), shared: true, ids: ['a', 'a2'], method: '균분', claim: '공통', claimSplit: '소가 비율' }],
    rules: ['본소', '반소'].map(claim => ({ ...rule, id: claim, claim, left: ['a', 'a2'], right: ['b', 'c'], leftMethod: '균분' })),
  };
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  const counter = r.lines.find(l => l.owner === 'a' && l.debtor === 'b' && l.kind.includes('반소'));
  assert.deepEqual(counter.steps.map(s => money(s.amount)), ['3,330원', '1,660원', '830원', '490원']);
  assert.equal(money(counter.exactAmount), '500원');
  assert.equal(money(r.lines.find(l => l.owner === 'a' && l.kind.includes('본소')).amount), '990원');
});
