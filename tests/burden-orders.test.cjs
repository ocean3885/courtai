const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { suggestedOrder, patchOrder, summarizeOrders, orderIssues } = load('src/app/litigation-costs/burdenOrders.ts');
const { reviewCosts, money } = load('src/app/litigation-costs/costReview.ts');
const parties = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i ? '피신청인' : '신청인' }));
const stage = (id, level, ids) => ({ id, level, value: '100000000', counter: '', costs: [], rules: [], members: Object.fromEntries(ids.map(id => [id, {}])) });
const cost = (id, payer, paid) => ({ id, payer, kind: '송달료', paid: String(paid), refund: '0', shared: false, ids: [payer] });
function fixture() {
  const first = stage('first', '1심', ['a', 'b', 'c', 'd']);
  first.rules = [suggestedOrder(first, parties, 0, 'r1')];
  first.costs = [cost('first-a', 'a', 120000)];
  const appeal = stage('appeal', '항소심', ['a', 'c', 'd']);
  const rule = suggestedOrder(appeal, parties, 1, 'r2');
  appeal.rules = patchOrder(appeal, rule, { scope: '소송총비용', mode: '비율로 분담', n: '2', d: '5' });
  return [first, appeal];
}

test('주문 기본 대상은 해당 심급 참여자이며 신청외도 소속 측에 포함', () => {
  const people = [...parties, { id: 'x', group: '신청외', side: '신청인측' }];
  const s = stage('appeal', '항소심', ['a', 'c', 'd', 'x']);
  const r = suggestedOrder(s, people, 1, 'new');
  assert.deepEqual(r.left, ['a', 'x']);
  assert.deepEqual(r.right, ['c', 'd']);
  assert.equal(r.scope, '항소심 비용');
  assert.deepEqual(s.rules, []);
});

test('일부 피고 항소: 최종 주문은 비항소자만 1심, 나머지 두 명은 항소심이며 원래 분모는 유지', () => {
  const stages = fixture();
  const summary = summarizeOrders(stages, parties);
  assert.deepEqual(summary.issues, []);
  assert.deepEqual(summary.rows.filter(r => r.stage === 0).map(r => [r.opponent, r.source]), [['b', 0], ['c', 1], ['d', 1]]);
  const result = reviewCosts(stages, parties);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.map(l => [l.debtor, money(l.amount)]), [['b', '40,000원'], ['c', '24,000원'], ['d', '24,000원']]);
  assert.deepEqual(stages[0].rules[0].right, ['b', 'c', 'd']);
  assert.deepEqual(Object.keys(stages[0].members), ['a', 'b', 'c', 'd']);
});

test('항소심 비용만 적용하면 세 피고의 1심 부담은 모두 원래 주문 유지', () => {
  const stages = fixture();
  stages[1].rules[0].scope = '항소심 비용';
  stages[1].costs = [cost('appeal-a', 'a', 20000)];
  assert.deepEqual(summarizeOrders(stages, parties).rows.filter(r => r.stage === 0).map(r => r.source), [0, 0, 0]);
  const result = reviewCosts(stages, parties);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.map(l => [l.debtor, money(l.amount)]), [['b', '40,000원'], ['c', '40,000원'], ['d', '40,000원'], ['c', '6,000원'], ['d', '6,000원']]);
});

test('신청인 전부 부담 및 각자 부담으로 변경해도 비항소자 부담과 적용 대상 유지', () => {
  for (const mode of ['1측 전부 부담', '각자 부담']) {
    const stages = fixture();
    const before = structuredClone(stages[1].rules[0]);
    stages[1].rules = patchOrder(stages[1], before, { mode });
    assert.deepEqual(stages[1].rules[0].right, ['c', 'd']);
    assert.equal(stages[1].rules[0].scope, '소송총비용');
    const result = reviewCosts(stages, parties);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.lines.map(l => [l.debtor, money(l.amount)]), [['b', '40,000원'], ['c', '0원'], ['d', '0원']]);
  }
});

test('개별 주문 수정은 다른 주문·ID·정확한 분수를 보존하며 직렬화 후에도 최종 적용 결과 동일', () => {
  const stages = fixture();
  const extra = { ...stages[0].rules[0], id: 'other', right: ['b'] };
  const first = { ...stages[0], rules: [{ ...stages[0].rules[0], right: ['c', 'd'] }, extra] };
  const rules = patchOrder(first, first.rules[0], { n: '1', d: '3', mode: '비율로 분담' });
  assert.strictEqual(rules[1], extra);
  assert.equal(rules[0].id, first.rules[0].id);
  const restored = JSON.parse(JSON.stringify(stages));
  assert.deepEqual(summarizeOrders(restored, parties), summarizeOrders(stages, parties));
  assert.deepEqual(reviewCosts(restored, parties).lines, reviewCosts(stages, parties).lines);
});

