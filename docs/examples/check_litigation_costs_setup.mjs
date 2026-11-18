/* Regression for setup changes: no inferred submission, scope deletion, or global role overwrite. */
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const requireModule=createRequire(import.meta.url),{chromium}=requireModule('playwright'),load=requireModule('../../tests/load-ts.cjs')();
const{reportCaseDraft}=load('src/lib/litigation-costs-report-cases.ts');const{referenceCaseDraft}=load('src/lib/litigation-costs-case-library.ts');
const{calculateAllocation}=load('src/lib/litigation-costs-calculator.ts');
const out=process.env.SETUP_OUTPUT_DIR||'/workspace/courtai-research/basic-flow-2026-11-18';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'}),errors=[];
try{
 async function seed(d){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(d=>{if(!localStorage.getItem('courtai.litigation-costs.draft.v2'))localStorage.setItem('courtai.litigation-costs.draft.v2',JSON.stringify(d));},d);
  await page.goto(process.env.REPORT_APP_URL||'http://localhost:3000/litigation-costs');await page.getByRole('button',{name:'저장 초안 복원',exact:true}).click();
  const save=async()=>{await page.getByRole('button',{name:'브라우저에 초안 저장',exact:true}).first().click();return page.evaluate(()=>JSON.parse(localStorage.getItem('courtai.litigation-costs.draft.v2')));};
  await page.getByText('심급·당사자 추가 또는 변경',{exact:true}).click();
  const open=n=>page.getByRole('navigation',{name:'입력 목차'}).getByRole('link').nth(n).click();return{context,page,save,open,guide:page.getByTestId('guided-step1')};
 }
 const original=reportCaseDraft('R03'),a=await seed(original);
 assert.equal(await a.guide.getByRole('checkbox',{name:/상계|분리확정/}).count(),0);
 await a.guide.getByRole('radio',{name:'피고',exact:true}).check();
 let saved=await a.save();assert.deepEqual(saved.parties,original.parties);assert.deepEqual(saved.claims,original.claims);assert.deepEqual(saved.review,original.review);assert.deepEqual(saved.calculation,original.calculation);
 await a.open(3);assert.ok(await a.page.getByTestId('guided-step4-5').getByRole('button',{name:'피신청인 지출 비용',exact:true}).isEnabled());
 await a.open(4);await a.page.getByLabel('상대방 자료 제출',{exact:true}).selectOption('미확인');saved=await a.save();
 assert.equal(saved.calculation.setoff,'mutual');assert.equal(calculateAllocation(saved).rows[0].net,'562000');
 await a.page.getByLabel('상대방 자료 제출',{exact:true}).selectOption('기간 내 미제출');saved=await a.save();assert.equal(saved.calculation.setoff,'mutual');assert.equal(calculateAllocation(saved).status,'blocked');assert.equal(await a.page.getByTestId('calculated-results').count(),0);
 await a.page.getByLabel('상대방 자료 제출',{exact:true}).selectOption('기간 내 제출');assert.equal(calculateAllocation(await a.save()).rows[0].net,'562000');await a.context.close();
 console.log('PASS setup/default roles do not change existing claims or setoff; submission is independent; conflicting facts block instead of silently excluding costs');
 const higher=reportCaseDraft('F03'),b=await seed(higher);await b.guide.getByRole('radio',{name:'1심 사건 구성',exact:true}).click();
 assert.ok(await b.guide.getByRole('radio',{name:'상고심까지 구성',exact:true}).isChecked());assert.deepEqual(await b.save(),higher);assert.match(await b.guide.getByRole('status').innerText(),/변경하지 않았습니다/);await b.context.close();
 console.log('PASS attempted reduction keeps existing upper-stage data and truthful selection');
 const partial=referenceCaseDraft('B08'),c=await seed(partial);assert.equal(await c.guide.getByRole('checkbox',{name:/분리확정/}).count(),0);assert.deepEqual((await c.save()).stages,partial.stages);await c.context.close();
 const counter=referenceCaseDraft('S01'),d=await seed(counter);await d.page.getByRole('button',{name:'전체 펼치기',exact:true}).click();
 const toggle=d.guide.getByRole('checkbox',{name:/반소\(예비적 반소 포함\) 병합 사건/});await toggle.click();assert.ok(await toggle.isChecked());assert.deepEqual((await d.save()).claims,counter.claims);await d.context.close();
 console.log('PASS partial participation is not inferred from finality; referenced counterclaim stays visibly selected');
 // Enter defendant applicant from the empty form, then verify the optional counterclaim orientation.
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.REPORT_APP_URL||'http://localhost:3000/litigation-costs');const g=p.getByTestId('guided-step1');
 await g.getByText('심급·당사자 추가 또는 변경',{exact:true}).click();
 await g.getByRole('radio',{name:'피고',exact:true}).check();await g.getByRole('radio',{name:'1심 사건 구성',exact:true}).check();
 await g.getByRole('button',{name:'+ 신청인 추가',exact:true}).click();await g.getByRole('button',{name:'+ 피신청인 추가',exact:true}).click();
 await p.getByLabel('당사자 1 표시명',{exact:true}).fill('피고 B');await p.getByLabel('당사자 2 표시명',{exact:true}).fill('원고 A');
 await p.getByRole('button',{name:'전체 펼치기',exact:true}).click();await g.getByRole('checkbox',{name:/반소\(예비적 반소 포함\) 병합 사건/}).check();
 await p.getByRole('button',{name:'브라우저에 초안 저장',exact:true}).first().click();
 const data=await p.evaluate(()=>JSON.parse(localStorage.getItem('courtai.litigation-costs.draft.v2'))),app=data.parties.find(p=>p.applicationRole==='신청인'),other=data.parties.find(p=>p.applicationRole==='피신청인');
 assert.deepEqual(data.claims.find(c=>c.kind==='본소').opponentIds,[app.id]);assert.deepEqual(data.claims.find(c=>c.kind==='반소').claimantIds,[app.id]);assert.deepEqual(data.claims.find(c=>c.kind==='반소').opponentIds,[other.id]);
 const emptyToggle=g.getByRole('checkbox',{name:/반소\(예비적 반소 포함\) 병합 사건/});await emptyToggle.uncheck();assert.equal(await emptyToggle.isChecked(),false);
 assert.equal(await p.getByLabel('당사자 1 표시명',{exact:true}).count(),1);assert.equal(await p.getByRole('textbox',{name:/신청인.*성명/}).count(),0);
 await p.getByRole('button',{name:'전체 접기',exact:true}).click();await p.getByRole('navigation',{name:'입력 목차'}).getByRole('link').first().click();
 await p.screenshot({path:path.join(out,'setup-desktop.png'),fullPage:true});await p.setViewportSize({width:390,height:844});await p.waitForTimeout(350);
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:path.join(out,'setup-mobile.png'),fullPage:true});await context.close();
 assert.deepEqual(errors,[]);console.log('PASS defendant main/counterclaim links, one party editor, referenced/unreferenced toggles and responsive layout; no page errors');
}finally{await browser.close();}
