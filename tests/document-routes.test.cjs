const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const input={debtorInfo:{name:'Test',birthDate:'19900101'},creditors:[{id:'a',number:'1',name:'Bank',principal:100,interest:0}],
  repaymentPlan:{repaymentPeriod:{months:2,startDate:'2026-01-01',endDate:'2026-02-01'},monthlyActualAvailableIncome:100,createDate:'2025-12-20'}};
const params={params:Promise.resolve({id:'1'})};
const req=body=>new NextRequest('http://localhost/api/creditors/1/generate',{method:'POST',body:JSON.stringify(body)});
test('generation locks ownership, updates the case and freezes both documents in one transaction',async()=>{
  const calls=[];let transactions=0;
  const load=require('./load-ts.cjs')({'@/lib/auth':{getUserFromRequest:async()=>({id:1,role:'USER'})},
    '@/lib/db':{transaction:async work=>{transactions++;return work(async(sql,values)=>{
      calls.push({sql,values});
      if(sql.includes('SELECT id'))return {rows:[{id:1}]};
      if(sql.includes('SELECT source_snapshot'))return {rows:[]};
      if(sql.includes('RETURNING id'))return {rows:[{id:9}]};
      return {rows:[],rowCount:1};
    });}}});
  const route=load('src/app/api/creditors/[id]/generate/route.ts');
  const result=await route.POST(req({title:'Case',data:input}),params);
  assert.equal(result.status,200);assert.equal((await result.json()).documentId,9);
  assert.equal(transactions,1);
  assert.ok(calls[0].sql.includes('FOR UPDATE'));assert.deepEqual(calls[0].values,['1',1]);
  const inserted=calls.find(c=>c.sql.includes('INSERT INTO case_documents'));
  assert.ok(JSON.parse(inserted.values[4]).repaymentPlanHtml.includes('2025-12-20'));
  assert.equal(JSON.parse(inserted.values[2]).repaymentSchedule[1].total,0);
  const invalid=await route.POST(req({title:'Case',data:{}}),params);
  assert.equal(invalid.status,400);assert.equal(transactions,1);
});
test('document GET uses saved HTML and refuses a different owner',async()=>{
  let user={id:1,role:'USER'};
  const frozen={version:1,creditorListHtml:'<p>frozen creditor</p>',repaymentPlanHtml:'<p>frozen plan</p>'};
  const load=require('./load-ts.cjs')({'@/lib/auth':{getUserFromRequest:async()=>user},
    '@/lib/db':{query:async()=>({rows:[{id:1,user_id:1,title:'Case',source_snapshot:JSON.stringify(input),html_preview:JSON.stringify(frozen)}]})}});
  const route=load('src/app/api/documents/[id]/route.ts');
  const request=new NextRequest('http://localhost/api/documents/1');
  const response=await route.GET(request,params);const document=await response.json();
  assert.equal(document.html_preview,frozen.creditorListHtml);assert.equal(document.repayment_plan_html,frozen.repaymentPlanHtml);
  assert.equal(document.is_legacy,false);
  user={id:2,role:'USER'};assert.equal((await route.GET(request,params)).status,403);
  user=null;assert.equal((await route.GET(request,params)).status,401);
});
