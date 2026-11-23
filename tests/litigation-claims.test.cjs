const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, resolveFeeBasisValue, money, inferredCostClaim } = load('src/app/litigation-costs/costReview.ts');
const parties = [{ id: 'a', name: 'A', group: '신청인' }, { id: 'b', name: 'B', group: '피신청인' }];
const cost = (payer, kind, paid, extra = {}) => ({ id: payer + kind, payer, kind, paid: String(paid), refund: '0', shared: false, ids: [payer], ...extra });
const rule = (claim, mode, extra = {}) => ({ id: claim, left: ['a'], right: ['b'], claim, mode, scope: '1심 비용', ...extra });
const stage = (costs, rules) => ({
  id: 'first', level: '1심', value: '100000000', counter: '반소', counterValue: '50000000',
  counterFeeMode: '합산', mainValueTarget: '신청인측', useIndividualValues: false,
  members: { a: { role: '원고', counterRole: '반소피고' }, b: { role: '피고', counterRole: '반소원고' } },
  costs, rules,
});
const separateRules = () => [rule('본소', '1측 전부 부담'), rule('반소', '2측 전부 부담')];
const lineAmount = (result, owner, claim) => money(result.lines.find(l => l.owner === owner && l.kind.includes(claim)).amount);

test('양측 보수에 본소·반소 합산 또는 흡수를 적용하고 인지 입력액은 유지', () => {
  const fees = [cost('a', '변호사보수', 20000000), cost('b', '변호사보수', 20000000)];
  const s = stage([...fees, cost('a', '인지대', 12345), cost('b', '인지대', 6789)], [rule('본소와 반소', '비율로 분담', { n: '1', d: '2' })]);
  const summed = reviewCosts([s], parties);
  assert.deepEqual(summed.errors, []);
  for (const fee of fees) assert.equal(resolveFeeBasisValue(fee, s, parties), 150000000n);
  assert.equal(money(summed.ownerTotals.get('a')), '9,412,345원');
  assert.equal(money(summed.ownerTotals.get('b')), '9,406,789원');
  s.counterFeeMode = '흡수';
  const absorbed = reviewCosts([s], parties);
  for (const fee of fees) assert.equal(resolveFeeBasisValue(fee, s, parties), 100000000n);
  assert.equal(money(absorbed.ownerTotals.get('a')), '7,412,345원');
  assert.equal(money(absorbed.ownerTotals.get('b')), '7,406,789원');
  assert.deepEqual(s.costs.filter(c => c.kind === '인지대').map(c => c.paid), ['12345', '6789']);
});

test('보수 대리 범위가 한 청구뿐이면 그 소가만 사용하며 당사자의 신청측과 무관', () => {
  const a = cost('a', '변호사보수', 20000000, { claim: '반소' });
  const b = cost('b', '변호사보수', 20000000, { claim: '본소' });
  const s = stage([a, b], [rule('본소와 반소', '각자 부담')]);
  assert.equal(resolveFeeBasisValue(a, s, parties), 50000000n);
  assert.equal(resolveFeeBasisValue(b, s, parties), 100000000n);
  const result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(money(result.ownerTotals.get('a')), '4,400,000원');
  assert.equal(money(result.ownerTotals.get('b')), '7,400,000원');
});

test('본소·반소를 함께 대리한 보수는 소가가 누락되면 계산을 차단', () => {
  const s = stage([cost('a', '변호사보수', 1000000)], [rule('본소와 반소', '2측 전부 부담')]);
  s.counterValue = '';
  assert.match(reviewCosts([s], parties).errors[0], /본소·반소 소가/);
  s.costs[0].claim = '본소';
  assert.deepEqual(reviewCosts([s], parties).errors, []);
});

test('본소·반소 인지대를 각 제기자의 지출로 유지하고 서로 다른 주문 적용', () => {
  const s = stage([cost('a', '인지대', 120, { refund: '20' }), cost('b', '인지대', 50)], separateRules());
  assert.equal(inferredCostClaim(s.costs[0], s, parties), '본소');
  assert.equal(inferredCostClaim(s.costs[1], s, parties), '반소');
  const result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(money(result.ownerTotals.get('a')), '100원');
  assert.equal(money(result.ownerTotals.get('b')), '50원');
  assert.equal(lineAmount(result, 'a', '본소'), '0원');
  assert.equal(lineAmount(result, 'b', '반소'), '0원');
});

test('인지대의 청구가 불명확하면 담당자 지정이 필요하고 명시한 지정이 자동 연결보다 우선', () => {
  const s = stage([cost('a', '인지대', 100)], separateRules());
  s.mainValueTarget = undefined; s.members.a = {};
  assert.match(reviewCosts([s], parties).errors[0], /어느 청구/);
  s.costs[0].claim = '반소';
  const result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(lineAmount(result, 'a', '반소'), '100원');
});

