/* Negative and round-trip UI regression using isolated synthetic cases only. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const requireModule = createRequire(import.meta.url);
const { chromium } = requireModule('playwright');
const load = requireModule('../../tests/load-ts.cjs')();
const { referenceCaseDraft } = load('src/lib/litigation-costs-case-library.ts');
const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
const key = 'courtai.litigation-costs.draft.v2';
const out = process.env.GUIDED_VALIDATION_OUTPUT_DIR || '/workspace/courtai-research/validation-2026-11-18';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless:true, executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
const errors = [], checks = [];
try {
  async function seeded(draft) {
    const context = await browser.newContext({ viewport:{width:1440,height:1000}, reducedMotion:'reduce' });
    const page = await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(({key,draft})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(draft));},{key,draft});
    await page.goto(process.env.REPORT_APP_URL || 'http://localhost:3000/litigation-costs');
    await page.getByRole('button',{name:'저장 초안 복원',exact:true}).click();
    await page.getByRole('button',{name:'전체 펼치기',exact:true}).click();
    const snapshot = async()=>{await page.getByRole('button',{name:'브라우저에 초안 저장',exact:true}).first().click();return page.evaluate(key=>JSON.parse(localStorage.getItem(key)),key);};
    return {context,page,snapshot};
  }
  const first=reportCaseDraft('F01'), a=await seeded(first), guide=a.page.getByTestId('guided-step4-5');
  await guide.getByLabel('최초 납부 송달료 (원)',{exact:true}).fill('1000');
  for(const bad of ['oops','','-1','1001','1.5','9007199254740992']) {
    await guide.getByLabel('환급 송달료 (원)',{exact:true}).fill(bad);
    await guide.getByRole('button',{name:/^\+ 송달료 추가/}).first().click();
    assert.equal((await a.snapshot()).costs.length,first.costs.length,bad);
  }
  await guide.getByLabel('환급 송달료 (원)',{exact:true}).fill('250');
  await guide.getByRole('button',{name:/^\+ 송달료 추가/}).first().click();
  const expense=(await a.snapshot()).costs.at(-1);
  assert.equal(expense.claimed,'1000');assert.equal(expense.refund,'250');assert.equal(expense.recognized,'750');
  const app=guide.getByTestId('guided-step5');
  for(const bad of ['oops','','-1','1.5','9007199254740991']) {
    const before=await a.snapshot(); await app.getByLabel('5-1. SMS 발송료 (원)',{exact:true}).fill(bad);
    assert.ok(await app.getByRole('button',{name:/확정신청 비용 반영/}).isDisabled());
    assert.deepEqual((await a.snapshot()).costs,before.costs);
  }
  await app.getByLabel('5-1. SMS 발송료 (원)',{exact:true}).fill('0');
  await app.getByRole('button',{name:/확정신청 비용 반영/}).click();
  assert.equal((await a.snapshot()).costs.find(c=>c.stageId==='app').recognized,'6540');
  await a.context.close();checks.push('invalid refunds/app fields and unsafe totals block; valid refunds subtract once');

  const b=await seeded(reportCaseDraft('F01')), editor=b.page.locator('[data-attorney-cost]').first();
  const field=label=>editor.getByLabel(label,{exact:true});
  await field('착수금 실제 지급액 (원)').fill('1,000,000');
  await field('기지급 성공보수액 (원)').fill('500000');
  await field('지급 예정 성공보수 약정액 (원)').fill('750000');
  const saved=await b.snapshot(); assert.equal(saved.costs[0].claimed,'2250000');
  assert.equal(saved.costs[0].note,first.costs[0].note);
  await b.page.reload();await b.page.getByRole('button',{name:'저장 초안 복원',exact:true}).click();
  await b.page.getByRole('button',{name:'전체 펼치기',exact:true}).click();
  assert.equal(await field('착수금 실제 지급액 (원)').inputValue(),'1000000');
  assert.equal(await field('기지급 성공보수액 (원)').inputValue(),'500000');
  assert.equal(await field('지급 예정 성공보수 약정액 (원)').inputValue(),'750000');
  await b.page.getByRole('button',{name:/^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/}).click();
  const frame=b.page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]');
  await frame.getByTestId('report-result').waitFor();assert.match(await frame.getByTestId('report-result').innerText(),/2,257,000원/);
  const html=await b.page.locator('iframe').getAttribute('srcdoc');
  const paper=await b.context.newPage();await paper.setContent(html);await paper.evaluate(()=>document.fonts.ready);
  const pdf=path.join(out,'fee-components-restored.pdf');await paper.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});await paper.close();
  const pdfText=execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}).replace(/\s+/g,'');
  assert.ok(pdfText.includes('2,257,000원')&&pdfText.includes('750,000')&&pdfText.includes('실비세부내역'));
  await field('기지급 성공보수액 (원)').fill('oops');
  assert.equal(await b.page.locator('iframe').count(),0);assert.equal(await b.page.getByTestId('calculated-results').count(),0);
  await field('착수금 실제 지급액 (원)').fill('');await field('기지급 성공보수액 (원)').fill('');await field('지급 예정 성공보수 약정액 (원)').fill('');
  assert.equal((await b.snapshot()).costs[0].claimed,'');assert.equal(await b.page.getByTestId('calculated-results').count(),0);
  await field('착수금 실제 지급액 (원)').fill('0');assert.match(await b.page.getByTestId('calculated-results').innerText(),/7,000원/);
  await field('변호사보수 실비 (원)').fill('3300000');
  assert.equal((await b.snapshot()).costs[0].attorneyFee.components,undefined);
  assert.match(await b.page.getByTestId('calculated-results').innerText(),/3,307,000원/);
  await b.page.setViewportSize({width:390,height:844});await b.page.waitForTimeout(350);await editor.scrollIntoViewIfNeeded();
  assert.ok(await b.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await b.page.screenshot({path:path.join(out,'components-mobile.png')});
  await b.context.close();checks.push('fee parts persist/restore, invalid/cleared parts block, explicit zero valid, direct total resets parts, PDF exact');

  const c=await seeded(reportCaseDraft('F03')), values=c.page.getByTestId('guided-step2');
  const originalFees=(await c.snapshot()).costs.map(c=>c.attorneyFee);
  for(const bad of ['','oops','9007199254740992']) {
    await values.getByLabel('본소 소가 (원)',{exact:true}).fill(bad);
    await values.getByRole('button',{name:'선택 심급 변호사보수 소가에 반영',exact:true}).click();
    assert.deepEqual((await c.snapshot()).costs.map(c=>c.attorneyFee),originalFees);
  }
  await c.context.close();checks.push('unknown/invalid claim values never become a 0-won fee basis');

  const multi=reportCaseDraft('F03');const extra={id:'p2',name:'원고 C',mainRole:'원고',applicationRole:'피신청인'};
  multi.parties.push(extra);multi.claims[0].claimantIds.push(extra.id);multi.stages.forEach(s=>s.partyIds.push(extra.id));
  multi.calculation.values=[];
  for(const [stageId,offset] of [['s1',0],['s2',3]]) multi.parties.forEach((p,i)=>multi.calculation.values.push({id:`${stageId}-${p.id}`,label:'검증 가액',stageId,claimId:'main',partyId:p.id,opponentId:'',purpose:'배분 가중치',kind:'청구',amount:String((i+1+offset)*1000)}));
  const e=await seeded(multi), matrix=e.page.getByTestId('guided-step2');
  const primary=matrix.getByLabel(`${multi.parties[0].name} 주위적청구 소가`,{exact:true});
  assert.equal(await primary.inputValue(),'1000');
  await matrix.getByRole('button',{name:/^항소심/}).click();assert.equal(await primary.inputValue(),'4000');
  await matrix.getByRole('button',{name:/^제1심/}).click();assert.equal(await primary.inputValue(),'1000');
  await primary.fill('0');await matrix.getByRole('button',{name:/배분 가중치 가액에 일괄 적용/}).click();
  assert.equal((await e.snapshot()).calculation.values.find(v=>v.id===`s1-${multi.parties[0].id}`).amount,'0');
  const beforeInvalid=(await e.snapshot()).calculation.values;
  await matrix.getByLabel(`${multi.parties[0].name} 흡수 제외 소가`,{exact:true}).fill('1');
  await matrix.getByRole('button',{name:/배분 가중치 가액에 일괄 적용/}).click();
  assert.deepEqual((await e.snapshot()).calculation.values,beforeInvalid);
  await e.context.close();checks.push('stage matrices stay separate, explicit zero replaces previous weight, over-exclusion is blocked');

  const staged=reportCaseDraft('F03');staged.rulings=[{...staged.rulings[0],stageIds:['s1','s2','s3']}];
  for (const plan of staged.calculation.plans) {
    const setRule = node => { if (node.type === 'pair') node.rulingId=staged.rulings[0].id; else node.branches.forEach(b=>setRule(b.node)); };
    setRule(plan.root);
  }
  const f=await seeded(staged), ruling=f.page.getByTestId('guided-step3');
  assert.match(await f.page.getByTestId('calculated-results').innerText(),/10,797,083원/);
  await ruling.getByLabel('3-1. 적용 심급 범위',{exact:true}).selectOption('s2');
  await ruling.getByRole('button',{name:'부담 비율 설정 반영',exact:true}).click();
  assert.deepEqual((await f.snapshot()).rulings,staged.rulings);
  assert.deepEqual((await f.snapshot()).calculation.plans,staged.calculation.plans);
  await f.context.close();checks.push('narrow guided order edits preserve existing other-stage rulings and references');
  const counter=referenceCaseDraft('S01'), g=await seeded(counter);
  await g.page.getByTestId('guided-step3').getByRole('button',{name:'부담 비율 설정 반영',exact:true}).click();
  assert.deepEqual((await g.snapshot()).rulings,counter.rulings);
  assert.deepEqual((await g.snapshot()).calculation.plans,counter.calculation.plans);
  await g.context.close();checks.push('existing main/counterclaim rulings and linked plans survive attempted bulk replacement');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'guided-results.json'),JSON.stringify({checks,pageErrors:errors},null,2)+'\n');
  checks.forEach(c=>console.log('PASS '+c));
} finally { await browser.close(); }
