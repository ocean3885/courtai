const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewCosts, money, subtract, resolveFeeBasisValue, sideEffectiveValue, stageEffectiveValue, counterEffectiveValue } =
  load('src/app/litigation-costs/costReview.ts');
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
test('개별 소가를 끄면 사건 소가를 사용하고 다시 켜면 개별 값을 반영', () => {
  const fee = { ...cost('a', '10000000'), kind: '변호사보수' };
  const first = { ...stage(parties, [fee], [rule(['b'], '2측 전부 부담')]), useIndividualValues: false };
  first.members.a.value = '20000000';

  assert.equal(sideEffectiveValue(first, parties, true), null);
  assert.equal(resolveFeeBasisValue(fee, first, parties), 50000000n);
  assert.equal(money(reviewCosts([first], parties).ownerTotals.get('a')), '4,400,000원');

  first.useIndividualValues = true;
  assert.equal(resolveFeeBasisValue(fee, first, parties), 20000000n);
  assert.equal(first.members.a.value, '20000000');
});

test('개별 소가 사용 시 사건 소가는 지정된 측의 합산·다액흡수 결과를 사용', () => {
  const people = [...parties, party('c', '신청인')];
  const first = { ...stage(people, [], []), useIndividualValues: true, mainValueTarget: '신청인측' };
  first.members.a.value = '20000000';
  first.members.b.value = '80000000';
  first.members.c.value = '10000000';
  assert.equal(stageEffectiveValue(first, people), 30000000n);

  first.applicantValueMode = '흡수';
  assert.equal(stageEffectiveValue(first, people), 20000000n);

  first.mainValueTarget = '피신청인측';
  assert.equal(stageEffectiveValue(first, people), 80000000n);

  const fee = { ...cost('b', '10000000'), kind: '변호사보수' };
  first.members.b.value = '';
  assert.equal(stageEffectiveValue(first, people), null);
  assert.equal(resolveFeeBasisValue(fee, first, people), null);
  first.useIndividualValues = false;
  assert.equal(resolveFeeBasisValue(fee, first, people), 50000000n);
});

test('개별 소가가 꺼져 있어도 공통소가는 안분에 사용하고 비어 있는 대상은 안내', () => {
  const people = [...parties, party('c', '피신청인')];
  const shared = { ...cost('b', '600'), shared: true, ids: ['b', 'c'], method: '안분' };
  const burden = { ...rule(['b', 'c'], '2측 전부 부담'), rightMethod: '안분' };
  const first = { ...stage(people, [shared], [burden]), useIndividualValues: false };
  first.members.b.value = '1000';
  first.members.c.value = '2000';
  first.mainValues = [{ id: 'bc', ids: ['b', 'c'], amount: '3000' }];

  assert.equal(sideEffectiveValue(first, people, false), 3000n);
  const sharedResult = reviewCosts([first], people);
  assert.deepEqual(sharedResult.errors, []);
  assert.equal(money(sharedResult.ownerTotals.get('b')), '300원');

  first.costs = [cost('a', '600')];
  assert.deepEqual(reviewCosts([first], people).lines.map((line) => money(line.amount)), ['300원', '300원']);

  first.mainValues[0].ids = ['b'];
  assert.match(reviewCosts([first], people).errors[0], /개별소가 항목/);

  first.useIndividualValues = true;
  assert.deepEqual(reviewCosts([first], people).lines.map((line) => money(line.amount)), ['360원', '240원']);

  first.mainValues = [];
  assert.deepEqual(reviewCosts([first], people).lines.map((line) => money(line.amount)), ['200원', '400원']);
});

