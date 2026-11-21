const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { reviewApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const { money } = load('src/app/litigation-costs/costReview.ts');
const parties = ['a', 'a2', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
const cost = (paid = '900') => ({ id: 'fee', payer: 'a', ids: ['a'], kind: '인지대', paid, refund: '0', shared: false, method: '', application: { opponentIds: ['b'], rates: { a: { b: { n: '1', d: '1' } } } } });
const run = c => reviewApplicationCosts([c], parties);

test('단독 신청비용 전액 및 환급액·인정액 반영', () => {
  const c = cost('1000'); c.refund = '100';
  assert.equal(money(run(c).lines[0].amount), '900원');
  c.recognized = '800';
  assert.equal(money(run(c).lines[0].amount), '800원');
  c.recognized = '901'; assert.match(run(c).errors[0], /초과/);
  c.recognized = ''; c.refund = '1001'; assert.match(run(c).errors[0], /환급액/);
});

test('신청인 2명의 공동비용 균분은 단계별 절사하며 정밀값 보존', () => {
  const c = cost('12129'); c.shared = true; c.ids = ['a', 'a2'];
  c.application.rates.a2 = { b: { n: '1', d: '1' } };
  const r = run(c); assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['6,060원', '6,060원']);
  assert.deepEqual(r.lines.map(l => money(l.exactAmount)), ['12,129/2원', '12,129/2원']);
  assert.equal(money(r.ownerTotals.get('a')), '12,129/2원');
});

test('상대방 전체 균분 후 B·C 60%, D 100%의 부담률 적용', () => {
  const c = cost('17642'); c.application.opponentIds = ['b', 'c', 'd'];
  c.application.rates.a = { b: { n: '3', d: '5' }, c: { n: '3', d: '5' }, d: { n: '1', d: '1' } };
  const r = run(c); assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['3,520원', '3,520원', '5,880원']);
});

test('신청인 귀속 비율과 상대방 배분 비율·부담률을 독립 적용', () => {
  const c = cost('900'); c.shared = true; c.ids = ['a', 'a2']; c.method = '직접 비율';
  c.application = { ownerWeights: { a: '2', a2: '1' }, opponentIds: ['b', 'c'], opponentMethod: '직접 비율', opponentWeights: { b: '1', c: '2' }, rates: { a: { b: { n: '1', d: '1' }, c: { n: '1', d: '2' } }, a2: { b: { n: '0', d: '1' }, c: { n: '1', d: '1' } } } };
  const r = run(c); assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['200원', '200원', '0원', '200원']);
  assert.equal(money(r.ownerTotals.get('a')), '600원');
});

test('부담률 미확인은 전액으로 추정하지 않으며 일부 오류는 합계에서 제외하지 않고 전체 확인 요구', () => {
  const c = cost(); delete c.application.rates;
  const r = reviewApplicationCosts([cost(), c], parties);
  assert.match(r.errors[0], /부담 분자/); assert.deepEqual(r.lines, []);
});

test('잘못된 비율·없는 당사자·신청외·중복 대상 검증', () => {
  for (const rate of [{ n: '1', d: '0' }, { n: '2', d: '1' }, { n: '-1', d: '2' }]) {
    const c = cost(); c.application.rates.a.b = rate; assert(run(c).errors.length);
  }
  for (const ids of [[], ['b', 'b'], ['ghost'], ['a2']]) {
    const c = cost(); c.application.opponentIds = ids; assert(run(c).errors.length);
  }
  const c = cost(); c.application.opponentIds = ['b', 'c']; c.application.opponentMethod = '직접 비율'; c.application.opponentWeights = { b: '0', c: '0' };
  assert.match(run(c).errors[0], /합계/);
  c.application.opponentWeights = { b: '1' }; assert.match(run(c).errors[0], /비율/);
  c.payer = 'a2';
  assert(reviewApplicationCosts([c], parties.map(p => p.id === 'a2' ? { ...p, group: '신청외' } : p)).errors.length);
});

