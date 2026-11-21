const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, money, opponentAllocationGroups } = load('src/app/litigation-costs/costReview.ts');
const parties = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i ? '피신청인' : '신청인' }));
const cost = (payer, paid, extra = {}) => ({ id: payer, payer, kind: '송달료', paid: String(paid), refund: '0', shared: false, ids: [payer], ...extra });
const rule = (right, extra = {}) => ({ id: right.join('-'), left: ['a'], right, mode: '2측 전부 부담', scope: '1심 비용', rightMethod: '균분', ...extra });
const stage = (people, costs, rules, extra = {}) => ({ id: 'first', level: '1심', value: '100000000', useIndividualValues: false, members: Object.fromEntries(people.map(p => [p.id, {}])), costs, rules, ...extra });
const amounts = r => r.lines.map(l => [l.owner, l.debtor, money(l.amount)]);
const splitRules = () => [rule(['b', 'c'], { mode: '비율로 분담', n: '2', d: '5' }), rule(['d'])];

test('비용 한 건을 B·C 60%, D 100%로 계산하며 비용 귀속 합계는 한 번만 산입', () => {
  const s = stage(parties, [cost('a', 120000)], splitRules());
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '24,000원'], ['a', 'c', '24,000원'], ['a', 'd', '40,000원']]);
  assert.equal(money(r.ownerTotals.get('a')), '120,000원');
  assert.deepEqual(opponentAllocationGroups(s.costs[0], [s], 0, parties)[0].ids, ['b', 'c', 'd']);
});

test('같은 주문의 역방향 비용에도 각 비용 귀속자에게 해당하는 비율을 적용', () => {
  const s = stage(parties, [cost('b', 60000), cost('d', 20000)], splitRules());
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['b', 'a', '24,000원'], ['d', 'a', '0원']]);
});

test('소가 안분의 분모는 주문별 그룹이 아닌 전체 상대방 소가의 합', () => {
  const c = cost('a', 100000, { opponentMethod: '안분' });
  const s = stage(parties, [c], splitRules(), { useIndividualValues: true });
  s.members = { a: { value: '100000000' }, b: { value: '50000000' }, c: { value: '30000000' }, d: { value: '20000000' } };
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '30,000원'], ['a', 'c', '18,000원'], ['a', 'd', '20,000원']]);
});

test('소송총비용 주문의 대상이 줄어도 종전 전체 분모와 비상소자 부담을 유지', () => {
  const first = stage(parties, [cost('a', 120000)], [rule(['b', 'c', 'd'])]);
  const appeal = stage(parties.slice(0, 3), [], [rule(['b', 'c'], { scope: '소송총비용', mode: '비율로 분담', n: '2', d: '5' })], { id: 'appeal', level: '항소심' });
  const r = reviewCosts([first, appeal], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '24,000원'], ['a', 'c', '24,000원'], ['a', 'd', '40,000원']]);
  assert.match(r.lines[0].order, /항소심/);
  assert.match(r.lines[2].order, /1심/);
  assert.deepEqual(opponentAllocationGroups(first.costs[0], [first, appeal], 0, parties)[0].ids, ['b', 'c', 'd']);
});

test('이미 관계가 나뉜 사건에서도 상급심 주문은 해당 상대방만 변경', () => {
  const first = stage(parties, [cost('a', 120000)], splitRules());
  const appeal = stage(parties.slice(0, 2), [], [rule(['b'], { scope: '소송총비용', mode: '비율로 분담', n: '1', d: '2' })], { id: 'appeal', level: '항소심' });
  const r = reviewCosts([first, appeal], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '20,000원'], ['a', 'c', '24,000원'], ['a', 'd', '40,000원']]);
});

test('상소비용만 정한 주문은 종전 비용을 변경하지 않음', () => {
  const first = stage(parties, [cost('a', 120000)], splitRules());
  const appeal = stage(parties.slice(0, 2), [cost('a', 20000)], [rule(['b'], { scope: '항소심 비용' })], { id: 'appeal', level: '항소심' });
  const r = reviewCosts([first, appeal], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '24,000원'], ['a', 'c', '24,000원'], ['a', 'd', '40,000원'], ['a', 'b', '20,000원']]);
});

