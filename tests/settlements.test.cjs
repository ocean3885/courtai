const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = require('./load-ts.cjs')();
const { settleCosts } = load('src/app/litigation-costs/settlements.ts');
const { reviewCosts, money } = load('src/app/litigation-costs/costReview.ts');
const { reviewAutomaticApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const parties = [{ id: 'a', name: '신청인', group: '신청인' }, { id: 'b', name: '상대방', group: '피신청인' }];
const expense = (payer, paid) => ({ id: payer, payer, ids: [payer], kind: '송달료', paid, refund: '0', shared: false });
function fixture(a = '1000', b = '200', appPaid = '0') {
  const stages = [{ id: 'first', level: '1심', value: '10000000', members: { a: {}, b: {} }, costs: [
    ...(a === null ? [] : [expense('a', a)]), ...(b === null ? [] : [expense('b', b)]),
  ], rules: [{ id: 'r', left: ['a'], right: ['b'], scope: '1심 비용', mode: '비율로 분담', n: '1', d: '2', leftMethod: '균분', rightMethod: '균분' }] }];
  const applicationCosts = [{ ...expense('a', appPaid), kind: '인지대', application: { opponentIds: ['b'], rates: { a: { b: { n: '1', d: '1' } } } } }];
  return { parties, stages, applicationCosts, label: p => p.name, onClose() {} };
}
function settle(f) { return settleCosts(f.parties, reviewCosts(f.stages, f.parties), reviewAutomaticApplicationCosts(f.applicationCosts, f.parties, f.stages), f.stages); }
function component(file, symbol) {
  const source = ts.transpileModule(fs.readFileSync('src/app/litigation-costs/' + file + '.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => {
    if (name === './CostStatementModal') return { CostStatementModal: () => null };
    if (name.startsWith('./')) return load('src/app/litigation-costs/' + name.slice(2) + '.ts');
    return require(name);
  }, mod, mod.exports);
  return mod.exports[symbol];
}
const View = component('CostReview', 'CostReview');
const Statement = component('CostStatementModal', 'CostStatementModal');
const render = (type, props) => renderToStaticMarkup(React.createElement(type, props)).replace(/<[^>]*>/g, '');

test('화면과 인쇄 모두 상계·신청비용 가산 후에만 1원 미만 절사한 금액 표시', () => {
  for (const [a, b, combined, payable, payer] of [
    ['5', '2', '10/3원', '3원', 'b'],
    ['1', '11', '-7/3원', '2원', 'a'],
    ['1', '1', '1원', '1원', 'b'],
    ['0', '1', '1/3원', '0원', 'b'],
  ]) {
    const f = fixture(a, b, '1');
    f.stages[0].rules[0].d = '3';
    const [row] = settle(f);
    assert.equal(money(row.combinedAmount), combined);
    assert.equal(money(row.payable), payable);
    assert.equal(row.payer.id, payer);
    for (const type of [View, Statement]) {
      const content = render(type, f);
      assert(content.includes(payable));
      assert(content.includes('최종 지급액에서만 1원 미만 버림'));
      assert(!content.includes('10원 미만'));
      assert(!content.includes('단계별 절사'));
    }
  }
});

test('입력 비용에 판결 비율을 적용한 뒤 양측 회수액을 자동 상계하고 신청비용 합산', () => {
  const f = fixture('1000', '200', '100');
  const [row] = settle(f);
  assert.equal(row.missing, '');
  assert.equal(money(row.forward), '500원');
  assert.equal(money(row.reverse), '100원');
  assert.equal(money(row.net), '400원');
  assert.equal(money(row.payable), '450원');
  assert.equal(row.payer.id, 'b');
  for (const type of [View, Statement]) {
    const text = render(type, f);
    assert.match(text, type === View ? /상대방\s*→\s*신청인/ : /상대방이\(가\) 신청인에게 지급할/);
    assert.match(text, /450원/);
    assert.doesNotMatch(text, /제출 상태|상계 방식|정산 대기/);
  }
});

test('명시적 0원은 정산 완료, 비용 미입력 및 빈 금액은 화면과 계산서 최종 금액 차단', () => {
  const zero = fixture('1000', '0');
  assert.equal(settle(zero)[0].missing, '');
  assert.equal(money(settle(zero)[0].payable), '500원');
  for (const type of [View, Statement]) assert.match(render(type, zero), type === View ? /상대방\s*→\s*신청인/ : /지급할/);
  for (const f of [fixture('1000', null), fixture(null, '200'), fixture('1000', '')]) {
    assert(settle(f).every(r => r.missing));
    for (const type of [View, Statement]) {
      assert.doesNotMatch(render(type, f), /에게 지급할/);
      assert.match(render(type, f), /입력/);
    }
  }
});

test('음수 최종액은 신청인이 지급하는 양수 금액으로 표시하고 신청비용 합산 후 방향 결정', () => {
  const f = fixture('200', '1000', '100');
  const [row] = settle(f);
  assert.equal(row.payer.id, 'a');
  assert.equal(row.receiver.id, 'b');
  assert.equal(money(row.payable), '350원');
  for (const type of [View, Statement]) {
    const text = render(type, f);
    assert.match(text, type === View ? /신청인\s*→\s*상대방/ : /신청인이\(가\) 상대방에게 지급할/);
    assert.match(text, /350원/);
  }
  const offset = settle(fixture('200', '1000', '1000'))[0];
  assert.equal(offset.payer.id, 'b');
  assert.equal(money(offset.payable), '100원');
});

test('신청비용 오류가 있으면 본안 계산이 되어도 최종 금액을 확정하지 않음', () => {
  const f = fixture();
  f.applicationCosts[0].paid = '';
  assert(settle(f)[0].missing);
  for (const type of [View, Statement]) assert.doesNotMatch(render(type, f), /에게 지급할/);
});

test('여러 상대방의 0원과 미입력 여부 및 정산액을 각각 유지', () => {
  const f = fixture('1200', '0');
  f.parties = [...parties, { id: 'c', name: '상대방2', group: '피신청인' }];
  f.stages[0].members.c = {};
  f.stages[0].rules[0].right.push('c');
  let rows = settle(f);
  assert.equal(rows[0].missing, '');
  assert.match(rows[1].missing, /피신청인 지출 비용/);
  f.stages[0].costs.push(expense('c', '400'));
  rows = settle(f);
  assert(rows.every(r => !r.missing));
  assert.deepEqual(rows.map(r => [r.b.id, money(r.payable)]), [['b', '300원'], ['c', '100원']]);
});

test('상대방 전부 부담이면 상대방 지출 미입력 그대로 원문 312595원 재현', () => {
  const f = fixture('300000', null, '900');
  f.stages[0].value = '2000000';
  f.stages[0].costs[0].kind = '변호사보수';
  f.stages[0].rules[0].mode = '2측 전부 부담';
  f.applicationCosts.push({ ...f.applicationCosts[0], id: 'delivery', kind: '송달료', paid: '11695' });
  f.applicationCaseNumber = '2026카확41053';
  const [row] = settle(f);
  assert.equal(row.respondentEntered, false);
  assert.equal(row.respondentRecoveryExcluded, true);
  assert.equal(row.missing, '');
  assert.equal(money(row.payable), '312,595원');
  for (const type of [View, Statement]) {
    const text = render(type, f);
    assert.match(text, /312,595원/);
    assert.match(text, type === View ? /상대방\s*→\s*신청인/ : /에게 지급할/);
    assert.doesNotMatch(text, /피신청인 지출 비용을 입력하세요/);
  }
  assert.match(render(Statement, f), /2026카확41053/);
  assert.equal(f.stages[0].costs.length, 1);
});

test('비율 부담·누락 주문·일부 심급의 역방향 부담은 비용 미입력 확인 유지', () => {
  const f = fixture('1000', null);
  assert.equal(settle(f)[0].respondentRecoveryExcluded, false);
  assert.match(settle(f)[0].missing, /피신청인 지출 비용/);
  f.stages.push({ ...f.stages[0], id: 'appeal', level: '항소심', costs: [], rules: [{ ...f.stages[0].rules[0], id: 'r2', mode: '2측 전부 부담', scope: '항소심 비용' }] });
  assert.equal(settle(f)[0].respondentRecoveryExcluded, false);
  // Total-cost zero-recovery order replaces the earlier positive recovery too.
  f.stages[1].rules[0].scope = '소송총비용';
  assert.equal(settle(f)[0].respondentRecoveryExcluded, true);
  f.stages[1].rules = [];
  f.stages[0].rules = [];
  assert(settle(f).every(r => !r.respondentRecoveryExcluded));
});

test('본소는 상대방 전부 부담이어도 반소에서 회수 가능하면 미입력 상태로 유지', () => {
  const f = fixture('1000', null);
  f.applicationCosts = [];
  const s = f.stages[0];
  s.counter = '1';
  s.costs[0].claim = '본소';
  s.rules[0].mode = '2측 전부 부담';
  s.rules[0].claim = '본소';
  s.rules.push({ ...s.rules[0], id: 'counter', claim: '반소', mode: '1측 전부 부담' });
  assert.equal(settle(f)[0].respondentRecoveryExcluded, false);
  assert.match(settle(f)[0].missing, /피신청인 지출 비용/);
});

test('인쇄 사건번호는 폼 값을 사용하고 미입력 시 임의의 연도·사건번호를 만들지 않음', () => {
  const f = fixture();
  f.applicationCaseNumber = '2027카확12345';
  assert.match(render(Statement, f), /2027카확12345/);
  delete f.applicationCaseNumber;
  const text = render(Statement, f);
  assert.match(text, /사건번호 입력/);
  assert.doesNotMatch(text, /2026카확/);
});

test('2026카확1724 항소심 본소·반소 흡수 계산서의 소가·사건번호·상환액 재현', () => {
  const f = fixture('3690500', null, '900');
  f.applicationCaseNumber = '2026카확1724';
  const s = f.stages[0];
  Object.assign(s, { level: '항소심', number: '2025나203223', counter: '반소', counterNumber: '2025나203224',
    value: '29868027', counterValue: '29868027', mainValueTarget: '신청인측', counterFeeMode: '흡수' });
  Object.assign(s.costs[0], { kind: '변호사보수', claim: '공통' });
  Object.assign(s.rules[0], { scope: '항소심 비용', mode: '2측 전부 부담', claim: '본소와 반소' });
  f.applicationCosts.push({ ...f.applicationCosts[0], id: 'delivery', kind: '송달료', paid: '11219' });
  const text = render(Statement, f);
  assert.match(text, /2025나203223\(본소\), 2025나203224\(반소\)/);
  assert.match(text, /제2심 소가 : 29,868,027원/);
  assert.match(text, /흡수/);
  assert.match(text, /금 2,801,561원/);
  assert.doesNotMatch(text, /59,736,054|제항소심/);
  s.counterFeeMode = '합산';
  assert.match(render(Statement, f), /제2심 소가 : 59,736,054원/);
  s.level = '상고심';
  assert.match(render(Statement, f), /제3심 소가/);
  delete s.counter;
  const mainOnly = render(Statement, f);
  assert.match(mainOnly, /제3심 소가 : 29,868,027원/);
  assert.doesNotMatch(mainOnly, /2025나203224/);
});

test('신청인 2명·피신청인 3명의 정산은 관계별 한 행으로 표시하고 역방향·0원·미입력 구분', () => {
  const f = fixture();
  f.parties = ['a', 'a2', 'b', 'c', 'd'].map((id, index) => ({ id, name: id, group: index < 2 ? '신청인' : '피신청인' }));
  const s = f.stages[0];
  s.members = Object.fromEntries(f.parties.map(p => [p.id, {}]));
  s.rules[0].left = ['a', 'a2']; s.rules[0].right = ['b', 'c', 'd']; s.rules[0].leftMethod = '균분';
  s.costs = [expense('a', '1200'), expense('a2', '0'), expense('b', '0'), expense('c', '600')];
  f.applicationCosts = [];
  const markup = renderToStaticMarkup(React.createElement(View, f));
  const tables = [...markup.matchAll(/<table[^>]*aria-label="[^"]+ 관계별 최종 정산액"[^>]*>(.*?)<\/table>/gs)];
  assert.equal(tables.length, 2);
  const summary = tables.map(t => [...t[1].matchAll(/<tbody[^>]*>(.*?)<\/tbody>/gs)][0][1]);
  const cells = summary.flatMap(body => [...body.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)].map(row =>
    [...row[1].matchAll(/<(?:th|td)[^>]*>(.*?)<\/(?:th|td)>/gs)].slice(0, 3).map(cell => cell[1].replace(/<[^>]*>/g, ''))));
  assert.deepEqual(cells, [
    ['b', 'b→a', '최종 지급액200원'], ['c', 'c→a', '최종 지급액50원'], ['d', '입력 확인 필요', '최종 지급액확인 필요'],
    ['b', '지급 없음', '최종 지급액0원'], ['c', 'a2→c', '최종 지급액150원'], ['d', '입력 확인 필요', '최종 지급액확인 필요'],
  ]);
  assert.equal((markup.match(/>계산 상세<\/summary>/g) || []).length, 6);
  assert(!markup.includes('당사자별 상환 및 상계 정산 내역'));
  assert(markup.indexOf('관계별 최종 정산액') < markup.indexOf('인정 비용 총액'));
  assert(!/<details[^>]*\bopen\b/.test(markup), '계산 상세는 기본 접힘');
});