test('0원 인정·부담 없음도 명시한 기준대로 계산', () => {
  const c = cost(); c.recognized = '0'; assert.equal(money(run(c).lines[0].amount), '0원');
  c.recognized = ''; c.application.rates.a.b.n = '0'; assert.equal(money(run(c).lines[0].amount), '0원');
});

const judgment = (right = ['b'], extra = {}) => ({ id: right.join('-'), left: ['a'], right, mode: '비율로 분담', n: '2', d: '5', scope: '1심 비용', ...extra });
const mainStage = (rules = [judgment()], extra = {}) => ({ id: 'first', level: '1심', members: { a: {}, b: {}, c: {}, d: {} }, rules, costs: [], ...extra });

test('판결 비율 한 번 수정으로 여러 신청비용을 실시간 재계산하며 복사값은 사용하지 않음', () => {
  const costs = [cost('900'), { ...cost('100'), id: 'delivery', kind: '송달료' }];
  const stage = mainStage();
  const policy = { mode: '판결 기준', allocation: { opponentIds: ['b'] } };
  const review = () => reviewApplicationCosts(costs, parties, [stage], policy);
  assert.deepEqual(review().errors, []);
  assert.deepEqual(review().lines.map(l => money(l.amount)), ['540원', '60원']);
  stage.rules[0].n = '1'; stage.rules[0].d = '2';
  assert.deepEqual(review().lines.map(l => money(l.amount)), ['450원', '50원']);
  assert.equal(costs[0].application.rates.a.b.n, '1');
});

test('신청비용 공통 별도 기준과 비용별 예외가 서로 독립적으로 갱신', () => {
  const common = cost('100'); const custom = { ...cost('100'), id: 'custom' }; custom.application.useCommon = false;
  const policy = { mode: '별도 기준', allocation: { opponentIds: ['b'], rates: { a: { b: { n: '1', d: '2' } } } } };
  assert.deepEqual(reviewApplicationCosts([common, custom], parties, [], policy).lines.map(l => money(l.amount)), ['50원', '100원']);
  policy.allocation.rates.a.b = { n: '1', d: '4' };
  assert.deepEqual(reviewApplicationCosts([common, custom], parties, [], policy).lines.map(l => money(l.amount)), ['20원', '100원']);
  custom.application.useCommon = true;
  assert.deepEqual(reviewApplicationCosts([common, custom], parties, [], policy).lines.map(l => money(l.amount)), ['20원', '20원']);
});

test('부분 상소의 총비용 주문은 해당 상대방만 변경하고 다른 당사자는 종전 주문 유지', () => {
  const stages = [mainStage([judgment(['b', 'c']), judgment(['d'], { mode: '2측 전부 부담' })]), mainStage([judgment(['b', 'c'], { scope: '소송총비용', n: '1', d: '2' })], { id: 'appeal', level: '항소심', members: { a: {}, b: {}, c: {} } })];
  const policy = { mode: '판결 기준', stageId: 'first' };
  const r = reviewApplicationCosts([cost('120000')], parties, stages, policy);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['20,000원', '20,000원', '40,000원']);
  assert.match(r.lines[0].basis, /항소심/); assert.match(r.lines[2].basis, /1심/);
});

test('본소·반소 주문이 다르면 청구를 한 번 선택하며 각 비용은 동일한 기준 사용', () => {
  const stages = [mainStage([judgment(['b'], { id: 'main', claim: '본소' }), judgment(['b'], { id: 'counter', claim: '반소', mode: '2측 전부 부담' })], { counter: '반소' })];
  const policy = { mode: '판결 기준', allocation: { opponentIds: ['b'] } };
  assert(reviewApplicationCosts([cost()], parties, stages, policy).errors.length);
  policy.claim = '본소'; assert.equal(money(reviewApplicationCosts([cost()], parties, stages, policy).lines[0].amount), '540원');
  policy.claim = '반소'; assert.equal(money(reviewApplicationCosts([cost()], parties, stages, policy).lines[0].amount), '900원');
});

