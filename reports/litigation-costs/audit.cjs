/* eslint @typescript-eslint/no-require-imports: "off" */
/* Run from any directory: node reports/litigation-costs/audit.cjs
 * Development audit only. Does not modify application code or contact a database.
 * Sample names are mapped in results; people and case numbers are anonymized.
 * PDF amounts are comparison observations, not authoritative product expectations.
 * Assertions reproduce stated inputs and calculation paths, not a legal error verdict.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const root = path.resolve(__dirname, '../..');
const load = require('../../tests/load-ts.cjs')();
const engine = load('src/app/litigation-costs/costReview.ts');
const { ordinaryFeeLimit } = load('src/app/litigation-costs/ordinaryFee.ts');
const { add, subtract, nothing, resolveFeeBasisValue } = engine;
// Preserve the source-arithmetic reference independently of the product's
// stage-by-stage truncation policy. Neither reference is a PDF correctness rule.
const reviewCosts = (stages, people) => engine.reviewCosts(stages, people, '정밀');
const digest = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, f))).digest('hex');
const party = (id, group, side) => ({ id, name: id.toUpperCase(), group, ...(side ? { side } : {}) });
const A = party('a', '신청인'), B = party('b', '피신청인');
const two = [A, B];
let serial = 0;
const cost = (payer, kind, paid, extra = {}) => ({ id: `c${++serial}`, payer, kind, paid: String(paid), refund: '0', shared: false, ids: [payer], method: '', evidence: '', title: '', ...extra });
const rule = (left, right, mode = '2측 전부 부담', extra = {}) => ({ id: `r${++serial}`, left, right, mode, n: '', d: '', scope: '1심 비용', claim: '', leftMethod: '균분', rightMethod: '균분', ...extra });
const stage = (level, value, people, costs, rules, extra = {}) => ({ id: `s${++serial}`, level, value: String(value), number: '', members: Object.fromEntries(people.map(p => [p.id, { role: '', number: '', value: '', counterRole: '' }])), counter: '', counterValue: '', useIndividualValues: false, costs, rules, ...extra });
const fraction = (n, d = 1n) => ({ n: BigInt(n), d: BigInt(d) });
const multiply = (a, b) => fraction(a.n * b.n, a.d * b.d);
const sum = arr => arr.reduce(add, nothing);
const floor = (a, unit = 1n) => a.n / a.d / unit * unit;
const encode = value => JSON.parse(JSON.stringify(value, (_, v) => typeof v === 'bigint' ? v.toString() : v instanceof Map ? Object.fromEntries(v) : v));
const amount = a => ({ ...encode(a), floorWon: floor(a).toString(), floorTenWon: floor(a, 10n).toString() });
const pair = (result, owner = 'a', debtor = 'b') => sum(result.lines.filter(l => l.owner === owner && l.debtor === debtor).map(l => l.amount));
const cases = [];
function run(id, people, stages, applicationCosts, notes = []) {
  const result = reviewCosts(stages, people);
  const record = { id, notes, input: { parties: people, stages, applicationCosts }, engine: encode(engine.reviewCosts(stages, people)), exactReferenceEngine: encode(result) };
  cases.push(record);
  return { record, result };
}
function screen(people, stages, applicationCosts, reviews) {
  // Render the actual CostReview component with its stage-by-stage policy.
  const file = 'src/app/litigation-costs/CostReview.tsx';
  const source = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  const req = name => {
    if (name === 'react') return React;
    if (name === './costReview') return engine;
    if (name === './applicationCosts') return load('src/app/litigation-costs/applicationCosts.ts');
    if (name === './caseInput') return load('src/app/litigation-costs/caseInput.ts');
    return require(name);
  };
  vm.runInThisContext('(function(require,module,exports){' + source + '\n})', { filename: file })(req, mod, mod.exports);
  const totals = reviewCosts(stages, people).ownerTotals;
  const states = reviews || Object.fromEntries(people.filter(p => p.group === '피신청인').map(p => [p.id, { submission: '기간 내 제출', treatment: '쌍방 비용 상계', zeroConfirmed: !totals.get(p.id)?.n }]));
  // Explicit comparison assumption: each applicant's application expense is
  // equally allocated to respondents, with 100% of each allocation borne by them.
  // This is not an automatic product default or an inference from the PDF.
  const opponents = people.filter(p => p.group === '피신청인').map(p => p.id);
  const applicationPolicy = { mode: '별도 기준', allocation: { opponentIds: opponents,
    rates: Object.fromEntries(people.filter(p => p.group === '신청인').map(p => [p.id, Object.fromEntries(opponents.map(id => [id, { n: '1', d: '1' }]))])) } };
  return renderToStaticMarkup(React.createElement(mod.exports.CostReview, { parties: people, stages, applicationCosts, applicationPolicy, reviews: states, label: p => p.name }));
}

// S01: source p1 total, p2 reimbursement formula, p3 valuation appendix.
{
  const people = [party('a1', '신청인'), party('a2', '신청인'), party('b1', '피신청인'), party('b2', '피신청인')];
  const r = rule(['a1', 'a2'], ['b1', 'b2'], '비율로 분담', { n: '1', d: '3' });
  const st = stage('1심', 105355798, people, [], [r]);
  st.mainValueTarget = '신청인측'; st.useIndividualValues = true;
  Object.assign(st.members.a1, { value: '52677899' }); Object.assign(st.members.a2, { value: '52677899' });
  Object.assign(st.members.b1, { value: '105361798' }); Object.assign(st.members.b2, { value: '57144171' });
  st.costs = [cost('a1', '변호사보수', 6600000, { shared: true, ids: ['a1', 'a2'], method: '균분' }), cost('b1', '변호사보수', 7600000, { shared: true, ids: ['b1', 'b2'], method: '안분' })];
  const app = [cost('a1', '인지대', 900), cost('a1', '기발생 송달료', 12327), cost('a1', '서기료', 220000)];
  const { record, result } = run('S01', people, [st], app, ['구현 후 최소 검증: 양측 개별 가액을 입력하고 각 측의 합산을 선택했다. 공동대리·중복/흡수 관계는 담당자가 판단한다. 피신청인 보수 기준을 PDF의 사건 소가로 고정하지 않는다.', '이 사례는 보수 연결 최소 검증이다. 전체 비용·공동 신청비용·상계 검증은 calculation-coverage.cjs와 s01-browser-results.json을 참고한다.']);
  assert.deepEqual(result.errors, []);
  assert.equal(resolveFeeBasisValue(st.costs[0], st, people), 105355798n);
  assert.equal(resolveFeeBasisValue(st.costs[1], st, people), 162505969n);
  const sourceFormula = v => subtract(multiply(fraction(9165460), fraction(1, 6)), multiply(fraction(7600000), fraction(v, 162505969 * 6)));
  const correctedFormula = v => subtract(multiply(fraction(9385460), fraction(1, 6)), multiply(fraction(7600000), fraction(v, 162505969 * 6)));
  record.reference = { statedApplicantTotal: '9165460', summedApplicantTotal: String(9152233 + 233227), discrepancy: '220000', feeValueOnPage1: '105355798', allocationValueOnPage3: '105361798', originalPairAmounts: ['1527576', '1082161'], originalFormulaPairAmounts: [105361798, 57144171].map(v => amount(sourceFormula(v))), totalCorrectedFormulaPairAmounts: [105361798, 57144171].map(v => amount(correctedFormula(v))) };
  assert.equal(floor(sourceFormula(105361798)), 706325n);
  assert.equal(floor(sourceFormula(57144171)), 1082161n);
}

// S02, S03, S04: source-recognized fees are a lower-bound proxy where invoices are absent.
for (const def of [
  { id: 'S02', values: [162900000], fees: [9658000], extras: [cost('a', '인지대', 635900), cost('a', '송달료', 82500, { refund: '74640' })], app: [900, 6377, 1000], main: 10301760n, total: 10310037n },
  { id: 'S03', values: [2000000], fees: [300000], extras: [], app: [900, 11695], main: 300000n, total: 312595n },
  { id: 'S04', values: [154110828, 154110828], fees: [9482216, 9482216], extras: [], app: [900, 12967, 1000], main: 18964432n, total: 18979299n },
]) {
  const stages = def.values.map((v, i) => stage(i ? '항소심' : '1심', v, two, [cost('a', '변호사보수', def.fees[i]), ...(i ? [] : def.extras)], [rule(['a'], ['b'], '2측 전부 부담', { scope: i ? '항소심 비용' : '1심 비용' })]));
  const app = def.app.map((v, i) => cost('a', i === 0 ? '인지대' : i === 1 ? '기발생 송달료' : '서류 발급비', v));
  const { record, result } = run(def.id, two, stages, app, ['실지급 보수 총액이 PDF에 없으므로 기재 인정액을 재현용 하한 입력으로 사용한다. 실제 지급 또는 지급의무 자료 확인은 별도다.', '제출 상태가 PDF에 없으므로 브라우저 재현에서는 신청인 비용만 반영을 선택했다. 사실 확인으로 취급하지 않는다.']);
  assert.deepEqual(result.errors, []);
  assert.equal(floor(pair(result)), def.main);
  assert.equal(floor(pair(result)) + BigInt(def.app.reduce((a, b) => a + b, 0)), def.total);
  const markup = screen(two, stages, app);
  assert(markup.includes(def.total.toLocaleString('ko-KR')));
  record.reference = { main: def.main.toString(), total: def.total.toString(), actualComponentIncludesReferenceTotal: true, browser: '동일 금액의 전액 산입 참고 합계 확인' };
}

// S05: partial finality, different debtor rates, main/counter fee bases.
{
  const people = [A, party('b1', '피신청인'), party('b2', '피신청인'), party('b3', '피신청인')];
  const r1 = rule(['a'], ['b1', 'b2'], '비율로 분담', { n: '2', d: '5' });
  const r2 = rule(['a'], ['b3']);
  const first = stage('1심', 414141226, people, [cost('a', '변호사보수', 12541412)], [r1, r2]);
  const { record, result } = run('S05', people, [first], [cost('a', '인지대', 900), cost('a', '기발생 송달료', 16742)], ['구현 후 최소 검증: 보수 한 건에 서로 다른 상대방별 주문을 적용하고, 일부 상소 후 원래 분모와 비상소자 부담을 유지한다. 이 재현은 균분 기준이며 PDF 전체 비용·소가 안분·신청비용 재현을 뜻하지 않는다.']);
  assert.deepEqual(result.errors, []);
  assert.equal(floor(pair(result, 'a', 'b1')), 2508282n);
  assert.equal(floor(pair(result, 'a', 'b3')), 4180470n);
  const appeal = stage('항소심', 414141226, people.slice(0, 3), [cost('a', '변호사보수', 15382806)], [rule(['a'], ['b1', 'b2'], '비율로 분담', { n: '2', d: '5', scope: '소송총비용', claim: '본소와 반소' })], { counter: '반소', counterValue: '482420000', counterFeeMode: '합산' });
  const combined = reviewCosts([first, appeal], people);
  const basis = resolveFeeBasisValue(appeal.costs[0], appeal, people);
  assert.equal(basis, 896561226n);
  assert.equal(ordinaryFeeLimit(basis), 15382806n);
  assert.deepEqual(combined.errors, []);
  assert.equal(floor(sum(combined.lines.filter(l => l.stage === '1심' && l.debtor === 'b3').map(l => l.amount))), 4180470n);
  const rawFor12 = add(multiply(add(multiply(fraction(12541412 + 1540300), fraction(207070613, 600941226)), fraction(96340, 3)), fraction(3, 5)), add(fraction(15382806 * 3, 10), fraction(17642, 5)));
  const reverse = fraction((5500000 + 20384036) * 2, 10);
  const rawFor3 = add(multiply(fraction(12541412 + 1540300), fraction(186800000, 600941226)), fraction(96340 + 17642, 3));
  const net = subtract(rawFor12, reverse);
  record.reference = { forward12: amount(rawFor12), reverse12: amount(reverse), net12: amount(net), net3: amount(rawFor3), sourceFinal12: '2372170', sourceFinal3: '4415230', currentCombinedFeeBasis: basis.toString(), currentLimit: ordinaryFeeLimit(basis).toString(), laterTotalCostErrors: combined.errors };
  assert.equal(floor(net, 10n), 2372170n);
  assert.equal(floor(rawFor3, 10n), 4415230n);
}

// S06: main/counter-specific orders and non-applicant denominator.
{
  const people = [party('a1', '신청인'), party('a2', '신청인'), party('ax', '신청외', '신청인측'), B];
  const first = stage('1심', 225079800, people, [cost('a1', '변호사보수', 5500000, { shared: true, ids: ['a1', 'a2', 'ax'], method: '안분' })], [rule(['a1', 'a2', 'ax'], ['b'], '1측 전부 부담', { claim: '본소' }), rule(['a1', 'a2', 'ax'], ['b'], '2측 전부 부담', { claim: '반소' })], { counter: '반소', counterValue: '78289999', counterFeeMode: '합산', useIndividualValues: true, mainValueTarget: '신청인측' });
  [96462800, 64308500, 64308500, 78289999].forEach((v, i) => { first.members[people[i].id].value = String(v); });
  const { record, result } = run('S06', people, [first], [cost('a1', '인지대', 900), cost('a2', '기발생 송달료', 11229)], ['구현 후 검증: 1심 본소·반소별 주문과 공통보수 소가 비율 배분, 신청외 몫 보존. 본소 소가는225079800, 반소78289999로 구분했다. 이 입력은 1심 부분만 검증한다. 신청비용의 두 신청인 균분은 후속 범위다.']);
  assert.deepEqual(result.errors, []);
  assert(result.lines.some(l => l.owner === 'ax' && l.kind.includes('반소')));
  const resultFor = (share, counter) => add(add(multiply(fraction(5500000 * 78289999, 303369799), fraction(share, 225079800)), multiply(fraction(6600000 * counter, 216692728), fraction(share, 160771300))), fraction(12129, 2));
  const printedFormula = [96462800, 64308500].map(v => amount(resultFor(v, 55291428)));
  const page1Values = [96462800, 64308500].map(v => amount(resultFor(v, 55921428)));
  record.reference = { sourceFinal: ['1625012', '1085223'], printedFormula, page1Values, page1CounterValue: '55921428', page2CounterValue: '55291428', firstStageDenominator: '225079800', appealDenominator: '160771300', nonApplicantValueRetained: '64308500', browserBeforeImplementation: '반소 적용 청구 선택 시 계산 차단. 현재 구현 후에는 청구별 주문·공통보수 배분을 지원한다.' };
  assert.equal(printedFormula[0].floorWon, '1624803');
  assert.equal(printedFormula[1].floorWon, '1085223');
}

// S07: three stages, pending fees, application rate and truncation order.
{
  const r = (level, n, d) => rule(['a'], ['b'], '비율로 분담', { n: String(n), d: String(d), scope: `${level} 비용`, claim: '본소와 반소' });
  const st1 = stage('1심', 1239770841, two, [], []);
  st1.costs = [cost('a', '변호사보수', 17100000), cost('a', '인지대', 3086100), cost('a', '송달료', 35592), cost('a', '기타 비용', 7750000, { title: '1차 감정료' }), cost('a', '기타 비용', 29700000, { title: '2차 감정료' }), cost('b', '변호사보수', 17098854), cost('b', '인지대', 1475900), cost('b', '송달료', 36288)];
  st1.rules = [r('1심', 2, 5)];
  const st2 = stage('항소심', 1239770841, two, [cost('a', '변호사보수', 16500000), cost('a', '인지대', 3421500), cost('a', '송달료', 29191), cost('b', '변호사보수', 17098854), cost('b', '인지대', 3421500), cost('b', '송달료', 58886), cost('b', '기타 비용', 74000, { title: '증인여비' })], [r('항소심', 2, 5)]);
  const st3 = stage('상고심', 721422505, two, [cost('a', '변호사보수', 14300000)], [rule(['a'], ['b'], '2측 전부 부담', { scope: '상고심 비용', claim: '본소와 반소' })]);
  const stages = [st1, st2, st3];
  const app = [cost('a', '인지대', 900), cost('a', '기발생 송달료', 11575)];
  const { record, result } = run('S07', two, stages, app, ['계산을 분리해 확인하기 위해 합산된 보수 기준 소가를 수동 입력했다. 폼이 본소·반소 소가를 자동 합산한 결과가 아니다.', '상고심14300000은 기지급7700000과 지급예정6600000의 합계다. 실지급 보수 칸에 합계를 넣는 가정이며 지급 상태를 정확하게 표현하지 못한다.']);
  assert.deepEqual(result.errors, []);
  const forward = pair(result), reverse = pair(result, 'b', 'a');
  const appRecognized = 7485n;
  const directional = floor(add(forward, fraction(appRecognized))) - floor(reverse);
  const lateFloor = floor(subtract(add(forward, fraction(appRecognized)), reverse));
  const stepped = engine.reviewCosts(stages, two);
  const currentReference = add(subtract(pair(stepped), pair(stepped, 'b', 'a')), fraction(12475));
  const markup = screen(two, stages, app);
  assert(markup.includes(engine.money(currentReference)));
  // Preserve the distinction between actually paid and contractually payable.
  const paidOnly = structuredClone(st3); paidOnly.costs[0].paid = '7700000'; paidOnly.costs[0].recognized = '14300000';
  const pendingErrors = reviewCosts([paidOnly], two).errors;
  assert(pendingErrors.some(e => e.includes('입력한 변호사보수액을 초과')));
  record.reference = { forward: amount(forward), reverse: amount(reverse), applicationPaid: '12475', applicationAt60Percent: appRecognized.toString(), directionalTruncation: directional.toString(), truncationAfterNet: lateFloor.toString(), currentComponentReference: amount(currentReference), applicationComparisonAssumption: '각 신청비용에 상대방 전액 부담을 명시 지정한 비교값', sourceFinal: '45174515', sourceDisplayedStageSum: String(34602328 + 11970415 + 14300000), sourceMainTotal: '60872742', pendingFeeErrors: pendingErrors };
  assert.equal(directional, 45174515n);
  assert.equal(lateFloor, 45174514n);
}

// S08: same-purpose claims, appeal only, successor relationship missing.
{
  const st = stage('항소심', 29868027, two, [cost('a', '변호사보수', 3690500)], [rule(['a'], ['b'], '2측 전부 부담', { claim: '본소와 반소', scope: '항소심 비용' })], { counter: '반소', counterValue: '29868027', counterFeeMode: '흡수' });
  const app = [cost('a', '인지대', 900), cost('a', '기발생 송달료', 11219)];
  const { record, result } = run('S08', two, [st], app, ['목적이 같은 본소·반소의 소가가 동일하므로 수동 입력29868027로 금액을 재현했다. 목적 동일성을 기록·판정하는 필드는 없다.', '승계인과 피승계인의 연결 및 승계 범위는 현 Party 타입에 없다.']);
  assert.deepEqual(result.errors, []);
  assert.equal(floor(pair(result)), 2789442n);
  assert(screen(two, [st], app).includes('2,801,561'));
  record.reference = { feeLimit: '2789442', total: '2801561', browser: '항소심만 선택·반소 동일액·실지급3690500 입력 후 전액 산입 참고2801561 확인', missing: ['승계인과 피승계인 연결', '본소 반소 목적 관계'] };
}

// S09: the non-applicant two remain in the 1/3 denominator.
{
  const people = [A, party('ax1', '신청외', '신청인측'), party('ax2', '신청외', '신청인측'), B];
  const first = stage('1심', 3396760, people, [cost('b', '인지대', 15200), cost('b', '송달료', 156000, { refund: '25304' }), cost('b', '기타 비용', 150000, { title: '출석비용' })], [rule(['a', 'ax1', 'ax2'], ['b'], '비율로 분담', { n: '1', d: '2' })]);
  const appeal = stage('항소심', 1698380, two, [cost('a', '변호사보수', 300000)], [rule(['a'], ['b'], '2측 전부 부담', { scope: '항소심 비용' })]);
  const supreme = stage('상고심', 1301620, two, [cost('a', '변호사보수', 300000)], [rule(['a'], ['b'], '2측 전부 부담', { scope: '상고심 비용' })]);
  const stages = [first, appeal, supreme];
  const app = [cost('a', '인지대', 900), cost('a', '기발생 송달료', 61)];
  const { record, result } = run('S09', people, stages, app, ['항소제기 이후 비용의 종합 주문을 심급별로 수동 분해했다. 원 주문의 시간 범위가 자동 해석된 것은 아니다.', '항소심은 환송 전후를 한 보수로 합친다. 두 사건번호·환송 이력·보수 그룹 연결은 폼에 없다.']);
  assert.deepEqual(result.errors, []);
  const netMain = subtract(pair(result), pair(result, 'b', 'a'));
  const desired = floor(add(netMain, fraction(961)), 10n);
  const current = floor(netMain, 10n) + 961n;
  assert.equal(desired, 551640n);
  assert.equal(current, 551641n);
  assert(screen(people, stages, app).includes('551,651원'));
  const stepped = engine.reviewCosts(stages, people);
  record.reference = { reverseApplicantShare: amount(pair(result, 'b', 'a')), netMain: amount(netMain), sourceBeforeTruncation: amount(add(netMain, fraction(961))), sourceFinal: desired.toString(), previousComponentTenWonReference: current.toString(), exactReferenceBeforeTruncation: amount(add(netMain, fraction(961))), currentComponentWithStepRounding: amount(add(subtract(pair(stepped), pair(stepped, 'b', 'a')), fraction(961))), nonApplicantCount: 2, feeGroups: '환송 전후 항소심 보수 1회' };
}

const sourceFiles = ['src/app/litigation-costs/caseInput.ts', 'src/app/litigation-costs/PartyForm.tsx', 'src/app/litigation-costs/costReview.ts', 'src/app/litigation-costs/CostReview.tsx', 'src/app/litigation-costs/applicationCosts.ts', 'src/app/litigation-costs/ApplicationCostAllocation.tsx', 'src/app/litigation-costs/ApplicationBurdenPolicy.tsx', 'src/app/litigation-costs/ordinaryFee.ts', 'DEPLOYMENT.md'];
const files = fs.readdirSync(path.join(root, 'output_sample')).filter(f => f.endsWith('.pdf')).sort();
const expectedFiles = ['ocean3885_000210_20264110035081_3_0.pdf', 'ocean3885_000210_20264110041008_3_0.pdf', 'ocean3885_000210_20264110041053_2_0.pdf', 'ocean3885_000210_20264110041061_2_0.pdf', 'ocean3885_000250_20264110021762_3_0.pdf', 'ocean3885_000280_20264110021190_3_0.pdf', 'ocean3885_000283_20264110001714_3_0.pdf', 'ocean3885_000283_20264110001724_2_0.pdf', 'ocean3885_250826_20264110003891_2_0.pdf'];
assert.deepEqual(files, expectedFiles, 'Sample inventory changed; review the ID mapping before rerunning.');
const pages = [3, 1, 1, 1, 2, 2, 3, 1, 2];
cases.sort((a, b) => a.id.localeCompare(b.id));
const results = { generatedAt: new Date().toISOString(), scope: '제공 PDF의 내용·산식과 현재 코드의 표현 능력 비교. 법령·판례의 현행 효력 확인은 포함하지 않는다.', assessmentPolicy: { pdfAmountsAreAuthoritative: false, amountDifferenceAloneIsError: false, criteria: ['입력 정보와 사건 구조의 보존', '명시한 산정 기준과 실제 계산의 일관성', '필요한 문서 구조의 생성'], referenceAmounts: 'PDF 기재액과 비교용 산식의 관찰값이며 제품 테스트 정답이 아니다.' }, verification: { visualPdfPages: 16, browserFullAmountPaths: ['S02', 'S03', 'S04', 'S08'], browserManualWorkarounds: ['S07', 'S09'], browserMinimalBlocker: ['S01', 'S05', 'S06'], browserEvidenceFile: 'browser-results.json', browserEvidenceDate: '2026-11-21', engineCases: cases.map(c => c.id), componentCases: ['S02', 'S03', 'S04', 'S07', 'S08', 'S09'], applicationChanged: false, productionDbAccessed: false }, sourceHashes: Object.fromEntries(sourceFiles.map(f => [f, digest(f)])), samples: files.map((f, i) => ({ id: `S${String(i + 1).padStart(2, '0')}`, file: `output_sample/${f}`, pages: pages[i], sha256: digest(`output_sample/${f}`) })), cases: cases.map(c => encode(c)) };
results.verification.applicationChanged = true;
results.verification.browserEvidencePhase = '최초 구현 전 관찰 기록이며 현재 소스 해시와 동일한 버전이 아니다.';
results.verification.currentBrowserEvidenceFile = 's01-browser-results.json';
results.verification.priorRoundingBrowserEvidenceFile = 'rounding-browser-results.json';
results.verification.priorCommonPolicyBrowserEvidenceFile = 'common-policy-browser-results.json';
results.verification.priorApplicationBrowserEvidenceFile = 'application-browser-results.json';
results.verification.relationsBrowserEvidenceFile = 'relations-browser-results.json';
results.verification.applicationComparisonAssumption = '컴포넌트 비교 사례는 신청비용 공통 별도 기준으로 상대방 전체 균분·배분액 전액 부담을 한 번 지정한다. 제품의 자동 가정이나 PDF 해석이 아니다.';
results.verification.priorImplementationBrowserEvidenceFile = 'claims-browser-results.json';
results.verification.currentAutomatedScope = ['보수 합산·다액흡수', '본소·반소별 주문', '공통비용 배분', '신청외 몫 보존', '비용 한 건의 상대방별 복수 주문', '상대방 전체 균분·소가 안분', '부분 상소의 원래 분모·비상소자 부담 보존', '겹치는 주문·불명확한 배분 차단'];
results.verification.currentAutomatedScope.push('신청비용 공동 귀속·직접 비율', '신청비용 상대방별 부담률', '공통 판결 기준 참조·수정 시 모든 연결 비용 자동 갱신', '신청비용 공통 별도 기준과 개별 비용 예외', '청구 선택·일부 상소·연결 삭제 검증', '단계별 절사 후 본안·신청비용 합산 및 미확인 차단');
results.verification.currentAutomatedScope.push('본소·반소 배분→공동 귀속→상대방 배분→부담률 각 단계 10원 미만 버림', '절사액을 다음 단계·합계·상계에 사용', '정밀 참고값과 단계별 입력·비율·절사액 보존');
results.verification.currentAutomatedScope.push('S01 양측 개별 가액 입력·각 측 보수의 합산/흡수 연결', 'S01 표시 대상 변경 시 양측 보수·안분 유지', '공동보수 일부 가액 누락 시 계산 차단');
results.verification.calculationPolicy = { mode: '단계별10원', referenceMode: '정밀', engine: '실제 단계별 절사 결과', exactReferenceEngine: 'PDF 산식과의 비교용이며 제품의 상환액으로 사용하지 않음', identity: '비율1 단계는 생략하며 배분 없는 원비용은 유지' };
fs.writeFileSync(path.join(__dirname, 'audit-results.json'), JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ samples: files.length, pages: pages.reduce((a, b) => a + b, 0), reproducibleCases: cases.length, comparisonPathsVerified: true, results: 'reports/litigation-costs/audit-results.json' }, null, 2));
