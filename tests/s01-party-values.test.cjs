const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, resolveFeeBasisValue, allocationMemberValue, stageEffectiveValue, money } = load('src/app/litigation-costs/costReview.ts');

const parties = ['a1', 'a2', 'b1', 'b2'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
const fee = (payer, ids, method) => ({ id: payer, payer, ids, method, kind: '변호사보수', paid: '20000000', refund: '0', shared: ids.length > 1 });
const fixture = () => ({ id: 'first', level: '1심', value: '105355798', mainValueTarget: '신청인측', useIndividualValues: true,
  applicantValueMode: '합산', opponentValueMode: '합산', counter: '',
  members: { a1: { value: '52677899' }, a2: { value: '52677899' }, b1: { value: '105361798' }, b2: { value: '57144171' } },
  costs: [fee('a1', ['a1', 'a2'], '균분'), fee('b1', ['b1', 'b2'], '안분')],
  rules: [{ id: 'r', left: ['a1', 'a2'], right: ['b1', 'b2'], mode: '비율로 분담', n: '1', d: '3', scope: '1심 비용', leftMethod: '균분', rightMethod: '균분' }],
});

test('S01 양측 공동보수는 각각 선택한 당사자 소가 합산을 기준으로 한도 산정', () => {
  const s = fixture();
  assert.equal(resolveFeeBasisValue(s.costs[0], s, parties), 105355798n);
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), 162505969n);
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert.equal(money(r.ownerTotals.get('a1')), '7,614,231/2원');
  // 원지출 귀속 총액은 검토용 정밀값. 계산 행에는 단계별 10원 절사액을 사용한다.
  // 9,400,000 + (162,505,969 - 150,000,000) × 2% = 9,650,119원
  assert.equal(r.lines.find(l => l.owner === 'b1').steps[0].input.n, 9650119n);
  assert.equal(allocationMemberValue(s, parties[2]), 105361798n);
  assert.equal(allocationMemberValue(s, parties[3]), 57144171n);
});

test('소가 대상 표시를 바꿔도 입력한 양측 보수 기초와 안분 비율은 바뀌지 않음', () => {
  const s = fixture(); const before = reviewCosts([s], parties);
  assert.equal(stageEffectiveValue(s, parties), 105355798n);
  s.mainValueTarget = '피신청인측';
  assert.equal(stageEffectiveValue(s, parties), 162505969n);
  assert.equal(resolveFeeBasisValue(s.costs[0], s, parties), 105355798n);
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), 162505969n);
  assert.deepEqual(reviewCosts([s], parties).lines.map(l => l.amount), before.lines.map(l => l.amount));
});

test('피신청인측 다액흡수는 해당 측 한도만 바꾸고 원래 개별 안분가액은 보존', () => {
  const s = fixture(); s.opponentValueMode = '흡수';
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), 105361798n);
  assert.equal(resolveFeeBasisValue(s.costs[0], s, parties), 105355798n);
  const r = reviewCosts([s], parties); assert.deepEqual(r.errors, []);
  const step = r.lines.find(l => l.owner === 'b1').steps[0];
  assert.equal(step.factor.n * 162505969n, step.factor.d * 105361798n);
});

test('각자 대리한 비용은 해당 당사자 소가를 사용하고 공동보수의 일부 누락을 합계로 대체하지 않음', () => {
  const s = fixture(); const solo = fee('b2', ['b2'], '');
  assert.equal(resolveFeeBasisValue(solo, s, parties), 57144171n);
  s.members.b2.value = '';
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), null);
  assert(reviewCosts([s], parties).errors.length);
  s.members.b1.value = '';
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), null);
});

test('개별소가 해제는 기존 사건 가액을 사용하며 상대방 공통소가 묶음도 보수와 안분에 연결', () => {
  const s = fixture(); s.useIndividualValues = false;
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), 105355798n);
  assert.equal(allocationMemberValue(s, parties[2]), null);
  s.mainValues = [{ id: 'bundle', side: '피신청인측', ids: ['b1', 'b2'], amount: '162505969' }];
  assert.equal(resolveFeeBasisValue(s.costs[1], s, parties), 162505969n);
  assert.equal(allocationMemberValue(s, parties[2]), 162505969n);
});
