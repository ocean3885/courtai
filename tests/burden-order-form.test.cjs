const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load-ts.cjs')();
const { suggestedOrder } = load('src/app/litigation-costs/burdenOrders.ts');
const compiled = ts.transpileModule(fs.readFileSync('src/app/litigation-costs/BurdenOrderSection.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const loaded = { exports: {} };
let orderRef;
const localRequire = name => name.startsWith('./')
  ? load('src/app/litigation-costs/' + name.slice(2) + '.ts')
  : name === 'react' ? { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: initial => orderRef ||= { current: initial } } : require(name);
vm.runInThisContext('(function(require,module,exports){' + compiled + '\n})')(localRequire, loaded, loaded.exports);
const { BurdenOrderSection } = loaded.exports;
const parties = ['a', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i ? '피신청인' : '신청인' }));
const label = p => p.id;
function expand(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === 'function') return expand(node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props.children) } };
}
function nodes(root, predicate) {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(n => nodes(n, predicate));
  return [...(predicate(root) ? [root] : []), ...nodes(root.props.children, predicate)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.props.children) : String(node);
}
function setup() {
  orderRef = undefined;
  const first = { id: 'first', level: '1심', members: { a: {}, b: {}, c: {}, d: {} }, costs: [], rules: [], counter: '' };
  first.rules = [suggestedOrder(first, parties, 0, 'r1')];
  const appeal = { id: 'appeal', level: '항소심', members: { a: {}, c: {}, d: {} }, costs: [], rules: [], counter: '' };
  const stages = [first, appeal];
  const render = () => expand(BurdenOrderSection({ stages, parties, label,
    onUpdateStageRules: (id, rules) => { stages.find(s => s.id === id).rules = rules; } }));
  const editor = () => nodes(render(), n => n.type === 'h3' && text(n).startsWith('항소심'));
  const appealSection = () => nodes(render(), n => n.type === 'div' && n.props.className === 'space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4')[1];
  return { stages, render, appealSection, editor };
}

test('화면에서 항소심 주문 확인 → 총비용 선택 → 비율 변경 시 관계별 최종 적용과 1심 참여자 보존', () => {
  const { stages, render, appealSection } = setup();
  const click = title => {
    const button = nodes(appealSection(), n => n.type === 'button' && text(n) === title)[0];
    assert(button, title); button.props.onClick();
  };
  click('이 주문 확인·반영');
  assert.deepEqual(stages[1].rules[0].right, ['c', 'd']);
  const scope = nodes(appealSection(), n => n.type === 'select')[0];
  scope.props.onChange({ target: { value: '소송총비용' } });
  click('비율로 분담');
  const fractionInputs = nodes(appealSection(), n => n.type === 'input' && n.props.inputMode === 'numeric');
  fractionInputs[0].props.onChange({ target: { value: '2' } });
  // Re-render between controlled input changes, just as React does.
  nodes(appealSection(), n => n.type === 'input' && n.props.inputMode === 'numeric')[1].props.onChange({ target: { value: '5' } });
  const rows = nodes(render(), n => n.type === 'tbody')[0].props.children;
  assert.deepEqual(rows.slice(0, 3).map(text), [
    'b신청인 측 부담0상대방 측 부담전부1심 · 1심 비용',
    'c신청인 측 부담2/5상대방 측 부담3/5항소심 · 소송총비용',
    'd신청인 측 부담2/5상대방 측 부담3/5항소심 · 소송총비용',
  ]);
  assert.deepEqual(Object.keys(stages[0].members), ['a', 'b', 'c', 'd']);
  assert.deepEqual(stages[0].rules[0].right, ['b', 'c', 'd']);
});

test('주문 대상 체크박스는 참여자 목록과 독립적이며 부담 방식 변경 때 선택 유지', () => {
  const { stages, appealSection } = setup();
  nodes(appealSection(), n => n.type === 'button' && text(n) === '이 주문 확인·반영')[0].props.onClick();
  const labels = nodes(appealSection(), n => n.type === 'label' && text(n) === 'd');
  nodes(labels[0], n => n.type === 'input')[0].props.onChange({ target: { checked: false } });
  nodes(appealSection(), n => n.type === 'button' && text(n) === '신청인 전부 부담 (100%)')[0].props.onClick();
  assert.deepEqual(stages[1].rules[0].right, ['c']);
  assert.deepEqual(Object.keys(stages[1].members), ['a', 'c', 'd']);
  assert.match(text(appealSection()), /이 주문에 포함되지 않은 참여자: d/);
});

