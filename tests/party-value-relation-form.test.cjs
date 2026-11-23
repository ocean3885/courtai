const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const load = require('./load-ts.cjs')();
const { calculateLitigationCosts } = load('src/app/litigation-costs/litigationCalculation.ts');
const source = ts.transpileModule(fs.readFileSync('src/app/litigation-costs/PartyForm.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let states, cursor;
const react = {
  useEffect() {},
  useState(initial) {
    const i = cursor++;
    if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
    return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }];
  },
};
const loaded = { exports: {} };
const localRequire = name => {
  if (name === 'react') return react;
  for (const component of ['CostReview', 'RelationValueInput', 'BurdenOrderSection']) {
    if (name === './' + component) return { [component]: () => null };
  }
  if (name.startsWith('./')) return load('src/app/litigation-costs/' + name.slice(2) + '.ts');
  return require(name);
};
vm.runInThisContext('(function(require,module,exports,crypto){' + source + '\n})')(localRequire, loaded, loaded.exports, require('node:crypto').webcrypto);
function expand(node) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(expand);
  if (typeof node.type === 'function') return expand(node.type.name === 'Section' ? node.props.children : node.type(node.props));
  return { ...node, props: { ...node.props, children: expand(node.props.children) } };
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props.children, predicate)];
}
function text(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.props.children) : String(node);
}
function setup(counter = false) {
  const parties = ['a', 'a2', 'b', 'b2'].map((id, i) => ({ id, name: id, group: i < 2 ? '신청인' : '피신청인' }));
  const s = { id: 'first', level: '1심', value: '50000000', number: '', mainValueTarget: '신청인측', useIndividualValues: true,
    counter: counter ? '반소' : '', counterValue: '30000000', useCounterIndividualValues: counter, counterFeeMode: counter ? '합산' : undefined,
    members: Object.fromEntries(parties.map((p, i) => [p.id, { role: i < 2 ? '원고' : '피고', number: '', value: String((i + 1) * 10000000), counterValue: '15000000', counterRole: '' }])),
    costs: parties.filter(p => p.id === 'a' || p.id === 'b').map(p => ({ id: p.id, payer: p.id, kind: '변호사보수', paid: '20000000', refund: '0', ids: [p.id], method: '', shared: false, title: '', evidence: '' })),
    rules: [{ id: 'r', left: ['a', 'a2'], right: ['b', 'b2'], mode: '2측 전부 부담', n: '1', d: '3', scope: '1심 비용', claim: counter ? '본소와 반소' : '', leftMethod: '균분', rightMethod: '균분' }],
  };
  states = { 3: parties, 4: [s] };
  const render = () => { cursor = 0; return expand(loaded.exports.default()); };
  const side = title => nodes(render(), n => n.type === 'div' && n.props.className === 'min-w-0 space-y-2.5' && text(n).startsWith(title))[0];
  const click = (title, label) => {
    const button = nodes(side(title), n => n.type === 'button' && text(n) === label)[0];
    assert(button, label); button.props.onClick();
    assert.equal(nodes(side(title), n => n.type === 'button' && text(n) === label)[0].props['aria-pressed'], true);
  };
  return { parties, render, click, current: () => states[4][0] };
}

test('양측 관계 버튼은 설명만 저장하며 1심 소가·양측 보수 한도 유지, 기타도 저장 복원', () => {
  const f = setup();
  const before = calculateLitigationCosts(f.parties, [f.current()], []);
  assert.deepEqual(before.errors, []);
  const amountInput = () => nodes(f.render(), n => n.type === 'input' && n.props['aria-label'] === '1심 소가 (원)')[0];
  assert.equal(amountInput().props.value, '50,000,000');
  assert.equal(amountInput().props.readOnly, false);
  for (const [label, relation] of [['합산', '합산'], ['흡수', '흡수'], ['기타', '기타']]) {
    f.click('신청인 측 당사자', label);
    f.click('피신청인 측 당사자', label);
    assert.equal(amountInput().props.value, '50,000,000');
    assert.equal(f.current().applicantValueRelation, relation);
    assert.equal(f.current().opponentValueRelation, relation);
    const restored = JSON.parse(JSON.stringify(f.current()));
    assert.deepEqual(calculateLitigationCosts(f.parties, [restored], []).main, before.main);
  }
  amountInput().props.onChange({ currentTarget: { value: '60000000', selectionStart: 8, setSelectionRange() {} } });
  const after = calculateLitigationCosts(f.parties, [f.current()], []);
  assert(after.main.expenses.every(e => e.feeBasis === 60000000n && e.feeLimit === 5000000n));
});

test('반소 측 관계 표시도 입력한 본소·반소 전체 소가와 독립적으로 저장', () => {
  const f = setup(true);
  const before = calculateLitigationCosts(f.parties, [f.current()], []);
  assert.deepEqual(before.errors, []);
  f.click('피신청인 측 당사자', '기타');
  assert.equal(f.current().counterValueRelation, '기타');
  assert.equal(f.current().counterValue, '30000000');
  assert.equal(f.current().value, '50000000');
  assert.deepEqual(calculateLitigationCosts(f.parties, [f.current()], []).main, before.main);
});
