const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const load = require('./load-ts.cjs')();
const source = ts.transpileModule(fs.readFileSync('src/app/litigation-costs/RelationValueInput.tsx', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
let states, cursor;
const mod = { exports: {} };
vm.runInThisContext('(function(require,module,exports){' + source + '\n})')(name => {
  if (name === 'react') return { useState: initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], next => { states[index] = next; }];
  } };
  if (name.startsWith('./')) return load('src/app/litigation-costs/' + name.slice(2) + '.ts');
  return require(name);
}, mod, mod.exports);
function nodes(root, predicate) {
  if (!root || typeof root !== 'object') return [];
  if (Array.isArray(root)) return root.flatMap(n => nodes(n, predicate));
  return [...(predicate(root) ? [root] : []), ...nodes(root.props.children, predicate)];
}
function text(root) {
  if (root == null || typeof root === 'boolean') return '';
  if (Array.isArray(root)) return root.map(text).join('');
  return typeof root === 'object' ? text(root.props.children) : String(root);
}
function setup(owner = 'a', counter = false) {
  states = []; cursor = 0;
  const parties = ['a', 'a2', 'b', 'c'].map((id, i) => ({ id, group: i < 2 ? '신청인' : '피신청인' }));
  const stage = { members: Object.fromEntries(parties.map(p => [p.id, { value: '4000', counterValue: '4000' }])) };
  const props = { stage, party: parties.find(p => p.id === owner), parties, counter, enabled: true, label: p => p.id,
    change: patch => Object.assign(stage.members[owner], patch) };
  const render = () => { cursor = 0; return mod.exports.RelationValueInput(props); };
  const button = label => nodes(render(), n => n.type === 'button' && text(n) === label)[0];
  const open = () => button('관계별 소가 입력').props.onClick();
  return { props, stage, render, button, open };
}

test('개별소가 미입력·개별소가 해제·상대방 한 명일 때 버튼 비활성화', () => {
  const f = setup();
  assert.equal(f.button('관계별 소가 입력').props.disabled, false);
  f.stage.members.a.value = '';
  assert.equal(f.button('관계별 소가 입력').props.disabled, true);
  f.stage.members.a.value = '4000'; f.props.enabled = false;
  assert.equal(f.button('관계별 소가 입력').props.disabled, true);
  f.props.enabled = true; delete f.stage.members.c;
  assert.equal(f.button('관계별 소가 입력').props.disabled, true);
});

test('양방향 및 반소에서도 상대방별 입력·합계 검증·반영·해제 가능', () => {
  for (const [owner, counter, opponents] of [['a', false, ['b', 'c']], ['b', false, ['a', 'a2']], ['b', true, ['a', 'a2']]]) {
    const f = setup(owner, counter); f.open();
    const fill = (index, value) => nodes(f.render(), n => n.type === 'input')[index].props.onChange({ target: { value } });
    const labels = nodes(f.render(), n => n.type === 'label').map(text);
    assert(labels[0].includes(opponents[0])); assert(labels[1].includes(opponents[1]));
    fill(0, '3000'); fill(1, '2000');
    assert.equal(f.button('관계별 소가 반영').props.disabled, true);
    fill(1, '1000');
    assert.equal(f.button('관계별 소가 반영').props.disabled, false);
    f.button('관계별 소가 반영').props.onClick();
    const key = counter ? 'counterRelationValues' : 'relationValues';
    assert.deepEqual(f.stage.members[owner][key], { [opponents[0]]: '3000', [opponents[1]]: '1000' });
    assert.equal(f.stage.members[owner].value, '4000');
    f.button('관계별 소가 수정').props.onClick();
    f.button('관계별 입력 해제').props.onClick();
    assert.equal(f.stage.members[owner][key], undefined);
  }
});

test('취소 시 입력은 저장되지 않으며 0원과 빈 값은 구분', () => {
  const f = setup(); f.open();
  nodes(f.render(), n => n.type === 'input')[0].props.onChange({ target: { value: '4000' } });
  assert.equal(f.button('관계별 소가 반영').props.disabled, true);
  nodes(f.render(), n => n.type === 'input')[1].props.onChange({ target: { value: '0' } });
  assert.equal(f.button('관계별 소가 반영').props.disabled, false);
  f.button('취소').props.onClick();
  assert.equal(f.stage.members.a.relationValues, undefined);
});
