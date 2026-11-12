const { test } = require('node:test');
const assert = require('node:assert/strict');
const load = require('./load-ts.cjs')();
const { createDocumentSnapshot, readRenderedDocuments } = load('src/lib/document-snapshot.ts');
const { generateDocumentHTML } = load('src/lib/document-service.ts');
const { generateRepaymentPlanHTML } = load('src/lib/repayment-plan-service.ts');
const { validateCase } = load('src/lib/case-validation.ts');
function input(){return {debtorInfo:{name:'Test',birthDate:'19900101'},creditors:[{id:'a',number:'1',name:'Bank',principal:100,interest:0}],
  repaymentPlan:{repaymentPeriod:{months:2,startDate:'2026-01-01',endDate:'2026-02-01'},monthlyActualAvailableIncome:100,createDate:'2025-12-20'}};}
test('HTML escapes names, addresses, titles, income JSON and attribute-breaking characters', () => {
  const data=input();const attack='<img src=x onerror="alert(1)">';
  data.debtorInfo.name=attack;data.creditors[0].name=attack;data.creditors[0].address=attack;
  data.repaymentPlan.incomeType='wageAndBusiness';
  data.repaymentPlan.companyName='Employer, Business';
  data.repaymentPlan.monthlyIncomeDetails=JSON.stringify({wage:{name:attack,amount:100},business:{name:attack,amount:100}});
  for(const html of [generateDocumentHTML(attack,data),generateRepaymentPlanHTML(data)]){
    assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('&quot;'));
  }
  assert.equal(data.creditors[0].name,attack);
});
test('frozen renderings retain exact dates and amounts after the case changes', () => {
  const data=input();const generated=createDocumentSnapshot('Case',data);
  const stored=JSON.stringify(generated.rendered);
  data.creditors[0].principal=999;
  const frozen=readRenderedDocuments(stored);
  assert.deepEqual(frozen,generated.rendered);
  assert.ok(frozen.creditorListHtml.includes('2025-12-20'));
  assert.ok(frozen.repaymentPlanHtml.includes('2025-12-20'));
  assert.equal(generated.snapshot.creditors[0].principal,100);
  assert.deepEqual(generated.snapshot.repaymentSchedule.map(r=>r.total),[100,0]);
  assert.equal(readRenderedDocuments('<script>old unsafe HTML</script>'),null);
});
test('case validation rejects impossible birth dates, negative money and incomplete generation', () => {
  validateCase('Case',input(),true);
  const invalid=input();invalid.debtorInfo.birthDate='19900230';assert.throws(()=>validateCase('Case',invalid));
  const negative=input();negative.creditors[0].principal=-1;assert.throws(()=>validateCase('Case',negative));
  const incomplete=input();incomplete.repaymentPlan.repaymentPeriod.startDate='';assert.throws(()=>validateCase('Case',incomplete,true));
});
