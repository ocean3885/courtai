const test = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { calculateAttorneyFee, getCostRecognition } = load('src/lib/litigation-costs-attorney-fee.ts');
const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
const { calculateAllocation } = load('src/lib/litigation-costs-calculator.ts');
const { buildCostReport, renderCostReport } = load('src/lib/litigation-costs-report.ts');
const { parseDraft, reviewDraft } = load('src/lib/litigation-costs-draft.ts');
const oracle = require('../docs/examples/litigation-costs-attorney-fee-oracle.json');
const examples = require('../src/lib/fixtures/litigation-costs-attorney-fee-cases.json');
const input = (value, treatment='ordinary') => ({schedule:'2020-12-28',treatment,litigationValue:String(value)});
function fee(value, paid='9007199254740991', treatment='ordinary', refund='0') { const r=calculateAttorneyFee(input(value,treatment),String(paid),refund);assert.equal(r.status,'ready',r.errors?.join());return r.calculation; }
for (const [value, expected] of [[3000000,300000],[20000000,2000000],[50000000,4400000],[100000000,7400000],[150000000,9400000],[200000000,10400000],[500000000,13400000],[1000000000,15900000]]) {
  test(`2020 fee band at ${value} won has standard amount ${expected}`,()=>assert.equal(fee(value).recognized,String(expected)));
}
test('all threshold neighbors, maximum safe amount, refunds and half rules match an independent marginal Fraction oracle',()=>{
 for(const c of oracle.rows){const r=calculateAttorneyFee(c.input,c.paid,c.refund);assert.equal(r.status,'ready');for(const [k,v] of Object.entries(c.expected))assert.deepEqual(r.calculation[k],v,`${JSON.stringify(c.input)}: ${k}`);}
});
test('the actual amount caps recognized fees and the half rule reduces the table amount before the actual-fee comparison',()=>{
 assert.equal(fee(50000000,10000000).recognized,'4400000'); assert.equal(fee(50000000,3300000).recognized,'3300000');
 assert.equal(fee(50000000,1000000,'half').recognized,'1000000'); assert.equal(fee(50000000,10000000,'half').recognized,'2200000');
 assert.equal(fee(50000000,5000000,'ordinary','2000000').recognized,'3000000'); assert.equal(fee(50000000,0).recognized,'0');
});
test('empty, negative, fractional, excessive and unsupported inputs block instead of assuming zero or another rule version',()=>{
 for(const [v,p,r] of [['','100','0'],['-1','100','0'],['1.5','100','0'],['9007199254740992','100','0'],['50000000','','0'],['50000000','3.5','0'],['50000000','100','101']])assert.equal(calculateAttorneyFee(input(v),p,r).status,'blocked');
 assert.equal(calculateAttorneyFee(input(50000000),10000000).status,'blocked');
 assert.equal(calculateAttorneyFee({...input(50000000),schedule:'2013'},'100').status,'blocked');
 assert.equal(calculateAttorneyFee({...input(50000000),treatment:'other'},'100').status,'blocked');
});
for(const c of examples){
 test(`${c.id}: automatic fee amounts reach allocation and printed formulas with no stale manual amount`,()=>{
  const d=reportCaseDraft(c.id); d.costs.filter(x=>x.attorneyFee).forEach(x=>x.recognized='999999999');
  const r=calculateAllocation(d);assert.equal(r.status,'preview',r.errors.join());assert.equal(r.rows[0].net,c.expected.net);
  assert.equal(r.attorneyFees.length,c.fees.length);
  for(const expected of c.fees){const cost=d.costs.find(x=>x.stageId===expected.stageId&&x.attorneyFee);const budget=r.budgets.find(b=>b.costId===cost.id);assert.equal(budget.recognized,expected.recognized);assert.ok(r.traces.filter(t=>t.costId===cost.id).every(t=>t.recognized===expected.recognized&&t.basisValue===expected.litigationValue));}
  const built=buildCostReport(d,'2026-11-17T05:00:00Z');assert.equal(built.status,'preview',built.errors.join());
  const html=renderCostReport(built.report);assert.ok(html.includes('산입액 = min('));assert.ok(html.includes('별표(2020.12.28.)'));assert.ok(!html.includes('999,999,999'));assert.ok(!html.includes('한도 자동 산정 아님'));
  assert.equal(built.report.result.net,c.expected.net);
 });
}
test('value and actual-fee changes immediately recalculate, while legacy manual amounts remain unchanged',()=>{
 const d=reportCaseDraft('F01');const c=d.costs.find(c=>c.attorneyFee);
 c.attorneyFee.litigationValue='100000000';assert.equal(calculateAllocation(d).rows[0].net,'7407000');
 c.claimed='3000000';assert.equal(calculateAllocation(d).rows[0].net,'3007000');
 c.recognized='123';delete c.attorneyFee;assert.equal(getCostRecognition(c).recognized,'123');
 const legacy=reportCaseDraft('R01');assert.equal(calculateAllocation(parseDraft(JSON.stringify(legacy))).rows[0].net,'1067000');
});
test('claimant and respondent fee caps are applied before the burden ratios and setoff',()=>{
 const d=reportCaseDraft('R03');
 d.costs.filter(c=>c.kind==='변호사보수').forEach(c=>{c.attorneyFee=input(50000000);c.claimed=c.payerIds[0]==='p'?'10000000':'3000000';});
 const r=calculateAllocation(d);assert.equal(r.status,'preview');assert.equal(r.rows[0].net,'2562000'); // (4,400,000+10,000+6,000)*3/4 - 3,000,000*1/4
});
test('invalid automatic fee data clears monetary results and restores safely through version-2 storage',()=>{
 const d=reportCaseDraft('F01');assert.deepEqual(parseDraft(JSON.stringify(d)),d);
 const c=d.costs.find(c=>c.attorneyFee);c.attorneyFee.litigationValue='';const r=calculateAllocation(d);assert.equal(r.status,'blocked');assert.deepEqual(r.rows,[]);assert.deepEqual(r.attorneyFees,[]);assert.ok(reviewDraft(d).some(i=>i.message.includes('심급별 보수 산정 소가')));
 c.attorneyFee.litigationValue='50000000';c.attorneyFee.schedule='future';assert.throws(()=>parseDraft(JSON.stringify(d)));
});
test('automatic fees are confined to main trial stages and unsupported cost kinds fail explicitly',()=>{
 const d=reportCaseDraft('F01'),c=d.costs.find(c=>c.attorneyFee);c.stageId='app';assert.equal(calculateAllocation(d).status,'blocked');
 c.stageId='s1';c.kind='인지대';assert.equal(calculateAllocation(d).status,'blocked');
});

test('overlapping fees cannot each receive an automatic cap in the same stage',()=>{
 const d=reportCaseDraft('F01'),first=d.costs.find(c=>c.attorneyFee);
 const second={...first,id:'second-fee',title:'두 번째 변호사 보수'};d.costs.push(second);
 const r=calculateAllocation(d);assert.equal(r.status,'blocked');assert.deepEqual(r.rows,[]);assert.ok(r.errors.some(e=>e.includes('중복 적용')));
 delete second.attorneyFee;second.recognized='1000000';assert.equal(calculateAllocation(d).status,'blocked');
 assert.ok(reviewDraft(d).some(i=>i.message.includes('중복 적용')));
});
