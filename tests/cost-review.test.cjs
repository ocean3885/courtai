const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, money, subtract } = load('src/app/litigation-costs/costReview.ts');
const party = (id, group) => ({ id, name: id, group });
const parties = [party('a', '신청인'), party('b', '피신청인')];
const cost = (payer, paid) => ({ payer, paid, kind: '인지대', refund: '0', shared: false });
const rule = (right, mode, scope = '1심 비용') => ({
  left: ['a'],
  right,
  mode,
  scope,
  n: '1',
  d: '3',
  rightMethod: '균분',
});
const stage = (people, costs, rules) => ({
  value: '50000000',
  members: Object.fromEntries(people.map((p) => [p.id, { value: '1' }])),
  costs,
  rules,
});
test('쌍방 분담액과 상계 차액', () => {
  const r = reviewCosts(
    [stage(parties, [cost('a', '300000'), cost('b', '120000')], [rule(['b'], '비율로 분담')])],
    parties
  );
  assert.deepEqual(r.errors, []);
  const [forward, reverse] = r.lines.map((l) => l.amount);
  assert.deepEqual(
    [money(forward), money(reverse), money(subtract(forward, reverse))],
    ['200,000원', '40,000원', '160,000원']
  );
});
test('원고 1 피고 4 중 신청외 몫 보존, 한 명의 항소비용만 별도 가산', () => {
  const people = [...parties, party('c', '피신청인'), party('d', '피신청인'), party('e', '신청외')];
  const first = stage(people, [cost('a', '120000')], [rule(['b', 'c', 'd', 'e'], '2측 전부 부담')]);
  const appeal = stage(
    [people[0], people[2]],
    [cost('a', '20000')],
    [rule(['c'], '2측 전부 부담', '항소심 비용')]
  );
  const r = reviewCosts([first, appeal], people);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.lines.map((l) => [l.debtor, l.amount.n]),
    [
      ['b', 30000n],
      ['c', 30000n],
      ['d', 30000n],
      ['e', 30000n],
      ['c', 20000n],
    ]
  );
  appeal.rules[0].scope = '소송총비용';
  assert.equal(reviewCosts([first, appeal], people).lines.length, 0);
});
test('동일 당사자 소송총비용 주문은 종전 주문을 대체하고 분수를 유지', () => {
  const r = reviewCosts(
    [
      stage(parties, [cost('a', '110000')], [rule(['b'], '2측 전부 부담')]),
      stage(parties, [cost('a', '20000')], [rule(['b'], '비율로 분담', '소송총비용')]),
    ],
    parties
  );
  assert.deepEqual(
    r.lines.map((l) => money(l.amount)),
    ['220,000/3원', '40,000/3원']
  );
});
test('소가 안분과 인정액, 공란과 명시적 0원', () => {
  const first = stage(
    parties,
    [{ ...cost('a', '300'), shared: true, ids: ['a', 'b'], method: '소가 비율', recognized: '240' }],
    [rule(['b'], '비율로 분담')]
  );
  first.members.a.value = '2';
  const result = reviewCosts([first], parties);
  assert.equal(money(result.ownerTotals.get('a')), '160원');
  first.members.a.value = '';
  assert.ok(reviewCosts([first], parties).errors.length);
  first.costs = [cost('a', '0')];
  assert.equal(money(reviewCosts([first], parties).lines[0].amount), '0원');
  first.costs[0].paid = '';
  assert.ok(reviewCosts([first], parties).errors.length);
});
test('비용별로 적용 당사자가 다른 경우 선택한 관계로만 배분', () => {
  const people = [...parties, party('c', '피신청인')];
  const s = stage(
    people,
    [cost('a', '120')],
    [
      { ...rule(['b'], '2측 전부 부담'), id: 'one' },
      { ...rule(['c'], '각자 부담'), id: 'two' },
    ]
  );
  assert.ok(reviewCosts([s], people).errors.length);
  s.costs[0].ruleId = 'one';
  assert.deepEqual(
    reviewCosts([s], people).lines.map((l) => [l.debtor, l.amount.n]),
    [['b', 120n]]
  );
});
