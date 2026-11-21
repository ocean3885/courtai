/* eslint @typescript-eslint/no-require-imports: "off" */
// Re-audit sample calculation structures after implementation. Run audit.cjs first.
// PDF figures supply case inputs, not authoritative expected reimbursement totals.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const load = require('../../tests/load-ts.cjs')();
const { reviewCosts, resolveFeeBasisValue, add, subtract, nothing, money } = load('src/app/litigation-costs/costReview.ts');
const { reviewApplicationCosts } = load('src/app/litigation-costs/applicationCosts.ts');
const source = JSON.parse(fs.readFileSync(path.join(__dirname, 'audit-results.json'), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
const inputs = Object.fromEntries(source.cases.map(c => [c.id, clone(c.input)]));
let serial = 0;
const expense = (payer, kind, paid, extra = {}) => ({ id: `coverage-cost-${++serial}`, payer, kind, paid: String(paid), refund: '0', shared: false, ids: [payer], method: '', title: '', evidence: '', ...extra });
const order = (left, right, mode, extra = {}) => ({ id: `coverage-rule-${++serial}`, left, right, mode, n: '', d: '', scope: '1심 비용', claim: '', leftMethod: '균분', rightMethod: '균분', ...extra });
const sum = lines => lines.reduce((s, l) => add(s, l.amount), nothing);
const factorIs = (step, n, d) => step.factor.n * BigInt(d) === BigInt(n) * step.factor.d;

// S01: choose sum for each side. The PDF's common fee basis is not authoritative.
{
  const input = inputs.S01, s = input.stages[0];
  s.mainValueTarget = '신청인측'; s.useIndividualValues = true;
  s.members.a1.value = '52677899'; s.members.a2.value = '52677899';
  s.members.b1.value = '105361798'; s.members.b2.value = '57144171';
  const joint = { shared: true, ids: ['a1', 'a2'], method: '균분' };
  s.costs.push(expense('a1', '인지대', 259000, joint), expense('a1', '송달료', 15133, joint), expense('a1', '기타 비용', 2278100, { ...joint, title: '감정료' }));
  input.applicationCosts.forEach(c => Object.assign(c, joint));
}

// S05: full eligible expenses, original denominator, split finality, counterclaim.
{
  const input = inputs.S05, s = input.stages[0];
  s.mainValueTarget = '피신청인측'; s.useIndividualValues = true;
  s.members.b1.value = '207070613'; s.members.b2.value = '207070613';
  s.members.b3.value = '186800000'; s.members.b3.valueType = '흡수';
  s.rules = [order(['a'], ['b1', 'b2', 'b3'], '2측 전부 부담')];
  s.costs[0].opponentMethod = '안분';
  const joint = { shared: true, ids: ['b1', 'b2'], method: '균분' };
  s.costs.push(expense('a', '인지대', 1540300, { opponentMethod: '안분' }), expense('a', '송달료', 96340, { opponentMethod: '균분' }), expense('b1', '변호사보수', 5500000, joint));
  const appeal = { ...clone(s), id: 'coverage-appeal', level: '항소심', value: '414141226',
    members: { a: {}, b1: { value: '207070613' }, b2: { value: '207070613' } },
    counter: '반소', counterValue: '482420000', counterFeeMode: '합산',
    rules: [order(['a'], ['b1', 'b2'], '비율로 분담', { n: '2', d: '5', scope: '소송총비용', claim: '본소와 반소' })],
    costs: [expense('a', '변호사보수', 15382806), expense('b1', '변호사보수', 15382806, joint), expense('b1', '인지대', 4989600, joint), expense('b1', '송달료', 11630, joint)] };
  input.stages.push(appeal);
}

// S06: both stages, actual membership changes, shared application expenses.
{
  const input = inputs.S06, s = input.stages[0];
  const appeal = { ...clone(s), id: 'coverage-appeal', level: '항소심', value: '160771300', counterValue: '55921428',
    members: { a1: { value: '96462800' }, a2: { value: '64308500' }, b: {} },
    costs: [expense('a1', '변호사보수', 6600000, { shared: true, ids: ['a1', 'a2'], method: '안분' })],
    rules: [order(['a1', 'a2'], ['b'], '1측 전부 부담', { claim: '본소', scope: '항소심 비용' }), order(['a1', 'a2'], ['b'], '2측 전부 부담', { claim: '반소', scope: '항소심 비용' })] };
  input.stages.push(appeal);
  input.applicationCosts.forEach(c => Object.assign(c, { shared: true, ids: ['a1', 'a2'], method: '균분' }));
}

// S07: restore the explicit main/counter values in first instance, keeping
// ancillary-appeal and supreme-court fee-basis judgment as staff-supplied inputs.
{
  const first = inputs.S07.stages[0];
  Object.assign(first, { value: '843528680', counter: '반소', counterValue: '396242161', counterFeeMode: '합산' });
}

const descriptions = {
  S01: { status: '합산·흡수 판단 후 계산 가능', title: '양측 개별 소가·공동보수·안분', note: '양측 가액을 입력하고 각 측 합산을 선택하면 신청인105355798원, 피신청인162505969원으로 각 공동보수 한도를 계산한다. 소가 대상 표시를 바꿔도 보수·안분 결과는 유지. 공동대리·중복/흡수 여부와 신청대리보수 산입은 담당자가 판단하며, 신청대리보수의 본안 한도 잔액 자동 검증은 이번 범위에 포함하지 않음.' },
  S02: { status: '계산 가능', title: '청구감축 후 전부 부담', note: '감축 후 인지 인정액은 담당자가 판단해 입력. 보수액은 PDF에 실제 총액이 없어 기재 인정액을 재현용 입력으로 사용.' },
  S03: { status: '계산 가능', title: '소액사건 최저 보수', note: '문자·송달 세부 항목은 비용명·금액으로 입력. 보수액은 기재 인정액을 재현용 입력으로 사용.' },
  S04: { status: '계산 가능', title: '1심·항소심 전부 부담', note: '심급별 비용과 전체 상환액 계산. 보수액은 기재 인정액을 재현용 입력으로 사용.' },
  S05: { status: '엔진 가능·폼 입력 미완', title: '일부 분리확정·복수 부담률', note: '엔진은1심 보수용 소가414141226원과 안분 분모600941226원, 항소심 합산896561226원을 처리한다. 다만 이번 엔진 검증에 사용한 개별 당사자 valueType=흡수는 폼에서 선택할 수 없다. 현재 폼의 전체 합산/다액흡수만으로는 일반 가액2개와 흡수 가액1개의 혼합을 그대로 입력하지 못함.' },
  S06: { status: '계산 가능', title: '본소·반소별 부담·공동 신청', note: '2심까지 보수와 신청외 몫을 포함. 반소 소가는 1쪽 표55921428원을 입력으로 채택했으며, 2쪽 산식의 다른 값은 오류 판정 근거로 사용하지 않음.' },
  S07: { status: '담당자 판단 후 계산 가능', title: '3심·신청비용 별도 비율', note: '1심 본소843528680+반소396242161 자동 합산. 항소·부대항소와 상고심의 산정 기초값은 담당자가 결정. 지급의무 포함 보수는 사용자 합의대로 한 금액14300000원 입력. 신청비용은1심 기준60%에 연결.' },
  S08: { status: '금액 계산 가능·관계 관리 미완', title: '다액흡수·승계인 신청', note: '본소·반소 다액흡수 한도와 상환액 계산 가능. 승계 전후 당사자·비용 귀속 연결을 자동 처리하는 구조는 없음.' },
  S09: { status: '담당자 정리 후 계산 가능', title: '신청외 분모·환송 전후 보수', note: '신청외2명을 포함한1/3 분모 유지. 환송 전후 항소심 보수를 담당자가1건으로 정리하고 항소 이후 주문을 심급별로 입력해야 함. 환송 이력·보수 그룹 자동 연결은 없음.' },
};

const results = [];
for (const [id, input] of Object.entries(inputs)) {
  const { parties, stages, applicationCosts } = input;
  const policy = { mode: '판결 기준', stageId: stages[id === 'S09' ? 1 : 0].id, ...(id === 'S06' ? { claim: '반소' } : {}) };
  const main = reviewCosts(stages, parties), application = reviewApplicationCosts(applicationCosts, parties, stages, policy);
  const checks = [];
  if (id === 'S01') {
    assert.deepEqual(main.errors, []);
    assert.deepEqual(application.errors, []);
    const alternate = clone(stages); alternate[0].mainValueTarget = '피신청인측';
    const changed = reviewCosts(alternate, parties);
    assert.deepEqual(changed.errors, []);
    assert.deepEqual(changed.lines.map(l => l.amount), main.lines.map(l => l.amount));
    const applicantBasis = resolveFeeBasisValue(alternate[0].costs[0], alternate[0], parties);
    const respondentBasis = resolveFeeBasisValue(alternate[0].costs[1], alternate[0], parties);
    assert.equal(applicantBasis, 105355798n); assert.equal(respondentBasis, 162505969n);
    checks.push({ check: '양측 합산 소가·표시 대상 변경 시 보수/안분 유지', passed: true, applicantBasis: String(applicantBasis), respondentBasis: String(respondentBasis) });
  } else {
    assert.deepEqual(main.errors, [], id + ' 본안');
    assert.deepEqual(application.errors, [], id + ' 신청비용');
  }
  if (id === 'S05') {
    assert.equal(resolveFeeBasisValue(stages[0].costs[0], stages[0], parties), 414141226n);
    assert.equal(resolveFeeBasisValue(stages[1].costs[0], stages[1], parties), 896561226n);
    const fee = main.lines.find(l => l.stage === '1심' && l.owner === 'a' && l.debtor === 'b1' && l.kind === '변호사보수');
    assert(factorIs(fee.steps[0], 207070613, 600941226));
    assert.match(fee.order, /항소심/);
    assert.match(main.lines.find(l => l.owner === 'a' && l.debtor === 'b3').order, /1심/);
    checks.push({ check: '보수 소가·안분 분모 분리와 부분 확정', passed: true, boundary: '엔진 검증. valueType=흡수의 개별 입력은 현재 폼에 없음.', engineOnlyInput: 'stages[0].members.b3.valueType=흡수' });
  }
  if (id === 'S06') {
    assert(main.lines.some(l => l.owner === 'ax' && l.stage === '1심'));
    assert(!main.lines.some(l => l.owner === 'ax' && l.stage === '항소심'));
    for (const owner of ['a1', 'a2']) assert.equal(money(sum(application.lines.filter(l => l.owner === owner))), '6,060원');
    checks.push({ check: '신청외 몫·심급 참여 변경·신청비용2인 균분', passed: true });
  }
  if (id === 'S07') {
    assert.equal(resolveFeeBasisValue(stages[0].costs[0], stages[0], parties), 1239770841n);
    assert.equal(money(sum(application.lines)), '7,480원');
    checks.push({ check: '본소·반소 자동 합산·신청비용60%·합의한 단계별 절사', passed: true });
  }
  const settlements = [];
  for (const a of parties.filter(p => p.group === '신청인')) for (const b of parties.filter(p => p.group === '피신청인')) {
    const forward = sum(main.lines.filter(l => l.owner === a.id && l.debtor === b.id));
    const reverse = sum(main.lines.filter(l => l.owner === b.id && l.debtor === a.id));
    const app = sum(application.lines.filter(l => l.owner === a.id && l.debtor === b.id));
    settlements.push({ applicant: a.id, respondent: b.id, forward: money(forward), reverse: money(reverse), application: money(app), combined: main.errors.length || application.errors.length ? null : money(add(subtract(forward, reverse), app)) });
  }
  results.push({ id, ...descriptions[id], input: { ...input, applicationPolicy: policy }, checks,
    mainErrors: main.errors, applicationErrors: application.errors, mainLines: main.lines, applicationLines: application.lines, settlements,
    settlementAssumption: '쌍방 비용 상계. 상대방 지출이 원본에 없으면0원으로 확인했다는 재현용 가정이며 실제 사실 판단이 아님.' });
}
const report = { generatedAt: new Date().toISOString(), assessment: '출력 레이아웃 제외. 각 샘플의 산입 비용을 포함해 계산 구조를 재점검. 엔진 실행과 폼 입력 가능성은 별도 구분.', policy: '본소·반소 배분→공동 귀속→상대방 배분→부담률의 각 단계10원 미만 버림. 원본과 금액 차이만으로 오류 판정하지 않음.',
  boundary: '인지액·산입 가능 비용·보수액·절차 범위의 판단은 담당자 입력을 전제로 한다. 법령·판례의 현행 효력 검증은 아님.', sourceHashes: source.sourceHashes, results };
fs.writeFileSync(path.join(__dirname, 'calculation-coverage.json'), JSON.stringify(report, (_, value) => typeof value === 'bigint' ? String(value) : value, 2) + '\n');
console.log(JSON.stringify(results.map(r => ({ id: r.id, status: r.status, mainErrors: r.mainErrors, applicationErrors: r.applicationErrors, checks: r.checks, settlements: r.settlements })), null, 2));