test('이전 주문이 없고 이후 주문도 일부 당사자뿐이면 누락된 부담을 임의 추정하지 않음', () => {
  const first = stage(parties, [cost('a', 120000)], []);
  const appeal = stage(parties.slice(0, 3), [], [rule(['b', 'c'], { scope: '소송총비용' })], { id: 'appeal', level: '항소심' });
  assert.match(reviewCosts([first, appeal], parties).errors[0], /종전 심급의 비용 범위/);
  appeal.members.d = {}; appeal.rules = splitRules().map(r => ({ ...r, scope: '소송총비용' }));
  const r = reviewCosts([first, appeal], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '24,000원'], ['a', 'c', '24,000원'], ['a', 'd', '40,000원']]);
});

test('같은 상대방의 부담 관계가 겹치면 중복 계산하지 않고 명시적 선택을 요구', () => {
  const s = stage(parties, [cost('a', 120000)], [rule(['b', 'c']), rule(['c', 'd'])]);
  assert.match(reviewCosts([s], parties).errors[0], /겹칩니다/);
  s.costs[0].ruleId = 'b-c';
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '60,000원'], ['a', 'c', '60,000원']]);
});

test('같은 상급심에 서로 겹치는 총비용 주문을 두면 차단', () => {
  const first = stage(parties, [cost('a', 120000)], [rule(['b', 'c', 'd'])]);
  const appeal = stage(parties, [], [rule(['b', 'c'], { scope: '소송총비용' }), rule(['c', 'd'], { scope: '소송총비용' })], { id: 'appeal', level: '항소심' });
  assert.match(reviewCosts([first, appeal], parties).errors[0], /소송총비용 주문이 겹칩니다/);
});

test('상대방 전체의 배분 기준이 불명확하면 선택을 요구', () => {
  const c = cost('a', 1);
  const s = stage(parties, [c], parties.slice(1).map(p => rule([p.id], { rightMethod: '' })));
  assert.match(reviewCosts([s], parties).errors[0], /상대방 전체의 비용 배분 기준/);
  c.opponentMethod = '균분';
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['0원', '0원', '0원']);
  assert.deepEqual(r.lines.map(l => money(l.exactAmount)), ['1/3원', '1/3원', '1/3원']);
});

test('신청외 상대방도 원래 분모에 포함하고 상소 참여자만 주문 갱신', () => {
  const people = parties.map(p => p.id === 'd' ? { ...p, group: '신청외', side: '피신청인측' } : p);
  const first = stage(people, [cost('a', 120000)], [rule(['b', 'c', 'd'])]);
  const appeal = stage(people.slice(0, 3), [], [rule(['b', 'c'], { scope: '소송총비용', mode: '각자 부담' })], { id: 'appeal', level: '항소심' });
  const r = reviewCosts([first, appeal], people);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '0원'], ['a', 'c', '0원'], ['a', 'd', '40,000원']]);
});

test('본소·반소별 주문과 상대방별 주문을 함께 적용해도 비용을 중복 산입하지 않음', () => {
  const people = parties.slice(0, 3);
  const c = cost('a', 300, { kind: '변호사보수', opponentMethod: '균분' });
  const s = stage(people, [c], [
    rule(['b'], { id: 'main-b', claim: '본소', mode: '비율로 분담', n: '2', d: '5' }),
    rule(['c'], { id: 'main-c', claim: '본소' }),
    rule(['b'], { id: 'counter-b', claim: '반소', mode: '비율로 분담', n: '1', d: '2' }),
    rule(['c'], { id: 'counter-c', claim: '반소' }),
  ], { counter: '반소', counterValue: '50000000', counterFeeMode: '합산' });
  const r = reviewCosts([s], people);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '60원'], ['a', 'c', '100원'], ['a', 'b', '20원'], ['a', 'c', '50원']]);
  assert.equal(money(r.ownerTotals.get('a')), '300원');
});

test('상급심에 새 당사자가 추가되어 과거 비용 범위를 넓히면 검토를 요구', () => {
  const first = stage(parties.slice(0, 3), [cost('a', 100)], [rule(['b', 'c'])]);
  const appeal = stage(parties, [], [rule(['b', 'c', 'd'], { scope: '소송총비용' })], { id: 'appeal', level: '항소심' });
  assert.match(reviewCosts([first, appeal], parties).errors[0], /비용 발생 심급의 참여자/);
});
