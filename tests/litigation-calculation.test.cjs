const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./load-ts.cjs')();
const { calculateLitigationCosts, describeOrder } = load('src/app/litigation-costs/litigationCalculation.ts');
const { money } = load('src/app/litigation-costs/costReview.ts');

function component(file) {
  const source = ts.transpileModule(fs.readFileSync(`src/app/litigation-costs/${file}.tsx`, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => {
    if (name === './CostStatementModal') return { CostStatementModal: () => null };
    if (name.startsWith('./')) return load('src/app/litigation-costs/' + name.slice(2) + '.ts');
    return require(name);
  }, mod, mod.exports);
  return mod.exports[file];
}
const Statement = component('CostStatementModal');
const View = component('CostReview');
const html = (type, f, extra = {}) => renderToStaticMarkup(React.createElement(type, { ...f, label: p => p.name, onClose() {}, ...extra }));
const text = markup => markup.replace(/<[^>]*>/g, '');
const tableRows = markup => [...markup.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map(match => text(match[1]));
const expense = (id, payer, kind, paid, extra = {}) => ({ id, payer, kind, paid, refund: '0', ids: [payer], shared: false, method: '', ...extra });
const people = () => ['a', 'a2', 'b', 'c'].map((id, index) => ({ id, name: ['박경임', '박경순', '박관수', '이보순'][index], group: index < 2 ? '신청인' : '피신청인' }));
const rule = (extra = {}) => ({ id: 'r', left: ['a', 'a2'], right: ['b', 'c'], mode: '비율로 분담', n: '1', d: '3',
  scope: '1심 비용', claim: '', leftMethod: '균분', rightMethod: '균분', ...extra });
function sample35081() {
  const shared = { shared: true, ids: ['a', 'a2'], method: '균분' };
  return {
    applicationCaseNumber: '2026카확35081', parties: people(),
    stages: [{ id: 'first', level: '1심', number: '2024가단5215484', value: '', useIndividualValues: true, mainValueTarget: '신청인측',
      members: { a: { value: '52680899' }, a2: { value: '52680899' }, b: { value: '105361798' }, c: { value: '57144171' } },
      rules: [rule()], costs: [
        expense('fee-a', 'a', '변호사보수', '6600000', shared),
        expense('fee-b', 'b', '변호사보수', '7600000', { shared: true, ids: ['b', 'c'], method: '안분' }),
        expense('stamp', 'a', '인지대', '259000', shared),
        expense('delivery', 'a', '송달료', '156000', { ...shared, refund: '140867' }),
        expense('expert', 'a', '기타 비용', '2343000', { ...shared, title: '감정료', refund: '64900' }),
      ] }],
    applicationCosts: [expense('app-stamp', 'a', '인지대', '900'), expense('app-delivery', 'a', '송달료', '12327'), expense('clerk', 'a', '서기료', '220000')],
  };
}
const calculate = f => calculateLitigationCosts(f.parties, f.stages, f.applicationCosts);

test('35081: 인정액 합계와 관계별 상계액을 구분하고 독립 검산값을 화면·인쇄에 동일 반영', () => {
  const f = sample35081(), r = calculate(f);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.mainTotals, { applicant: 9152233n, respondent: 7600000n });
  assert.equal(r.applicationTotal, 233227n);
  assert.deepEqual(r.totals, { applicant: 9385460n, respondent: 7600000n });
  assert.equal(r.stageResults[0].value, 105361798n);
  assert.deepEqual(r.main.expenses.filter(e => e.feeBasis !== null).map(e => [e.feeBasis, e.feeLimit, e.recognized]), [
    [105361798n, 7614471n, 6600000n], [162505969n, 9650119n, 7600000n],
  ]);
  // Independently checked in audit: each applicant recovers 1,525,360;
  // reverse recoveries are 821,250 / 445,410; application recovery is 38,850.
  assert.deepEqual(r.settlements.map(row => [row.a.id, row.b.id, money(row.forward), money(row.reverse), money(row.applicationAmount), money(row.payable)]), [
    ['a', 'b', '1,525,360원', '821,250원', '38,850원', '742,960원'],
    ['a', 'c', '1,525,360원', '445,410원', '38,850원', '1,118,800원'],
    ['a2', 'b', '1,525,360원', '821,250원', '38,850원', '742,960원'],
    ['a2', 'c', '1,525,360원', '445,410원', '38,850원', '1,118,800원'],
  ]);
  for (const type of [View, Statement]) {
    const content = text(html(type, f, { calculation: r }));
    for (const amount of ['9,152,233', '233,227', '9,385,460', '742,960원', '1,118,800원']) assert(content.includes(amount));
  }
  const markup = html(Statement, f, { calculation: r });
  const rows = tableRows(markup);
  assert(rows.includes('본안비용소계9,152,2337,600,000'));
  assert(rows.includes('신청비용소계233,2270'));
  assert(rows.includes('합계9,385,4607,600,000본안비용 ＋ 신청비용'));
  assert.match(text(markup), /신청인 : 박경임, 박경순/);
  assert.match(text(markup), /피신청인 : 박관수, 이보순/);
  assert.match(text(markup), /박경임, 박경순 1\/3 부담 · 박관수, 이보순 2\/3 부담/);
  assert.match(text(markup), /한도 7,400,000＋\(105,361,798－100,000,000\)×0.04 = 7,614,471원/);
  assert.match(text(markup), /절사액/);
  // Original PDF is not an oracle: its 9,165,460 total omits the 220,000
  // clerk fee, and its Park repayment does not equal its printed formula.
  assert.notEqual(r.totals.applicant, 9165460n);
  assert.notEqual(r.settlements[0].payable.n, 1527576n);
});

test('공통 결과를 전달받은 인쇄는 입력 비용을 별도로 재계산하지 않음', () => {
  const f = sample35081(), result = calculate(f);
  f.stages[0].costs[0].paid = '1';
  f.applicationCosts[2].paid = '0';
  const rows = tableRows(html(Statement, f, { calculation: result }));
  assert(rows.includes('본안비용소계9,152,2337,600,000'));
  assert(rows.includes('합계9,385,4607,600,000본안비용 ＋ 신청비용'));
});

test('환급·검토 인정액과 첫 번째가 아닌 신청인 비용도 정확한 측의 총액에 산입', () => {
  const f = sample35081();
  f.stages[0].costs = [expense('second-fee', 'a2', '변호사보수', '9000000')];
  f.applicationCosts = [expense('app', 'a', '인지대', '1000', { refund: '100', recognized: '800' })];
  const r = calculate(f);
  // Second applicant's individual claim value gives the fee cap, not the stage total.
  assert.equal(r.main.expenses[0].feeBasis, 52680899n);
  assert.equal(r.mainTotals.applicant, 4560853n);
  assert.equal(r.mainTotals.respondent, 0n);
  assert.equal(r.applicationTotal, 800n);
  const rows = tableRows(html(Statement, f, { calculation: r }));
  assert(rows.some(row => row.startsWith('1심변호사보수') && row.includes('4,560,853')));
  assert(rows.includes('신청비용소계8000'));
});

test('일부 당사자 항소: 소송총비용 주문은 해당 관계만 변경하며 원래 분모 보존', () => {
  const f = sample35081();
  f.parties = [f.parties[0], f.parties[2], f.parties[3], { id: 'd', group: '피신청인', name: '제3피고' }];
  const members = { a: {}, b: {}, c: {}, d: {} };
  const first = { id: 'first', level: '1심', number: '1심사건', members, costs: [expense('a', 'a', '송달료', '10500'), ...['b', 'c', 'd'].map(id => expense(id, id, '송달료', '0'))],
    rules: [rule({ left: ['a'], right: ['b', 'c', 'd'], mode: '2측 전부 부담' })] };
  const appeal = { id: 'appeal', level: '항소심', number: '항소사건', members: { a: {}, b: {}, c: {} }, costs: [],
    rules: [rule({ id: 'r2', left: ['a'], scope: '소송총비용', n: '1', d: '2' })] };
  f.stages = [first, appeal]; f.applicationCosts = [expense('app', 'a', '인지대', '3000')];
  const r = calculate(f);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.settlements.map(row => [row.b.id, money(row.payable)]), [['b', '2,250원'], ['c', '2,250원'], ['d', '4,500원']]);
  assert.match(r.main.lines.find(line => line.owner === 'a' && line.debtor === 'b').order, /항소심/);
  assert.match(r.main.lines.find(line => line.owner === 'a' && line.debtor === 'd').order, /1심/);
  for (const type of [View, Statement]) for (const expected of ['2,250원', '4,500원']) assert(text(html(type, f)).includes(expected));
});

