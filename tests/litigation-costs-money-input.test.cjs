const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { sumMoneyInputs, netMoneyInput, allocationWeightInput } = load('src/lib/litigation-costs-money-input.ts');
const { calculateAttorneyFee, isAttorneyFeeInput } = load('src/lib/litigation-costs-attorney-fee.ts');
const { parseDraft } = load('src/lib/litigation-costs-draft.ts');
const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const { buildCostReport } = load('src/lib/litigation-costs-report.ts');
const fee = { schedule: '2020-12-28', treatment: 'ordinary', litigationValue: '50000000' };

test('quick totals reject every invalid component, unknown amount and unsafe aggregate', () => {
  for (const bad of ['', '-1', 'oops', '1.5', '1e5', '1,000', ' ', '9007199254740992']) {
    assert.equal(sumMoneyInputs(['900', bad, '5640']).status, 'blocked', bad);
  }
  assert.equal(sumMoneyInputs(['9007199254740991', '1']).status, 'blocked');
  assert.deepEqual(sumMoneyInputs(['0','0']), { status:'ready', amount:'0' });
  assert.deepEqual(sumMoneyInputs(['900','0','5640','0','0','0']), { status:'ready', amount:'6540' });
  assert.deepEqual(sumMoneyInputs(['9007199254740991']), { status:'ready', amount:'9007199254740991' });
});

test('optional fee items allow absent components while a completely empty breakdown stays unknown', () => {
  assert.deepEqual(sumMoneyInputs(['1000','','250'], true), {status:'ready',amount:'1250'});
  assert.equal(sumMoneyInputs(['','',''], true).status, 'blocked');
  assert.equal(sumMoneyInputs(['1000','oops',''], true).status, 'blocked');
  assert.deepEqual(sumMoneyInputs(['0','',''], true), {status:'ready',amount:'0'});
});

test('refunds and allocation exclusions never become zero through coercion or clamping', () => {
  for (const bad of ['', 'oops', '-1', '1.5', '9007199254740992', '1001']) assert.equal(netMoneyInput('1000',bad).status,'blocked');
  assert.deepEqual(netMoneyInput('1000','1000'), {status:'ready',amount:'0'});
  assert.deepEqual(netMoneyInput('1000','250'), {status:'ready',amount:'750'});
  assert.equal(allocationWeightInput('1000','','1001').status, 'blocked');
  assert.equal(allocationWeightInput('','','').status, 'blocked');
  assert.deepEqual(allocationWeightInput('1000','500','1500'), {status:'ready',amount:'0',gross:'1500'});
});

test('fee components are preserved, sum exactly and print their derivation without replacing existing notes', () => {
  const d = reportCaseDraft('F01'), c = d.costs[0], note = c.note;
  c.attorneyFee.components = {retainer:'1000000',paidSuccess:'500000',promisedSuccess:'750000'};
  c.claimed = '2250000';
  const result = calculateAttorneyFee(c.attorneyFee,c.claimed,c.refund);
  assert.equal(result.status,'ready'); assert.equal(result.calculation.recognized,'2250000');
  assert.ok(result.calculation.formula.some(f=>f.includes('실비 세부내역') && f.includes('750,000')));
  const restored = parseDraft(JSON.stringify(d)); assert.deepEqual(restored.costs[0].attorneyFee,c.attorneyFee);
  assert.equal(restored.costs[0].note,note);
  assert.equal(calculateAllocation(restored).rows[0].net,'2257000');
  assert.equal(buildCostReport(restored).status,'preview');
});

test('invalid or cleared fee parts block calculations and reports rather than retain a stale total', () => {
  for (const components of [
    {retainer:'',paidSuccess:'',promisedSuccess:''},
    {retainer:'1000',paidSuccess:'oops',promisedSuccess:''},
    {retainer:'9007199254740991',paidSuccess:'1',promisedSuccess:''},
    {retainer:'1000',paidSuccess:'500',promisedSuccess:'0'},
  ]) {
    const d = reportCaseDraft('F01'); d.costs[0].attorneyFee.components = components;
    // An old claimed amount cannot bypass component validation.
    const r = calculateAllocation(d); assert.equal(r.status,'blocked'); assert.deepEqual(r.rows,[]);
    assert.equal(buildCostReport(d).status,'blocked');
  }
  const zero = { ...fee, components:{retainer:'0',paidSuccess:'',promisedSuccess:''} };
  assert.equal(calculateAttorneyFee(zero,'0').calculation.recognized,'0');
  assert.equal(calculateAttorneyFee({...fee,components:{retainer:'1000',paidSuccess:'',promisedSuccess:''}},'0001000').status,'ready');
});

test('optional structured fee parts retain legacy drafts and reject malformed stored structures', () => {
  assert.equal(isAttorneyFeeInput(fee),true);
  for(const components of [null,[],{}, {retainer:1,paidSuccess:'',promisedSuccess:''}]) {
    assert.equal(isAttorneyFeeInput({...fee,components}),false);
    const d=reportCaseDraft('F01'); d.costs[0].attorneyFee.components=components;
    assert.throws(()=>parseDraft(JSON.stringify(d)));
  }
  assert.deepEqual(parseDraft(JSON.stringify(reportCaseDraft('R01'))),reportCaseDraft('R01'));
});