test('공통보수를 한 번만 인정하고 소가 비율로 나눈 후 청구별 주문 적용', () => {
  const s = stage([cost('a', '변호사보수', 300), cost('b', '변호사보수', 300)], separateRules());
  const result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(money(result.ownerTotals.get('a')), '300원');
  assert.equal(money(result.ownerTotals.get('b')), '300원');
  assert.equal(lineAmount(result, 'a', '본소'), '0원');
  assert.equal(lineAmount(result, 'a', '반소'), '100원');
  assert.equal(lineAmount(result, 'b', '본소'), '200원');
  assert.equal(lineAmount(result, 'b', '반소'), '0원');
  s.counterFeeMode = '흡수';
  assert.equal(lineAmount(reviewCosts([s], parties), 'a', '반소'), '100원', '보수 한도의 흡수는 공통비용 배분비율을 바꾸지 않는다');
});

test('기타 공통비용의 균분·소가 비율 배분에 중간 절사 없이 계산', () => {
  const c = cost('a', '송달료', 500);
  const s = stage([c], separateRules());
  let result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(lineAmount(result, 'a', '반소'), '250원');
  c.claimSplit = '소가 비율';
  result = reviewCosts([s], parties);
  assert.equal(lineAmount(result, 'a', '반소'), '500/3원');
  c.claim = '본소';
  assert.equal(reviewCosts([s], parties).lines.length, 1);
});

test('공통비용의 본소·반소 주문 중 한 쪽이 빠지면 계산을 누락하지 않고 안내', () => {
  const s = stage([cost('a', '송달료', 5)], [rule('본소', '1측 전부 부담')]);
  const result = reviewCosts([s], parties);
  assert.equal(result.lines.length, 0);
  assert.match(result.errors[0], /부담 관계/);
});

test('다른 당사자 사이의 청구별 주문 때문에 무관한 비용을 분리하지 않는다', () => {
  const people = [...parties, { id: 'c', group: '신청인' }, { id: 'd', group: '피신청인' }];
  const s = stage([cost('c', '송달료', 10)], [...separateRules(), rule('본소와 반소', '2측 전부 부담', { left: ['c'], right: ['d'] })]);
  s.members.c = {}; s.members.d = {}; s.counterValue = '';
  const result = reviewCosts([s], people);
  assert.deepEqual(result.errors, []);
  assert.equal(result.lines.length, 1);
  assert.equal(money(result.lines[0].amount), '10원');
});

test('상급심의 본소 소송총비용 주문은 본소 부분만 대체', () => {
  const first = stage([cost('a', '변호사보수', 300)], separateRules());
  const appeal = { ...stage([], [rule('본소', '2측 전부 부담', { scope: '소송총비용' })]), id: 'appeal', level: '항소심' };
  const result = reviewCosts([first, appeal], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(lineAmount(result, 'a', '본소'), '200원');
  assert.equal(lineAmount(result, 'a', '반소'), '100원');
  assert.match(result.lines.find(l => l.kind.includes('본소')).order, /항소심/);
  assert.match(result.lines.find(l => l.kind.includes('반소')).order, /1심/);
});

test('공통비용의 청구별 부담 관계를 각각 지정', () => {
  const c = cost('a', '송달료', 100, { mainRuleId: 'main2', counterRuleId: 'counter' });
  const s = stage([c], [rule('본소', '1측 전부 부담', { id: 'main1' }), rule('본소', '2측 전부 부담', { id: 'main2' }), rule('반소', '2측 전부 부담', { id: 'counter' })]);
  const result = reviewCosts([s], parties);
  assert.deepEqual(result.errors, []);
  assert.equal(lineAmount(result, 'a', '본소'), '50원');
  assert.equal(lineAmount(result, 'a', '반소'), '50원');
  c.mainRuleId = 'counter';
  assert.match(reviewCosts([s], parties).errors[0], /선택한 부담 관계/);
});

test('신청외 당사자의 몫을 유지하면서 공통보수를 청구별·당사자별 배분', () => {
  const people = [parties[0], { id: 'a2', group: '신청인' }, { id: 'ax', group: '신청외', side: '신청인측' }, parties[1]];
  const s = stage([cost('a', '변호사보수', 300, { shared: true, ids: ['a', 'a2', 'ax'], method: '안분' })], separateRules().map(r => ({ ...r, left: ['a', 'a2', 'ax'], leftMethod: '안분' })));
  s.useIndividualValues = true;
  s.members = { a: { value: '60000000' }, a2: { value: '30000000' }, ax: { value: '10000000' }, b: {} };
  const result = reviewCosts([s], people);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.filter(l => l.kind.includes('반소')).map(l => [l.owner, money(l.amount)]), [['a', '60원'], ['a2', '30원'], ['ax', '10원']]);
  assert.equal(money(result.ownerTotals.get('ax')), '30원');
});

test('일부 당사자 대리와 개별소가 누락에도 입력한 본소·반소 소가로 한도 계산', () => {
  const people = [...parties, { id: 'ax', group: '신청외', side: '신청인측' }];
  const s = stage([], []);
  s.useIndividualValues = true;
  s.members = { a: { value: '60000000' }, ax: { value: '40000000' }, b: {} };
  assert.equal(resolveFeeBasisValue(cost('a', '변호사보수', 1000000), s, people), 150000000n);
  s.members.a.value = '';
  assert.equal(resolveFeeBasisValue(cost('a', '변호사보수', 1000000), s, people), 150000000n, '개별소가 누락은 입력한 전체 소가 기준 한도를 바꾸지 않는다');
});
