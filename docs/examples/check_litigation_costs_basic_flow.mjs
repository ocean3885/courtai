/* Enter every case from the empty form: no fixture draft or localStorage seeding. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const requireModule=createRequire(import.meta.url), {chromium}=requireModule('playwright');
const load=requireModule('../../tests/load-ts.cjs')();
const {calculateAllocation}=load('src/lib/litigation-costs-calculator.ts');
const config=JSON.parse(fs.readFileSync(new URL('../../src/lib/fixtures/litigation-costs-basic-cases.json',import.meta.url)));
const oracle=JSON.parse(fs.readFileSync(new URL('./litigation-costs-basic-oracle.json',import.meta.url)));
const out=process.env.BASIC_FLOW_OUTPUT_DIR||'/workspace/courtai-research/basic-flow-2026-11-18';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium'});
const records=[],errors=[];
const compact=s=>s.replace(/\s+/g,'');
try{
 const selected=process.env.BASIC_CASE_IDS?.split(',');
 for(const c of config.cases.filter(c=>!selected||selected.includes(c.id))){
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(`${c.id}: ${e.message}`));
  await page.goto(process.env.REPORT_APP_URL||'http://localhost:3000/litigation-costs');
  const open=n=>page.getByRole('navigation',{name:'입력 목차'}).getByRole('link').nth(n).click();
  const save=async()=>{await page.getByRole('button',{name:'브라우저에 초안 저장',exact:true}).first().click();return page.evaluate(()=>JSON.parse(localStorage.getItem('courtai.litigation-costs.draft.v2')));};
  await page.getByLabel('신청 법원',{exact:true}).fill('합성 검증 법원');
  await page.getByLabel('확정신청 사건번호',{exact:true}).fill(`검증-${c.id}-카확`);
  const setup=page.getByTestId('guided-step1');
  await setup.getByRole('button',{name:c.applicantRole+'가 신청',exact:true}).click();
  const appName=c.applicantRole==='원고'?'원고 A':'피고 B',otherName=c.applicantRole==='원고'?'피고 B':'원고 A';
  await page.getByLabel('당사자 1 표시명',{exact:true}).fill(appName);await page.getByLabel('당사자 2 표시명',{exact:true}).fill(otherName);
  assert.equal(await setup.getByRole('checkbox',{name:/상계/}).count(),0);
  await open(1);await page.getByLabel('본안·절차 사건번호',{exact:true}).first().fill(`검증-${c.id}-가단`);
  assert.equal(await page.getByLabel('본안·절차 사건번호',{exact:true}).nth(1).inputValue(),`검증-${c.id}-카확`);
  await page.getByTestId('guided-step2').getByLabel('본소 소가 (원)',{exact:true}).fill(config.defaults.litigationValue);
  await open(2);const ruling=page.getByTestId('guided-step3');
  await ruling.getByLabel('3-1. 부담 방식 유형',{exact:true}).selectOption(c.mode==='own'?'각자 부담':c.mode==='full'?'전부 부담':'비율/분수 부담');
  if(c.mode==='ratio'){
   await ruling.getByRole('radio',{name:'분수(분자/분모)',exact:true}).check();
   await ruling.getByLabel('신청인 부담 분자',{exact:true}).fill(c.share[0]);await ruling.getByLabel('전체 부담 분모',{exact:true}).fill(c.share[1]);
  }else if(c.mode==='percent'){
   await ruling.getByRole('radio',{name:'퍼센트(%)',exact:true}).check();
   await ruling.getByLabel('신청인 측 부담 비율 (%)',{exact:true}).fill(c.share[0]);
  }
  await ruling.getByRole('button',{name:'부담 비율 설정 반영',exact:true}).click();
  await open(3);const costs=page.getByTestId('guided-step4-5');
  for(const [index,side] of ['신청인','피신청인'].entries()){
   await costs.getByRole('button',{name:`${side} 지출 비용`,exact:true}).click();
   const mainRole=index===0?c.applicantRole:c.applicantRole==='원고'?'피고':'원고';
   const values={...config.defaults[mainRole==='원고'?'plaintiff':'defendant']};if(mainRole==='원고'&&c.plaintiffFee)values.fee=c.plaintiffFee;
   if(c.zero)Object.keys(values).forEach(k=>values[k]='0');
   await costs.getByRole('button',{name:/변호사보수 카드 추가/}).click();
   const editor=page.locator('[data-attorney-cost]').nth(index), detail=editor.locator('xpath=ancestor::details[1]');
   if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
   await editor.getByLabel('변호사보수 실비 (원)',{exact:true}).fill(values.fee);
   await detail.getByLabel('증빙·기록 문서명과 쪽수',{exact:true}).fill(`${c.id} 합성 ${side} 보수 증빙`);
   await costs.getByLabel('실제 납부한 인지액 (원)',{exact:true}).fill(values.stamp);await costs.getByRole('button',{name:'+ 인지대 추가',exact:true}).click();
   await costs.getByLabel('최초 납부 송달료 (원)',{exact:true}).fill(values.servicePaid);await costs.getByLabel('환급 송달료 (원)',{exact:true}).fill(values.serviceRefund);
   await costs.getByRole('button',{name:/^\+ 송달료 추가/}).first().click();
  }
  const fields={stamp:'5-1. 신청 인지대 (원)',priorService:'5-1. 기발생 송달료 (원)',decisionService:'5-1. 결정정본 송달료 (원)',sms:'5-1. SMS 발송료 (원)',scribe:'5-2. 서기료 / 확정신청 별도 보수 (원)',documents:'5-2. 첨부서류 발급비 (등기·초본 등, 원)'};
  for(const [key,label]of Object.entries(fields))await costs.getByLabel(label,{exact:true}).fill(c.zero?'0':config.defaults.application[key]);
  await costs.getByRole('button',{name:/확정신청 비용 반영/}).click();
  const populated=await save();assert.equal(populated.parties.length,2);assert.equal(populated.claims.length,1);assert.equal(populated.stages.length,2);assert.equal(populated.costs.length,7);
  assert.equal(populated.referenceCaseId,undefined);assert.ok(populated.claims[0].claimantIds.length===1&&populated.claims[0].opponentIds.length===1);
  assert.equal(populated.calculation.setoff,'unreviewed');assert.equal(populated.review.responseState,'미확인');
  await open(4);const planRows=page.locator('[data-allocation-cost]');assert.equal(await planRows.count(),7);
  await page.getByRole('button',{name:'본안 비용 6건에 이 주문 적용',exact:true}).click();
  for(let i=6;i<7;i++){
   const row=planRows.nth(i);if(!await row.evaluate(el=>el.open))await row.locator(':scope > summary').click();
   const simple=row.getByTestId('simple-allocation');const basis=simple.getByLabel('신청비용 부담 재판 준용 근거',{exact:true});
   if(await basis.count())await basis.fill('합성 검증 가정: 신청비용에도 본안 비용 부담 비율 적용');
   await simple.getByRole('button',{name:'간편 배분 계획 적용',exact:true}).click();
  }
  await page.getByLabel('상대방 자료 제출',{exact:true}).selectOption('기간 내 제출');
  const afterFact=await save();assert.equal(afterFact.calculation.setoff,'unreviewed','submission fact must not choose calculation');
  await page.getByLabel('비용 법정상계 검토',{exact:true}).selectOption('제112조 본문 적용 검토');
  await page.getByLabel('절사 단위',{exact:true}).selectOption(c.unit);await page.getByLabel('절사 적용 시점',{exact:true}).selectOption(c.timing);
  await page.getByLabel('상계 계산 방식',{exact:true}).selectOption('mutual');
  const saved=await save(),actual=calculateAllocation(saved),expected=oracle.cases.find(r=>r.id===c.id);
  assert.equal(actual.status,'preview',actual.errors.join('\n'));for(const k of ['forward','reverse','forwardRounded','reverseRounded','net'])assert.deepEqual(actual.rows[0][k],expected[k],`${c.id} ${k}`);
  await page.reload();await page.getByRole('button',{name:'저장 초안 복원',exact:true}).click();
  await page.getByText('심급·당사자 추가 또는 변경',{exact:true}).click();
  assert.ok(await page.getByTestId('guided-step1').getByRole('radio',{name:'1심 사건 구성',exact:true}).isChecked());
  assert.equal(await page.getByLabel('당사자 1 표시명',{exact:true}).inputValue(),appName);
  const restored=await save();assert.deepEqual(restored,saved);
  await open(5);await page.getByRole('button',{name:'계산서 미리보기',exact:true}).click();
  const frame=page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]');await frame.getByTestId('report-result').waitFor();
  const result=await frame.getByTestId('report-result').innerText(),net=BigInt(c.expectedNet),amount=(net<0n?-net:net).toLocaleString('ko-KR')+'원';
  if(net===0n)assert.match(result,/상환 차액 없음/);else{
   assert.ok(result.includes(amount),result);const debtor=net<0n?appName:otherName,creditor=net<0n?otherName:appName;
   assert.ok(result.indexOf(debtor)<result.indexOf(creditor),result);
  }
  assert.equal(await frame.locator('[data-cost-id]').count(),7);
  const html=await page.locator('iframe').getAttribute('srcdoc');fs.writeFileSync(path.join(out,`${c.id}.html`),html);fs.writeFileSync(path.join(out,`${c.id}.draft.json`),JSON.stringify(saved,null,2));
  const paper=await context.newPage();await paper.setContent(html);await paper.evaluate(()=>document.fonts.ready);
  const pdf=path.join(out,`${c.id}.pdf`);await paper.pdf({path:pdf,preferCSSPageSize:true,printBackground:true});
  const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});assert.match(info,/\(A4\)/);const pages=Number(info.match(/^Pages:\s+(\d+)/m)[1]);
  const text=compact(execFileSync('pdftotext',['-layout',pdf,'-'],{encoding:'utf8'}));assert.ok(text.includes(compact(result)));
  assert.ok(text.includes('합성검증가정'));assert.ok(!text.includes('브라우저에초안저장'));
  await paper.screenshot({path:path.join(out,`${c.id}.png`),fullPage:true});await paper.close();
  records.push({id:c.id,title:c.title,net:c.expectedNet,pages,expenses:7,pdf});console.log(`PASS ${c.id}: blank form → ${c.expectedNet} won → restore → ${pages}-page A4 PDF`);
  if(c.id==='N01'){
   await open(3);const edited=page.locator('[data-attorney-cost]').first(),detail=edited.locator('xpath=ancestor::details[1]');
   if(!await detail.evaluate(el=>el.open))await detail.locator(':scope > summary').click();
   await edited.getByLabel('변호사보수 실비 (원)',{exact:true}).fill('1100000');
   assert.equal(await page.locator('iframe').count(),0);assert.ok(await page.getByRole('button',{name:'인쇄 / PDF 저장',exact:true}).isDisabled());
   assert.equal(calculateAllocation(await save()).rows[0].net,'1216540');
   await open(5);await page.getByRole('button',{name:/^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/}).click();
   await frame.getByTestId('report-result').waitFor();assert.match(await frame.getByTestId('report-result').innerText(),/1,216,540원/);
   console.log('PASS N01 edit: existing preview invalidated; updated amount 1,216,540 won regenerated');
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({records,pageErrors:errors},null,2)+'\n');
}finally{await browser.close();}