test('관계별 소가는 각 귀속자의 방향에 적용하고 공동비용 원액은 한 번만 합산', () => {
  const f = sample35081(), s = f.stages[0];
  s.rules = [rule({ mode: '2측 전부 부담' })];
  s.members = { a: { value: '4000', relationValues: { b: '3000', c: '1000' } }, a2: { value: '2000', relationValues: { b: '500', c: '1500' } }, b: { value: '3500' }, c: { value: '2500' } };
  s.costs = [expense('shared', 'a', '송달료', '200000', { shared: true, ids: ['a', 'a2'], method: '균분', opponentMethod: '안분' })];
  f.applicationCosts = [];
  const r = calculate(f);
  assert.deepEqual(r.errors, []);
  assert.equal(r.mainTotals.applicant, 200000n);
  assert.deepEqual(r.settlements.map(row => money(row.payable)), ['75,000원', '25,000원', '25,000원', '75,000원']);
  assert(r.main.lines.every(line => line.costId === 'shared' && line.stageId === 'first'));
});

test('일부 귀속자의 주문 오류 발생 시 그 비용의 중간 결과·인정액은 합계로 유출하지 않음', () => {
  const f = sample35081(), s = f.stages[0];
  s.rules = [rule({ left: ['a'], mode: '2측 전부 부담' })];
  s.costs = [s.costs[0]]; f.applicationCosts = [];
  const r = calculate(f);
  assert(r.errors.length);
  assert.deepEqual(r.main.lines, []);
  assert.deepEqual(r.main.expenses, []);
  assert.equal(r.main.ownerTotals.size, 0);
  const markup = html(Statement, f, { calculation: r });
  assert.match(markup, /disabled=""/);
  assert.match(text(markup), /입력 확인 필요/);
  assert.doesNotMatch(text(markup), /에게 지급할 금액/);
});

test('역방향으로 주문 대상을 지정해도 실제 양측 이름에 맞는 부담률을 설명', () => {
  const desc = describeOrder(rule({ left: ['b'], right: ['a'], n: '1', d: '4' }), people(), p => p.name);
  assert.match(desc, /박관수 1\/4 부담 · 박경임 3\/4 부담/);
});
