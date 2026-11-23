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

test('양측 공동·개별 보수 모두 입력한 1심 소가로 같은 한도 산정', () => {
  const s = fixture();
  for (const c of [...s.costs, fee('b2', ['b2'], '')]) assert.equal(resolveFeeBasisValue(c, s), 105355798n);
  const r = reviewCosts([s], parties);
  assert.deepEqual(r.errors, []);
  assert(r.expenses.every(e => e.feeBasis === 105355798n && e.feeLimit === 7614231n));
  assert.equal(money(r.ownerTotals.get('a1')), '7,614,231/2원');
  assert.equal(allocationMemberValue(s, parties[2]), 105361798n);
  assert.equal(allocationMemberValue(s, parties[3]), 57144171n);
});

test('관계 표시와 소가 대상을 변경해도 전체 소가·보수 한도·안분 결과 유지', () => {
  const s = fixture(), before = reviewCosts([s], parties);
  for (const relation of ['합산', '흡수', '기타']) {
    Object.assign(s, { applicantValueRelation: relation, opponentValueRelation: relation, mainValueTarget: '피신청인측' });
    assert.equal(stageEffectiveValue(s), 105355798n);
    assert.deepEqual(reviewCosts([s], parties).lines, before.lines);
    const restored = JSON.parse(JSON.stringify(s));
    assert.equal(restored.applicantValueRelation, relation);
    assert.equal(restored.opponentValueRelation, relation);
    assert.deepEqual(reviewCosts([restored], parties).lines, before.lines);
  }
  // Older saved aggregation settings also cannot alter the entered stage value.
  s.opponentValueMode = '흡수';
  assert.equal(resolveFeeBasisValue(s.costs[1], s), 105355798n);
});

test('개별소가는 비용 안분만 바꾸고 양측 보수의 기초 소가·한도는 유지', () => {
  const s = fixture();
  const before = reviewCosts([s], parties);
  s.members.b1.value = '10000000'; s.members.b2.value = '10000000';
  const after = reviewCosts([s], parties);
  assert.deepEqual(after.errors, []);
  assert.deepEqual(after.expenses.map(e => [e.feeBasis, e.feeLimit]), before.expenses.map(e => [e.feeBasis, e.feeLimit]));
  assert.notDeepEqual(after.lines.filter(l => l.owner.startsWith('b')).map(l => l.amount), before.lines.filter(l => l.owner.startsWith('b')).map(l => l.amount));
  assert.equal(money(after.ownerTotals.get('b1')), '7,614,231/2원');
});

test('심급 소가 변경은 양측 한도에 반영되고 미입력 시 개별소가로 추정하지 않음', () => {
  const s = fixture();
  s.value = '50000000';
  assert(reviewCosts([s], parties).expenses.every(e => e.feeLimit === 4400000n));
  s.value = '';
  assert.equal(resolveFeeBasisValue(s.costs[0], s), null);
  assert(reviewCosts([s], parties).errors.length);
  s.value = '105355798'; s.members.b2.value = '';
  assert.equal(resolveFeeBasisValue(s.costs[1], s), 105355798n);
  assert(reviewCosts([s], parties).errors.length, '안분에는 개별소가가 필요하지만 보수 기초 소가는 유지된다');
  s.costs[1].method = '균분';
  assert.deepEqual(reviewCosts([s], parties).errors, []);
});
