const test=require('node:test');const assert=require('node:assert/strict');const load=require('./load-ts.cjs')();
const {blankDraft,parseDraft}=load('src/lib/litigation-costs-draft.ts');
const {addSetupParty,configureMainStages,updateCaseMeta}=load('src/lib/litigation-costs-basic-setup.ts');
const {applySimpleAllocation}=load('src/lib/litigation-costs-simple-allocation.ts');
const {calculateAllocation}=load('src/lib/litigation-costs-calculator.ts');
const {buildCostReport}=load('src/lib/litigation-costs-report.ts');
const input=require('../src/lib/fixtures/litigation-costs-basic-cases.json');
const oracle=require('../docs/examples/litigation-costs-basic-oracle.json');
function ok(r){assert.equal(r.ok,true,r.error);return r.draft;}
for(const c of input.cases) test(`${c.id}: fresh basic setup matches independent exact expectations and output`,()=>{
  let d=blankDraft(); const app=c.applicantRole==='원고'?'p':'d',other=app==='p'?'d':'p';
  for(const id of [app,other]) d=ok(addSetupParty(d,{id,name:id==='p'?'원고 A':'피고 B',mainRole:id==='p'?'원고':'피고',applicationRole:id===app?'신청인':'피신청인'},'main'));
  d=ok(configureMainStages(d,'제1심',['s1','app']));d=updateCaseMeta(d,{court:'합성 검증 법원',number:`검증-${c.id}`});d.stages[0].number=`본안-${c.id}`;
  d.claims[0].value=input.defaults.litigationValue;
  const [n,den]=c.share.map(BigInt),own=c.mode==='own';
  d.rulings=[{id:'order',text:own?'소송비용은 각자 부담한다.':'검증용: 명시한 비율로 비용을 부담한다.',stageIds:['s1'],claimIds:['main'],payerIds:[other],receiverIds:[app],numerator:own?'0':String(den-n),denominator:String(den),reverseNumerator:own?'0':String(n),reverseDenominator:String(den),status:'검토함'}];
  d.review.responseState='기간 내 제출';d.review.setoff='제112조 본문 적용 검토';d.calculation.rounding={unit:c.unit,timing:c.timing};d.calculation.setoff='mutual';
  for(const id of ['p','d']){
    const source={...input.defaults[id==='p'?'plaintiff':'defendant']};if(id==='p'&&c.plaintiffFee)source.fee=c.plaintiffFee;if(c.zero)Object.keys(source).forEach(k=>source[k]='0');
    for(const [kind,claimed,refund] of [['변호사보수',source.fee,'0'],['인지대',source.stamp,'0'],['송달료',source.servicePaid,source.serviceRefund]])d.costs.push({id:`${id}-${kind}`,title:`${id} ${kind}`,kind,stageId:'s1',payerIds:[id],claimIds:['main'],claimed,refund,recognized:kind==='변호사보수'?'':String(BigInt(claimed)-BigInt(refund)),...(kind==='변호사보수'?{attorneyFee:{schedule:'2020-12-28',treatment:'ordinary',litigationValue:input.defaults.litigationValue}}:{}),evidence:'합성 증빙',allocation:'미정',targetIds:[],reason:'',note:''});
  }
  const application=c.zero?'0':String(Object.values(input.defaults.application).reduce((s,v)=>s+BigInt(v),0n));
  d.costs.push({id:'application',title:'확정신청 비용',kind:'신청비용',stageId:'app',payerIds:[app],claimIds:[],claimed:application,refund:'0',recognized:application,evidence:'합성 증빙',allocation:'미정',targetIds:[],reason:'',note:''});
  for(const cost of d.costs)d=ok(applySimpleAllocation(d,cost.id,{rulingId:'order',applicationBasis:cost.stageId==='app'?'검증 가정: 신청비용에도 본안 부담 비율 적용':''},`node-${cost.id}`));
  const r=calculateAllocation(d),expected=oracle.cases.find(x=>x.id===c.id);assert.equal(r.status,'preview',r.errors.join('\n'));
  const row=r.rows[0];for(const key of ['forward','reverse','forwardRounded','reverseRounded','net'])assert.deepEqual(row[key],expected[key],key);
  assert.equal(row.net,c.expectedNet);assert.ok(r.budgets.every(b=>b.allocated.numerator===b.recognized&&b.allocated.denominator==='1'));
  assert.equal(buildCostReport(d).report.result.net,c.expectedNet);assert.deepEqual(calculateAllocation(parseDraft(JSON.stringify(d))),r);
});
