const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, money, resolveFeeBasisValue } = load('src/app/litigation-costs/costReview.ts');
const { relationAmounts, relationValueIssue, relationOpponents } = load('src/app/litigation-costs/relationValues.ts');
const { reviewAutomaticApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const parties = ['a', 'a2', 'b', 'c'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
const expense = (payer, paid) => ({ id: payer, payer, ids: [payer], kind: '송달료', paid: String(paid), refund: '0', shared: false, opponentMethod: '안분' });
function fixture() {
  return { id: 'first', level: '1심', value: '', mainValueTarget: '신청인측', useIndividualValues: true,
    members: {
      a: { value: '4000', relationValues: { b: '3000', c: '1000' } },
      a2: { value: '2000', relationValues: { b: '500', c: '1500' } },
      b: { value: '3500', relationValues: { a: '3000', a2: '500' } },
      c: { value: '2500', relationValues: { a: '1000', a2: '1500' } },
    }, costs: [], rules: [{ id: 'r', left: ['a', 'a2'], right: ['b', 'c'], mode: '2측 전부 부담', n: '1', d: '2', scope: '1심 비용', claim: '', leftMethod: '균분', rightMethod: '균분' }],
  };
}
const amounts = r => r.lines.map(l => [l.owner, l.debtor, money(l.amount)]);

test('신청인별로 다른 관계별 소가를 사용하며 판결 부담비율은 배분 후 적용', () => {
  const s = fixture(); s.costs = [expense('a', 100000), expense('a2', 100000)];
  assert.deepEqual(reviewCosts([s], parties).errors, []);
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '75,000원'], ['a', 'c', '25,000원'], ['a2', 'b', '25,000원'], ['a2', 'c', '75,000원']]);
  s.rules[0].mode = '비율로 분담';
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '37,500원'], ['a', 'c', '12,500원'], ['a2', 'b', '12,500원'], ['a2', 'c', '37,500원']]);
});

test('피신청인에서 다수 신청인 방향으로도 해당 비용 귀속자의 관계별 금액을 사용', () => {
  const s = fixture(); s.rules[0].mode = '1측 전부 부담';
  s.costs = [expense('b', 70000), expense('c', 50000)];
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['b', 'a', '60,000원'], ['b', 'a2', '10,000원'], ['c', 'a', '20,000원'], ['c', 'a2', '30,000원']]);
});

test('공동 지출을 귀속자에게 나눈 뒤 각 귀속자의 서로 다른 관계별 비율 적용', () => {
  const s = fixture();
  s.costs = [{ ...expense('a', 200000), shared: true, ids: ['a', 'a2'], method: '균분' }];
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '75,000원'], ['a', 'c', '25,000원'], ['a2', 'b', '25,000원'], ['a2', 'c', '75,000원']]);
});

test('일부 상소에서도 1심 관계별 소가의 분모를 유지하고 해당 상대방의 주문만 교체', () => {
  const first = fixture(); first.costs = [expense('a', 100000)];
  const appeal = { ...fixture(), id: 'appeal', level: '항소심', members: { a: {}, c: {} }, rules: [{ ...first.rules[0], id: 'r2', left: ['a'], right: ['c'], mode: '비율로 분담', scope: '소송총비용' }] };
  const r = reviewCosts([first, appeal], parties);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(amounts(r), [['a', 'b', '75,000원'], ['a', 'c', '12,500원']]);
});

test('본소·반소 관계별 금액을 별도로 사용하고 개별소가 한도와 신청비용 균분은 유지', () => {
  const s = fixture(); s.counter = '1'; s.useCounterIndividualValues = true;
  s.members.a.counterValue = '4000'; s.members.a.counterRelationValues = { b: '1000', c: '3000' };
  s.rules[0].claim = '본소와 반소';
  s.costs = [{ ...expense('a', 100000), claim: '반소' }];
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '25,000원'], ['a', 'c', '75,000원']]);
  s.counter = '';
  assert.equal(resolveFeeBasisValue({ ...expense('a', 0), kind: '변호사보수' }, s, parties), 4000n);
  const app = reviewAutomaticApplicationCosts([{ ...expense('a', 1200), kind: '인지대' }], parties, [s]);
  assert.deepEqual(app.errors, []);
  assert(app.lines.every(l => money(l.amount) === '300원'));
});

test('미입력·합계 불일치·새 상대방 누락은 차단하고 명시적 0원은 구분', () => {
  const s = fixture(); s.costs = [expense('a', 100000)];
  assert.match(relationValueIssue({ b: '4000' }, ['b', 'c'], '4000'), /모두 입력/);
  assert.match(relationValueIssue({ b: '3000', c: '2000' }, ['b', 'c'], '4000'), /합계/);
  s.members.a.relationValues = { b: '4000', c: '' };
  assert.match(reviewCosts([s], parties).errors[0], /모두 입력/);
  s.members.a.relationValues.c = '0';
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '100,000원'], ['a', 'c', '0원']]);
  const extra = { id: 'd', group: '피신청인', name: 'd' }; s.members.d = { value: '0' }; s.rules[0].right.push('d');
  assert.match(reviewCosts([s], [...parties, extra]).errors[0], /모두 입력/);
});

test('관계별 입력 해제·개별소가 해제·균분 선택 시 기존 계산 유지하고 저장 형식 보존', () => {
  const s = fixture();
  s.useIndividualValues = false;
  assert.equal(relationAmounts(s, parties, 'a', ['b', 'c'], false), null);
  s.useIndividualValues = true;
  s.costs = [{ ...expense('a', 100000), opponentMethod: '균분' }];
  assert.deepEqual(amounts(reviewCosts([s], parties)), [['a', 'b', '50,000원'], ['a', 'c', '50,000원']]);
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(amounts(reviewCosts([restored], parties)), amounts(reviewCosts([s], parties)));
  delete s.members.a.relationValues;
  assert.equal(relationAmounts(s, parties, 'a', ['b', 'c'], false), null);
  assert.deepEqual(relationOpponents(s, parties[2], parties).map(p => p.id), ['a', 'a2']);
});