test('연결된 심급·주문 삭제 또는 대상 누락 시 기존 복사 비율로 계산하지 않고 차단', () => {
  for (const stages of [[], [mainStage([])], [mainStage([judgment(['c'])])]]) {
    const r = reviewApplicationCosts([cost()], parties, stages, { mode: '판결 기준', stageId: 'first', allocation: { opponentIds: ['b'] } });
    assert(r.errors.length); assert.deepEqual(r.lines, []);
  }
});

test('공통 부담기준 사용 시 비용별 신청인 귀속 비율을 유지', () => {
  const c = cost('900'); c.shared = true; c.ids = ['a', 'a2']; c.method = '직접 비율';
  c.application.ownerWeights = { a: '2', a2: '1' };
  const s = mainStage([judgment(['b'], { left: ['a', 'a2'] })], { members: { a: {}, a2: {}, b: {} } });
  const r = reviewApplicationCosts([c], parties, [s], { mode: '판결 기준', allocation: { opponentIds: ['b'] } });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.lines.map(l => money(l.amount)), ['360원', '180원']);
});

function renderReview({ costs = [cost()], mainPaid = '100', respondentPaid = '0', mainRules = true, policy } = {}) {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const ts = require('typescript');
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/app/litigation-costs/CostReview.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => {
    if (name === 'react') return React;
    if (name === './CostStatementModal') return { CostStatementModal: () => null };
    if (name.startsWith('./')) return load('src/app/litigation-costs/' + name.slice(2) + '.ts');
    return require(name);
  }, mod, mod.exports);
  const stage = { id: 'first', level: '1심', members: { a: {}, b: {} }, costs: [...(mainPaid === null ? [] : [{ ...cost(mainPaid), application: undefined }]), ...(respondentPaid === null ? [] : [{ ...cost(respondentPaid), id: 'respondent-cost', payer: 'b', ids: ['b'], application: undefined }])], rules: mainRules ? [{ id: 'r', left: ['a'], right: ['b'], scope: '1심 비용', mode: '2측 전부 부담' }] : [] };
  return renderToStaticMarkup(React.createElement(mod.exports.CostReview, { parties: [parties[0], parties[2]], stages: [stage], applicationCosts: costs, applicationPolicy: policy, label: p => p.name }));
}

test('화면은 입력한 판결 주문을 자동 사용하고 주문이 사라지면 합계 표시 차단', () => {
  const c = cost('900'); delete c.application.rates;
  const policy = { mode: '판결 기준', stageId: 'first' };
  assert(renderReview({ costs: [c], policy }).includes('1,000원'));
  const html = renderReview({ costs: [c], policy, mainRules: false });
  assert(html.includes('신청비용 입력 확인'));
  assert(!html.includes('에게 지급할 최종 금액'));
});

test('화면은 단계별 절사액을 합산하고 미확인 상태에는 합계 차단', () => {
  const c = cost('1'); c.application.rates.a.b = { n: '1', d: '2' };
  const markup = renderReview({ costs: [c], mainPaid: '105' });
  assert(markup.includes('에게 지급할 최종 금액'));
  assert(markup.includes('106원')); // 본안105원 + 판결 주문상 전액 부담인 신청비용1원
  assert(markup.includes('단계별 절사 반영'));
  assert(!markup.includes('전액 산입 가정'));
  assert(renderReview({ respondentPaid: null }).includes('에게 지급할 최종 금액'));
  assert(renderReview({ respondentPaid: null }).includes('판결 주문상 상환 없음'));
  c.paid = '';
  for (const props of [{ costs: [c] }, { mainRules: false }, { mainPaid: null }]) {
    const html = renderReview(props);
    assert(!html.includes('본안 차액 + 신청비용 부담액 합계'));
    assert(!html.includes('에게 지급할 최종 금액'));
  }
});
