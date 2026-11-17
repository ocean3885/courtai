const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { buildCostReport, renderCostReport, reportResultText } = load('src/lib/litigation-costs-report.ts');
const { reportValidationCases, reportCaseDraft, matchesReportCase } = load('src/lib/litigation-costs-report-cases.ts');
const { referenceCaseDraft } = load('src/lib/litigation-costs-case-library.ts');
const { parseDraft } = load('src/lib/litigation-costs-draft.ts');
const timestamp = '2026-11-17T05:00:00.000Z';
function report(d) { const r = buildCostReport(d, timestamp); assert.equal(r.status, 'preview', r.errors.join()); return r.report; }
function blocked(d, regex) { const r = buildCostReport(d, timestamp); assert.equal(r.status, 'blocked'); assert.equal(r.report, null); assert.match(r.errors.join(), regex); }
for (const entry of reportValidationCases) {
  test(`${entry.id}: ${entry.title} has the independently specified amounts in the rendered report`, () => {
    const d = reportCaseDraft(entry.id), r = report(d), expected = entry.expected;
    assert.deepEqual(parseDraft(JSON.stringify(d)), d); assert.ok(matchesReportCase(d));
    assert.equal(r.result.net, expected.net);
    assert.equal(BigInt(r.result.forward.numerator), BigInt(expected.forward) * BigInt(r.result.forward.denominator));
    assert.equal(BigInt(r.result.reverse.numerator), BigInt(expected.reverse) * BigInt(r.result.reverse.denominator));
    assert.equal(r.phases.flatMap(p => p.rows).length, d.costs.length);
    const html = renderCostReport(r);
    assert.ok(html.includes('소송비용계산서') && html.includes('검토용 초안'));
    assert.ok(html.includes('1. 총 소송비용') && html.includes('2. 부담액과 상계') && html.includes('3. 상계 후 계산 결과'));
    assert.ok(html.includes(BigInt(expected.amount).toLocaleString('ko-KR') + '원'));
    if (expected.debtorId) {
      const text = reportResultText(r), debtor = d.parties.find(p => p.id === expected.debtorId).name, creditor = d.parties.find(p => p.id === expected.creditorId).name;
      assert.ok(text.indexOf(debtor) < text.indexOf(creditor), text);
    } else assert.equal(reportResultText(r), '상계 후 상환 차액 없음 (0원)');
  });
}

test('recognized amounts, refunds and all stage totals stay consistent without another refund subtraction', () => {
  const d = reportCaseDraft('R01');
  const cost = d.costs.find(c => c.kind === '송달료' && c.stageId === 's1');
  cost.refund = '5000'; cost.recognized = '5000';
  const r = report(d);
  assert.equal(r.mainApplicantCosts, '1055000'); assert.equal(r.totalApplicantCosts, '1062000'); assert.equal(r.result.net, '1062000');
  const row = r.phases.flatMap(p => p.rows).find(c => c.id === cost.id);
  assert.ok(row.notes.some(n => n.includes('환급 5,000원') && n.includes('인정 5,000원')));
});

test('inverse difference is clearly labeled and each-own-costs is a genuine zero', () => {
  const reverse = renderCostReport(report(reportCaseDraft('R04')));
  assert.ok(reverse.includes('계산상 역방향 차액: 신청인 원고 A → 피신청인 피고 B 347,000원'));
  assert.ok(reverse.includes('역방향 차액의 절차상 처리·신청 범위는 별도로 검토'));
  const zero = report(reportCaseDraft('R05'));
  assert.equal(zero.totalApplicantCosts, '200000'); assert.equal(zero.totalRespondentCosts, '100000');
  assert.equal(zero.phases.find(p => p.type === '확정신청').rows[0].recognized, '0');
});

test('rounding timing changes the report ten won and retains both exact directional totals', () => {
  const d = reportCaseDraft('R06');
  assert.equal(report(d).result.net, '56660');
  d.calculation.rounding.timing = 'direction';
  const r = report(d); assert.equal(r.result.net, '56670');
  assert.equal(r.result.forwardRounded, '66670'); assert.equal(r.result.reverseRounded, '10000');
  assert.ok(renderCostReport(r).includes('각 방향 절사 후 66,670원 − 10,000원'));
  assert.ok(!matchesReportCase(d));
});