test('지정한 측의 본소와 상대 측의 반소 소가를 각각 집계하고 안분에 사용', () => {
  const people = [...parties, party('a2', '신청인'), party('a3', '신청인')];
  const first = {
    ...stage(people, [cost('b', '800')], [{
      ...rule(['a', 'a2', 'a3'], '2측 전부 부담'),
      left: ['b'], rightMethod: '안분', claim: '본소와 반소',
    }]),
    mainValueTarget: '피신청인측',
    useIndividualValues: true,
    counter: '반소', counterValue: '9000', useCounterIndividualValues: true,
    counterValues: [{ id: 'group', ids: ['a', 'a2'], amount: '3000' }],
  };
  first.members.a = { value: '9999', counterValue: '500' };
  first.members.a3 = { value: '9999', counterValue: '2000' };
  first.members.b = { value: '1000', counterValue: '8888' };

  assert.equal(stageEffectiveValue(first, people), 1000n);
  assert.equal(counterEffectiveValue(first, people), 5000n);
  const result = reviewCosts([first], people);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.lines.map((line) => money(line.amount)), ['300원', '300원', '200원']);

  first.counterValueMode = '흡수';
  assert.equal(counterEffectiveValue(first, people), 3000n);
  first.mainValueTarget = '신청인측';
  assert.equal(counterEffectiveValue(first, people), 8888n);
  first.useCounterIndividualValues = false;
  assert.equal(counterEffectiveValue(first, people), 9000n);
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
  appeal.rules[0].mode = '비율로 분담';
  appeal.rules[0].n = '2'; appeal.rules[0].d = '5';
  const partialTotal = reviewCosts([first, appeal], people);
  assert.deepEqual(partialTotal.errors, []);
  assert.deepEqual(partialTotal.lines.map(l => [l.debtor, l.amount.n]), [
    ['b', 30000n], ['c', 18000n], ['d', 30000n], ['e', 30000n], ['c', 12000n],
  ]);
});
test('동일 당사자 소송총비용 주문은 종전 주문을 대체하고 단계별 절사', () => {
  const r = reviewCosts(
    [
      stage(parties, [cost('a', '110000')], [rule(['b'], '2측 전부 부담')]),
      stage(parties, [cost('a', '20000')], [rule(['b'], '비율로 분담', '소송총비용')]),
    ],
    parties
  );
  assert.deepEqual(
    r.lines.map((l) => money(l.amount)),
    ['73,330원', '13,330원']
  );
  assert.deepEqual(r.lines.map(l => money(l.exactAmount)), ['220,000/3원', '40,000/3원']);
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
test('겹치지 않는 상대방별 관계를 함께 적용하고 한 관계만 지정할 수도 있음', () => {
  const people = [...parties, party('c', '피신청인')];
  const s = stage(
    people,
    [cost('a', '120')],
    [
      { ...rule(['b'], '2측 전부 부담'), id: 'one' },
      { ...rule(['c'], '각자 부담'), id: 'two' },
    ]
  );
  const automatic = reviewCosts([s], people);
  assert.deepEqual(automatic.errors, []);
  assert.deepEqual(automatic.lines.map(l => [l.debtor, l.amount.n]), [['b', 60n], ['c', 0n]]);
  s.costs[0].ruleId = 'one';
  assert.deepEqual(
    reviewCosts([s], people).lines.map((l) => [l.debtor, l.amount.n]),
    [['b', 120n]]
  );
});

test('1심 없이 항소심만 입력한 경우에도 심급·주문 표시와 배분이 동작', () => {
  const appealOnly = {
    ...stage(parties, [cost('a', '150000')], [rule(['b'], '2측 전부 부담', '항소심 비용')]),
    level: '항소심',
  };
  const r = reviewCosts([appealOnly], parties);
  assert.deepEqual(r.errors, []);
  assert.equal(r.lines.length, 1);
  assert.equal(r.lines[0].stage, '항소심');
  assert.equal(r.lines[0].order, '항소심 · 항소심 비용');
  assert.equal(money(r.lines[0].amount), '150,000원');
});

test('당사자별 소가 합산 및 큰 소가에 작은 소가 흡수(다액 기준) 보수 한도 산정', () => {
  const coParties = [party('a1', '신청인'), party('a2', '신청인'), party('b', '피신청인')];
  const sharedFee = {
    payer: 'a1',
    kind: '변호사보수',
    paid: '10000000',
    refund: '0',
    shared: true,
    ids: ['a1', 'a2'],
    method: '소가 비율',
  };
  const fullBurdenRule = { left: ['a1', 'a2'], right: ['b'], mode: '2측 전부 부담', scope: '1심 비용' };

  // 1) 합산: 30,000,000 + 20,000,000 = 50,000,000원 -> 한도 4,400,000원 -> 3:2 안분 (2,640,000원 / 1,760,000원)
  const sumStage = {
    value: '',
    valueMode: '합산',
    members: { a1: { value: '30000000' }, a2: { value: '20000000' }, b: { value: '50000000' } },
    costs: [sharedFee],
    rules: [fullBurdenRule],
  };
  const sumResult = reviewCosts([sumStage], coParties);
  assert.deepEqual(sumResult.errors, []);
  assert.deepEqual(
    sumResult.lines.map((l) => [l.owner, money(l.amount)]),
    [
      ['a1', '2,640,000원'],
      ['a2', '1,760,000원'],
    ]
  );

  // 2) 흡수: 50,000,000원에 30,000,000원 흡수 -> 기준 소가 50,000,000원(한도 4,400,000원) -> 5:3 안분 (2,750,000원 / 1,650,000원)
  const absorbStage = {
    value: '',
    valueMode: '흡수',
    members: { a1: { value: '50000000' }, a2: { value: '30000000' }, b: { value: '50000000' } },
    costs: [sharedFee],
    rules: [fullBurdenRule],
  };
  const absorbResult = reviewCosts([absorbStage], coParties);
  assert.deepEqual(absorbResult.errors, []);
  assert.deepEqual(
    absorbResult.lines.map((l) => [l.owner, money(l.amount)]),
    [
      ['a1', '2,750,000원'],
      ['a2', '1,650,000원'],
    ]
  );

  // 3) 같은 심급에서 신청인 측은 합산(3천만+2천만=5천만), 피신청인 측은 흡수(5천만에 3천만 흡수=5천만)로 서로 다른 결합 방식 적용
  const mixedParties = [
    party('a1', '신청인'),
    party('a2', '신청인'),
    party('b1', '피신청인'),
    party('b2', '피신청인'),
  ];
  const mixedStage = {
    value: '',
    applicantValueMode: '합산',
    opponentValueMode: '흡수',
    members: {
      a1: { value: '30000000' },
      a2: { value: '20000000' },
      b1: { value: '50000000' },
      b2: { value: '30000000' },
    },
    costs: [
      { ...sharedFee, id: 'fee-a', payer: 'a1', ids: ['a1', 'a2'], method: '안분' },
      { ...sharedFee, id: 'fee-b', payer: 'b1', ids: ['b1', 'b2'], method: '균분' },
    ],
    rules: [
      {
        left: ['a1', 'a2'],
        right: ['b1', 'b2'],
        mode: '비율로 분담',
        n: '1',
        d: '2',
        scope: '1심 비용',
        leftMethod: '균분',
        rightMethod: '균분',
      },
    ],
  };
  const mixedResult = reviewCosts([mixedStage], mixedParties);
  assert.deepEqual(mixedResult.errors, []);
  // 양측 모두 기준 소가 5,000만원(보수 한도 4,400,000원)이 각각 적용됨
  assert.equal(money(mixedResult.ownerTotals.get('a1')), '2,640,000원');
  assert.equal(money(mixedResult.ownerTotals.get('a2')), '1,760,000원');
  assert.equal(money(mixedResult.ownerTotals.get('b1')), '2,200,000원');
  assert.equal(money(mixedResult.ownerTotals.get('b2')), '2,200,000원');

  // 4) 일부 당사자(a1, a2)는 공통소가 3,000만원 공유 + 나머지 당사자(a3)는 개별소가 2,000만원 -> 기준 소가 5,000만원(한도 440만원)
  const hybridParties = [
    party('a1', '신청인'),
    party('a2', '신청인'),
    party('a3', '신청인'),
    party('b', '피신청인'),
  ];
  const hybridStage = {
    value: '',
    members: {
      a1: { value: '30000000', valueType: '공통' },
      a2: { value: '30000000', valueType: '공통' },
      a3: { value: '20000000', valueType: '개별' },
      b: { value: '50000000' },
    },
    costs: [
      {
        payer: 'a1',
        kind: '변호사보수',
        paid: '10000000',
        refund: '0',
        shared: true,
        ids: ['a1', 'a2', 'a3'],
        method: '안분',
      },
    ],
    rules: [{ left: ['a1', 'a2', 'a3'], right: ['b'], mode: '2측 전부 부담', scope: '1심 비용' }],
  };
  const hybridResult = reviewCosts([hybridStage], hybridParties);
  assert.deepEqual(hybridResult.errors, []);
  // 기준 소가 = 공통(3,000만 1회) + 개별(2,000만) = 5,000만원 -> 보수 한도 4,400,000원
  // 당사자별 안분 비율 = 3000만 : 3000만 : 2000만 (3 : 3 : 2) -> 1,650,000원 / 1,650,000원 / 1,100,000원
  assert.deepEqual(
    hybridResult.lines.map((l) => [l.owner, money(l.amount)]),
    [
      ['a1', '1,650,000원'],
      ['a2', '1,650,000원'],
      ['a3', '1,100,000원'],
    ]
  );

  // 5) 신청인측 신청외(공동원고)와 피신청인측 신청외(공동피고)가 각각 해당 측 소가 합산·공통 보수 안분에 참여
  const bothSidesWithNonApplicants = [
    { id: 'a1', name: 'a1', group: '신청인', side: '신청인측' },
    { id: 'ax', name: 'ax', group: '신청외', side: '신청인측' },
    { id: 'b1', name: 'b1', group: '피신청인', side: '피신청인측' },
    { id: 'bx', name: 'bx', group: '신청외', side: '피신청인측' },
  ];
  const nonAppStage = {
    value: '',
    members: {
      a1: { value: '30000000', valueType: '개별' },
      ax: { value: '20000000', valueType: '개별' },
      b1: { value: '25000000', valueType: '개별' },
      bx: { value: '25000000', valueType: '개별' },
    },
    costs: [
      {
        payer: 'a1',
        kind: '변호사보수',
        paid: '10000000',
        refund: '0',
        shared: true,
        ids: ['a1', 'ax'],
        method: '안분',
      },
    ],
    rules: [
      {
        left: ['a1', 'ax'],
        right: ['b1', 'bx'],
        mode: '2측 전부 부담',
        scope: '1심 비용',
        rightMethod: '균분',
      },
    ],
  };
  const nonAppResult = reviewCosts([nonAppStage], bothSidesWithNonApplicants);
  assert.deepEqual(nonAppResult.errors, []);
  // a1과 신청인측 신청외 ax의 합산 소가 5,000만원 -> 한도 440만원 -> a1 몫 264만원, ax 몫 176만원
  // 피신청인 b1과 피신청인측 신청외 bx가 균분 부담하므로, 신청인 a1이 피신청인 b1에게 청구할 금액은 264만원 × 1/2 = 132만원
  assert.equal(money(nonAppResult.ownerTotals.get('a1')), '2,640,000원');
  assert.equal(money(nonAppResult.ownerTotals.get('ax')), '1,760,000원');
  assert.equal(
    money(nonAppResult.lines.find((l) => l.owner === 'a1' && l.debtor === 'b1').amount),
    '1,320,000원'
  );

  // 6) 공통소가 묶음이 3개 이상(mainValues)이고 나머지 당사자는 개별소가인 경우에도 묶음별 1회씩만 합산
  const multiBundleParties = [
    party('a1', '신청인'),
    party('a2', '신청인'),
    party('a3', '신청인'),
    party('a4', '신청인'),
    party('a5', '신청인'),
    party('a6', '신청인'),
    party('a7', '신청인'),
    party('b', '피신청인'),
  ];
  const multiBundleStage = {
    value: '',
    mainValues: [
      { id: 'g1', side: '신청인측', ids: ['a1', 'a2'], amount: '10000000' },
      { id: 'g2', side: '신청인측', ids: ['a3', 'a4'], amount: '15000000' },
      { id: 'g3', side: '신청인측', ids: ['a5', 'a6'], amount: '20000000' },
    ],
    members: {
      a1: { value: '10000000' },
      a2: { value: '10000000' },
      a3: { value: '15000000' },
      a4: { value: '15000000' },
      a5: { value: '20000000' },
      a6: { value: '20000000' },
      a7: { value: '5000000' },
      b: { value: '50000000' },
    },
    costs: [
      {
        payer: 'a1',
        kind: '변호사보수',
        paid: '10000000',
        refund: '0',
        shared: true,
        ids: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
        method: '균분',
      },
    ],
    rules: [
      {
        left: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7'],
        right: ['b'],
        mode: '2측 전부 부담',
        scope: '1심 비용',
      },
    ],
  };
  const multiBundleResult = reviewCosts([multiBundleStage], multiBundleParties);
  assert.deepEqual(multiBundleResult.errors, []);
  // 기준 소가 = 1,000만(묶음1) + 1,500만(묶음2) + 2,000만(묶음3) + 500만(a7 개별) = 5,000만원 -> 한도 4,400,000원 -> 7명 균분
  assert.equal(money(multiBundleResult.ownerTotals.get('a1')), '4,400,000/7원');
});
