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

test('반소 없는 1심은 소가 대상 선택 없이 개별소가를 입력하고 반소 때만 대상을 선택', () => {
  const f = setup();
  delete f.current().mainValueTarget;
  f.current().useIndividualValues = false;
  let root = f.render();
  assert(!text(root).includes('본소 원고 측'));
  assert.equal(nodes(root, n => n.type === 'input' && n.props.placeholder === '개별 소가 입력').length, 0);

  const individualLabel = nodes(root, n => n.type === 'label' && text(n) === '개별소가')[0];
  const checkbox = nodes(individualLabel, n => n.type === 'input')[0];
  assert.equal(checkbox.props.disabled, false);
  checkbox.props.onChange({ currentTarget: { checked: true } });
  root = f.render();
  assert.equal(nodes(root, n => n.type === 'input' && n.props.placeholder === '개별 소가 입력').length, 4);
  assert(!text(root).includes('본소 원고 측'));

  f.current().counter = '반소';
  const counterView = text(f.render());
  assert(counterView.includes('본소 원고 측'));
  assert(counterView.includes('본소 전체 소가 (원)'));
});

test('반소 지위는 1대1·공동소송 모두 별도 입력하지 않음', () => {
  const f = setup(true);
  delete f.current().members.a2;
  delete f.current().members.b2;
  let root = f.render();
  assert.equal(nodes(root, n => n.type === 'select' && n.props['aria-label']?.endsWith('반소 지위')).length, 0);

  f.current().members.a2 = { role: '원고', number: '', value: '20000000', counterValue: '15000000', counterRole: '' };
  root = f.render();
  assert.equal(nodes(root, n => n.type === 'select' && n.props['aria-label']?.endsWith('반소 지위')).length, 0);
});

test('1대1 사건의 숨겨진 옛 반소 지위는 반소 해제를 막지 않음', () => {
  const f = setup(true);
  delete f.current().members.a2;
  delete f.current().members.b2;
  f.current().members.a.counterRole = '반소피고';
  f.current().members.b.counterRole = '반소원고';
  f.current().members.a.counterValue = '';
  f.current().members.b.counterValue = '';
  f.current().counterValue = '';
  f.current().rules[0].claim = '';
  const counterLabel = nodes(f.render(), n => n.type === 'label' && text(n) === '반소')[0];
  nodes(counterLabel, n => n.type === 'input')[0].props.onChange({ target: { checked: false } });
  assert.equal(f.current().counter, '');
  assert.equal(f.current().members.a.counterRole, '');
  assert.equal(f.current().members.b.counterRole, '');
});

test('일부반소를 켰을 때만 반소원고·반소피고 대상을 선택하고 저장', () => {
  const f = setup(true);
  let root = f.render();
  const partialLabel = nodes(root, n => n.type === 'label' && text(n) === '일부반소')[0];
  assert(partialLabel);
  const counterControls = nodes(root, n => n.type === 'div' && n.props.className === 'flex flex-wrap items-end gap-3'
    && text(n).includes('반소 개별소가') && text(n).includes('일부반소'))[0];
  assert(counterControls);
  assert(text(counterControls).indexOf('반소 개별소가') < text(counterControls).indexOf('일부반소'));
  assert(!text(root).includes('반소원고(본소 피고 중 선택)'));
  nodes(partialLabel, n => n.type === 'input')[0].props.onChange({ currentTarget: { checked: true } });
  assert.deepEqual(f.current().partialCounter, { counterPlaintiffIds: [], counterDefendantIds: [] });

  root = f.render();
  assert(text(root).includes('반소원고(본소 피고 중 선택)'));
  assert(text(root).includes('반소피고(본소 원고 중 선택)'));
  assert(text(root).includes('상환액 계산과 PDF 인쇄는 계산 로직 연결 후 사용할 수 있습니다'));
  assert.equal(nodes(root, n => n.type === 'select' && n.props['aria-label']?.endsWith('반소 지위')).length, 0);
  const counterPlaintiffs = nodes(root, n => n.type === 'fieldset' && text(n).startsWith('반소원고(본소 피고 중 선택)'))[0];
  nodes(counterPlaintiffs, n => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  root = f.render();
  const counterDefendants = nodes(root, n => n.type === 'fieldset' && text(n).startsWith('반소피고(본소 원고 중 선택)'))[0];
  nodes(counterDefendants, n => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  assert.deepEqual(f.current().partialCounter, { counterPlaintiffIds: ['b'], counterDefendantIds: ['a'] });
});

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

test('본안·신청비용·송달료 창의 금액은 오른쪽 정렬·콤마 표시하고 저장값은 숫자만 유지', () => {
  const f = setup(true);
  f.current().mainValues = [{ id: 'shared', side: '신청인측', ids: ['a', 'a2'], amount: '2000000' }];
  f.current().costs.push({ id: 'stamp', payer: 'a', kind: '인지대', paid: '1234567', refund: '12345', ids: ['a'], shared: false, method: '' });
  states[7] = [{ id: 'delivery', kind: '송달료', paid: '17642', refund: '1000', payer: 'a', ids: ['a'], shared: false, method: '', deliveryDetail: { incurred: '12000', decision: '5640', mobile: '2' } }];
  states[8] = true;
  states[9] = { incurred: '12000', decision: '5640', mobile: '2' };
  const root = f.render();
  const amounts = nodes(root, n => n.type === 'input' && n.props['aria-label']?.endsWith('(원)'));
  assert(amounts.length >= 15, '소가·보수·납부액·환급액·송달료 창까지 검사');
  for (const input of amounts) {
    assert(input.props.className.includes('text-right'), input.props['aria-label']);
    const digits = input.props.value.replaceAll(',', '');
    assert.equal(input.props.value, /^\d+$/.test(digits) ? BigInt(digits).toLocaleString('ko-KR') : digits, input.props['aria-label']);
  }
  const fields = nodes(root, n => n.type === 'label' && n.props.className === 'block text-sm font-medium text-slate-800');
  for (const field of fields) {
    const input = nodes(field, n => n.type === 'input')[0];
    if (input?.props['aria-label']?.endsWith('(원)')) assert.equal(text(field), input.props['aria-label'], '입력칸 위 중복 금액 없음');
  }
  const feeInput = amounts.find(n => n.props['aria-label'] === '변호사보수액 (원)');
  const element = { value: '1,234,567', selectionStart: 9, setSelectionRange() {} };
  feeInput.props.onChange({ currentTarget: element });
  assert.equal(f.current().costs[0].paid, '1234567');
  assert.equal(nodes(f.render(), n => n.type === 'input' && n.props['aria-label'] === '변호사보수액 (원)')[0].props.value, '1,234,567');
});
