const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewAutomaticApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const { money } = load('src/app/litigation-costs/costReview.ts');
const parties = ['a', 'a2', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
const cost = (paid = '1200') => ({ id: 'application', kind: '인지대', paid, refund: '0', payer: '', ids: [], shared: false, method: '' });
const rule = (id, right, extra = {}) => ({ id, left: ['a', 'a2'], right, mode: '2측 전부 부담', n: '1', d: '2', scope: '1심 비용', claim: '', leftMethod: '균분', rightMethod: '균분', ...extra });
const stage = (id, level, people, rules) => ({ id, level, members: Object.fromEntries(people.map(p => [p.id, {}])), costs: [], rules });
function fixture(scope = '소송총비용') {
  return [stage('first', '1심', parties, [rule('r1', ['b', 'c', 'd'])]),
    stage('appeal', '항소심', parties.filter(p => p.id !== 'b'), [rule('r2', ['c', 'd'], { scope, mode: '비율로 분담', n: '2', d: '5' })])];
}
const amounts = r => r.lines.map(l => [l.owner, l.debtor, money(l.amount)]);

test('별도 귀속·대상 선택 없이 신청인과 피신청인 균분 후 부분항소의 관계별 주문 적용', () => {
  const costs = [cost()];
  const before = structuredClone(costs);
  const result = reviewAutomaticApplicationCosts(costs, parties, fixture());
  assert.deepEqual(result.errors, []);
  assert.deepEqual(amounts(result), [['a', 'b', '200원'], ['a', 'c', '120원'], ['a', 'd', '120원'], ['a2', 'b', '200원'], ['a2', 'c', '120원'], ['a2', 'd', '120원']]);
  assert.match(result.lines[0].basis, /1심/);
  assert.match(result.lines[1].basis, /항소심/);
  assert.deepEqual(costs, before);
});

test('항소심 비용만 정한 경우에도 새 신청비용에는 해당 관계의 마지막 입력 주문을 사용', () => {
  const result = reviewAutomaticApplicationCosts([cost()], parties, fixture('항소심 비용'));
  assert.deepEqual(result.errors, []);
  assert.deepEqual(amounts(result).slice(0, 3), [['a', 'b', '200원'], ['a', 'c', '120원'], ['a', 'd', '120원']]);
});

test('1심 주문 생략 후 전체 관계의 항소심 주문만으로 자동 배분', () => {
  const stages = fixture();
  stages[0].rules = [];
  stages[1].members = stages[0].members;
  stages[1].rules[0].right = ['b', 'c', 'd'];
  const r = reviewAutomaticApplicationCosts([cost()], parties, stages);
  assert.deepEqual(r.errors, []);
  assert(r.lines.every(l => money(l.amount) === '120원' && l.basis.includes('항소심')));
});

test('판결 비율과 당사자 변경은 모든 신청비용에 즉시 반영되며 과거 수동 배분값은 사용하지 않음', () => {
  const stages = fixture();
  const input = { ...cost(), payer: 'a', ids: ['a'], application: { useCommon: false, opponentIds: ['b'], rates: { a: { b: { n: '0', d: '1' } } } } };
  let r = reviewAutomaticApplicationCosts([input, { ...cost('600'), id: 'second' }], parties, stages);
  assert.equal(r.lines.length, 12);
  assert.equal(money(r.lines[0].amount), '200원');
  stages[1].rules[0].n = '1'; stages[1].rules[0].d = '2';
  r = reviewAutomaticApplicationCosts([input], parties, stages);
  assert.equal(money(r.lines[1].amount), '100원');
  const p = parties.filter(p => p.id !== 'a2');
  r = reviewAutomaticApplicationCosts([input], p, stages.map(s => ({ ...s, rules: s.rules.map(r => ({ ...r, left: ['a'] })) })));
  assert.deepEqual(amounts(r), [['a', 'b', '400원'], ['a', 'c', '200원'], ['a', 'd', '200원']]);
});

test('누락 관계와 잘못된 최신 주문은 종전 비율로 추정하지 않고 판결 주문 보완 안내', () => {
  const stages = fixture();
  stages[0].rules = [];
  let r = reviewAutomaticApplicationCosts([cost()], parties, stages);
  assert.deepEqual(r.lines, []);
  assert.match(r.errors[0], /신청인 1.*피신청인 1.*판결 주문 입력/);
  stages[0].rules = [rule('r1', ['b', 'c', 'd'])];
  stages[1].rules[0].d = '0';
  r = reviewAutomaticApplicationCosts([cost()], parties, stages);
  assert.deepEqual(r.lines, []);
  assert.match(r.errors[0], /항소심 판결 주문/);
});

test('중복 주문 및 본소·반소의 다른 부담비율은 자동 추정하지 않음', () => {
  const stages = fixture();
  stages[1].rules.push({ ...stages[1].rules[0], id: 'duplicate' });
  assert.match(reviewAutomaticApplicationCosts([cost()], parties, stages).errors[0], /중복/);
  stages[1].counter = '1';
  stages[1].rules[0].claim = '본소';
  stages[1].rules[1].claim = '반소';
  stages[1].rules[1].n = '1';
  assert.match(reviewAutomaticApplicationCosts([cost()], parties, stages).errors[0], /부담비율이 달라/);
  stages[1].rules[1].n = '2';
  assert.deepEqual(reviewAutomaticApplicationCosts([cost()], parties, stages).errors, []);
});