test('1심 주문 입력 생략은 편집기를 숨기고 비용·참여자를 보존하며 해제 시 원래 주문 복원', () => {
  const { stages, render } = setup();
  stages[0].costs = [{ id: 'expense', payer: 'a', paid: '120000' }];
  stages[0].rules[0].mode = '비율로 분담';
  stages[0].rules[0].n = '1';
  stages[0].rules[0].d = '3';
  const before = structuredClone(stages[0]);
  stages[1].members = structuredClone(stages[0].members);
  stages[1].rules = [{ ...suggestedOrder(stages[1], parties, 1, 'total'), scope: '소송총비용' }];
  const skip = () => nodes(render(), n => n.type === 'label' && text(n).includes('1심 주문 입력 생략'))[0];
  nodes(skip(), n => n.type === 'input')[0].props.onChange({ target: { checked: true } });
  assert.deepEqual(stages[0].rules, []);
  assert.deepEqual(stages[0].costs, before.costs);
  assert.deepEqual(stages[0].members, before.members);
  const firstSection = nodes(render(), n => n.type === 'div' && n.props.className === 'space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4')[0];
  assert.equal(nodes(firstSection, n => n.type === 'fieldset').length, 0);
  assert.equal(nodes(render(), n => n.props.role === 'alert').length, 0);
  assert(nodes(render(), n => n.type === 'tbody')[0].props.children.every(r => text(r).includes('항소심 · 소송총비용')));
  nodes(render(), n => n.type === 'button' && text(n) === '각자 부담')[0].props.onClick();
  assert.deepEqual(stages[0].rules, []);
  nodes(skip(), n => n.type === 'input')[0].props.onChange({ target: { checked: false } });
  assert.deepEqual(stages[0], before);
});

test('주문 추가 후 체크 순서와 관계없이 중복 관계를 비활성화하고 전체 선택으로도 우회 불가', () => {
  const { stages, render } = setup();
  const first = stages[0];
  first.rules[0].right = ['b'];
  first.rules.push({ ...first.rules[0], id: 'new-order', left: [], right: [] });
  const editors = () => nodes(render(), n => n.type === 'div' && n.props.className === 'space-y-3 border-t border-slate-200 pt-3');
  const check = (id, checked) => {
    const label = nodes(editors()[1], n => n.type === 'label' && text(n) === id)[0];
    const input = nodes(label, n => n.type === 'input')[0];
    if (checked !== undefined) input.props.onChange({ target: { checked } });
    return input;
  };
  check('a', true);
  assert.equal(check('b').props.disabled, true);
  check('b', true); // Guard a synthetic event as well as native disabled clicks.
  assert.deepEqual(first.rules[1].right, []);
  assert.equal(check('c').props.disabled, false);
  check('c', true);
  assert.deepEqual(first.rules[1].left, ['a']);
  assert.deepEqual(first.rules[1].right, ['c']);
  const all = nodes(editors()[1], n => n.type === 'button' && text(n) === '해당 심급 참여자 전체 선택')[0];
  assert.equal(all.props.disabled, true);
  all.props.onClick();
  assert.deepEqual(first.rules[1].right, ['c']);
  check('c', false); check('a', false); check('b', true);
  assert.equal(check('a').props.disabled, true);
  // Removing the original relationship immediately makes it available again.
  first.rules[0].right = [];
  assert.equal(check('a').props.disabled, false);
});

test('다수 당사자의 최종 주문은 심급·신청인별로 묶고 부담비율·각자 부담을 분리 표시', () => {
  const people = ['a', 'a2', 'b', 'c', 'd'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
  const first = { id: 'first', level: '1심', members: Object.fromEntries(people.map(p => [p.id, {}])), costs: [], rules: [], counter: '' };
  first.rules = [{ ...suggestedOrder(first, people, 0, 'r1'), mode: '비율로 분담', n: '1', d: '3' }];
  const appeal = { ...first, id: 'appeal', level: '항소심', members: { a: {}, a2: {}, b: {} }, rules: [{ ...first.rules[0], id: 'r2', right: ['b'], scope: '소송총비용', mode: '각자 부담' }] };
  const root = expand(BurdenOrderSection({ stages: [first, appeal], parties: people, label, onUpdateStageRules() {} }));
  const tables = nodes(root, n => n.type === 'table');
  assert.equal(tables.length, 4);
  assert.deepEqual(tables.map(t => t.props['aria-label']), [
    '1심 비용 · a 최종 적용 주문', '1심 비용 · a2 최종 적용 주문', '항소심 비용 · a 최종 적용 주문', '항소심 비용 · a2 최종 적용 주문',
  ]);
  for (const table of tables.slice(0, 2)) {
    const rows = nodes(table, n => n.type === 'tbody')[0].props.children;
    assert.equal(rows.length, 3);
    assert.equal(text(rows[0]), 'b각자 부담항소심 · 소송총비용');
    assert.equal(nodes(rows[0], n => n.type === 'td' && n.props.colSpan === 2).length, 1);
    assert.equal(text(rows[1]), 'c신청인 측 부담1/3상대방 측 부담2/31심 · 1심 비용');
    assert.equal(text(rows[2]), 'd신청인 측 부담1/3상대방 측 부담2/31심 · 1심 비용');
  }
  assert(!text(root).includes('변경 표시'));
});