test('an output snapshot preserves earlier input, names and HTML after the working draft changes', () => {
  const d = reportCaseDraft('R01'), r = report(d), html = renderCostReport(r);
  d.parties[0].name = '변경된 이름'; d.costs[0].recognized = '0'; d.rulings[0].text = '변경된 주문';
  assert.equal(renderCostReport(r), html); assert.equal(r.inputSnapshot.parties[0].name, '원고 A');
  assert.notEqual(renderCostReport(report(d)), html);
});

test('unknown amounts, missing application costs and missing display metadata cannot produce a report', () => {
  const unknown = reportCaseDraft('R01'); unknown.costs[0].recognized = ''; blocked(unknown, /직원 인정액/);
  const missing = reportCaseDraft('R01'); missing.costs = missing.costs.filter(c => c.stageId !== 'app'); missing.calculation.plans = missing.calculation.plans.filter(p => missing.costs.some(c => c.id === p.costId)); blocked(missing, /인정액 0원/);
  const unnamed = reportCaseDraft('R01'); unnamed.meta.number = ''; blocked(unnamed, /법원·사건번호·당사자명/);
  const malformed = reportCaseDraft('R01'); malformed.calculation = {}; blocked(malformed, /형식/);
});

test('the first output never drops multiple parties, counterclaims, or unsupported allocations', () => {
  blocked(referenceCaseDraft('B04'), /원고 1명·피고 1명/);
  blocked(referenceCaseDraft('S01'), /반소/);
  blocked(referenceCaseDraft('S05'), /복수·연대/);
  blocked(referenceCaseDraft('S06'), /신청 대상 외/);
  const remand = reportCaseDraft('R07'); remand.stages[1].type = '환송심'; blocked(remand, /환송/);
  assert.equal(report(referenceCaseDraft('B01')).result.net, '3366304');
  const fractionReport = report(referenceCaseDraft('B03'));
  assert.equal(fractionReport.result.net, '3047119');
  assert.ok(renderCostReport(fractionReport).includes('중간 금액의 소수는 참고 표시입니다.'));
});

test('non-submission expenses remain in the report and unknown respondent amounts are not treated as zero', () => {
  const d = reportCaseDraft('R03'); d.review.responseState = '기간 내 미제출'; blocked(d, /충돌/);
  d.calculation.setoff = 'applicantOnly';
  const r = report(d); assert.equal(r.result.net, '687000'); assert.equal(r.totalRespondentCosts, '500000');
  assert.ok(r.phases.flatMap(p => p.rows).some(c => c.ownerId === 'd' && c.excluded));
  assert.ok(renderCostReport(r).includes('상계 미반영'));
  const missing = reportCaseDraft('R03'); missing.costs = missing.costs.filter(c => !c.payerIds.includes('d')); missing.calculation.plans = missing.calculation.plans.filter(p => missing.costs.some(c => c.id === p.costId));
  blocked(missing, /피신청인 비용이 미등록/);
  missing.rulings[0].reverseNumerator = '0';
  assert.equal(report(missing).result.net, '687000'); // do not infer reverse burden as 1-forward
});

test('user-supplied markup is escaped in names, orders, metadata, notes and attribute values', () => {
  const d = reportCaseDraft('R01'), attack = '\"><img src=x onerror="alert(1)"><script>window.pwned=1</script>';
  d.meta.number = attack; d.meta.court = attack; d.parties[0].name = attack; d.rulings[0].text = attack;
  d.costs[0].id = attack; d.calculation.plans[0].costId = attack;
  d.costs[0].title = attack; d.costs[0].reason = attack; d.costs[0].evidence = attack;
  const html = renderCostReport(report(d));
  assert.ok(!html.includes('<script>')); assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;script&gt;') && html.includes('data-cost-id="&quot;&gt;&lt;img'));
  assert.ok(html.includes("default-src 'none'"));
});