test('비용 입력 전에도 대상 누락·비참여자·중복 관계와 잘못된 비율을 안내', () => {
  const stages = fixture();
  const appeal = stages[1];
  assert.match(orderIssues(appeal, { ...appeal.rules[0], left: [] }, parties).join(), /양측 당사자/);
  assert.match(orderIssues(appeal, { ...appeal.rules[0], right: ['b'] }, parties).join(), /비참여자/);
  for (const [n, d] of [['', '2'], ['1', '0'], ['3', '2']]) {
    assert.match(orderIssues(appeal, { ...appeal.rules[0], n, d }, parties).join(), /분모/);
  }
  appeal.rules.push({ ...appeal.rules[0], id: 'duplicate' });
  assert.match(summarizeOrders(stages, parties).issues.join(), /겹칩니다/);
});

test('1심 주문 없이 항소심 소송총비용 주문만으로 양측 비용과 원래 전체 배분 대상 계산', () => {
  const first = stage('first', '1심', ['a', 'b', 'c', 'd']);
  first.costs = [cost('first-a', 'a', 120000), cost('first-b', 'b', 20000)];
  const appeal = stage('appeal', '항소심', ['a', 'b', 'c', 'd']);
  appeal.rules = [{ ...suggestedOrder(appeal, parties, 1, 'total'), scope: '소송총비용', mode: '비율로 분담', n: '2', d: '5' }];
  appeal.costs = [cost('appeal-a', 'a', 20000)];
  const stages = [first, appeal];
  const summary = summarizeOrders(stages, parties);
  assert.deepEqual(summary.issues, []);
  assert.equal(summary.rows.length, 6);
  assert(summary.rows.every(r => r.source === 1));
  const result = reviewCosts(stages, parties);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.filter(l => l.owner === 'a').slice(0, 3).map(l => [l.debtor, money(l.amount)]), [['b', '24,000원'], ['c', '24,000원'], ['d', '24,000원']]);
  assert.equal(money(result.lines.find(l => l.owner === 'b').amount), '8,000원');
  assert.deepEqual(first.rules, []);
  assert.deepEqual(Object.keys(first.members), ['a', 'b', 'c', 'd']);
  assert.deepEqual(summarizeOrders(JSON.parse(JSON.stringify(stages)), parties), summary);
});

test('1심 주문 생략 시 항소심 비용만 정한 주문 또는 일부 피고 주문으로 누락 관계를 추정하지 않음', () => {
  for (const scope of ['소송총비용', '항소심 비용']) {
    const stages = fixture();
    stages[0].rules = [];
    stages[1].rules[0].scope = scope;
    const summary = summarizeOrders(stages, parties);
    assert.match(summary.issues.join(), /1심 주문 입력을 생략하려면/);
    assert.equal(summary.rows.filter(r => r.stage === 0).length, 0);
    assert(reviewCosts(stages, parties).errors.length > 0);
  }
});

test('같은 심급의 동일 당사자 관계 중복을 양방향으로 차단하고 다른 관계는 허용', () => {
  const { canSelectOrderParty, conflictingOrderPairs } = load('src/app/litigation-costs/burdenOrders.ts');
  const s = stage('first', '1심', ['a', 'a2', 'b', 'c']);
  const original = { ...suggestedOrder(s, [...parties, { id: 'a2', group: '신청인' }], 0, 'one'), left: ['a'], right: ['b'] };
  const next = { ...original, id: 'two', left: [], right: [] };
  s.rules = [original, next];
  const applicantFirst = { ...next, left: ['a'] };
  assert.equal(canSelectOrderParty(s, applicantFirst, 'right', 'b'), false);
  assert.equal(canSelectOrderParty(s, applicantFirst, 'right', 'c'), true);
  const respondentFirst = { ...next, right: ['b'] };
  assert.equal(canSelectOrderParty(s, respondentFirst, 'left', 'a'), false);
  assert.equal(canSelectOrderParty(s, respondentFirst, 'left', 'a2'), true);
  assert.deepEqual(patchOrder(s, applicantFirst, { right: ['b'] }), s.rules);
  assert.deepEqual(patchOrder(s, next, { left: ['a'], right: ['b', 'c'] }), s.rules);
  assert.deepEqual(conflictingOrderPairs(s, { ...next, left: ['a'], right: ['c'] }), []);
});

test('기존 중복 선택은 해제 가능하고 본소·반소 및 다른 심급은 독립적으로 선택', () => {
  const { canSelectOrderParty, conflictingOrderPairs } = load('src/app/litigation-costs/burdenOrders.ts');
  const s = stage('first', '1심', ['a', 'b', 'c']);
  const one = { ...suggestedOrder(s, parties, 0, 'one'), right: ['b'], claim: '본소' };
  const two = { ...one, id: 'two', claim: '반소' };
  s.rules = [one, two];
  assert.deepEqual(conflictingOrderPairs(s, two), []);
  assert.deepEqual(patchOrder(s, two, { claim: '본소와 반소' }), s.rules);
  two.claim = '본소';
  assert.equal(canSelectOrderParty(s, two, 'right', 'b'), true);
  assert.deepEqual(patchOrder(s, two, { right: [] })[1].right, []);
  assert.match(orderIssues(s, two, parties).join(), /중복/);
  const appeal = { ...s, id: 'appeal', level: '항소심', rules: [{ ...one, id: 'appeal-rule' }] };
  assert.deepEqual(conflictingOrderPairs(appeal, appeal.rules[0]), []);
});
