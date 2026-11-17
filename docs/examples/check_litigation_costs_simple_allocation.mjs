/* Synthetic, isolated contexts: guided creation/editing, persistence and PDF results. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const requireModule = createRequire(import.meta.url);
const { chromium } = requireModule('playwright');
const load = requireModule('../../tests/load-ts.cjs')();
const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
const { sampleDraft } = load('src/lib/litigation-costs-draft.ts');
const key = 'courtai.litigation-costs.draft.v2';
const out = process.env.SIMPLE_ALLOCATION_OUTPUT_DIR || '/workspace/courtai-research/simple-allocation-2026-11-17';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
const errors = [];
try {
  async function seeded(draft) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ key, draft }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(draft)); }, { key, draft });
    await page.goto(process.env.REPORT_APP_URL || 'http://localhost:3000/litigation-costs');
    await page.getByRole('button', { name: '저장 초안 복원', exact: true }).click();
    const open = n => page.getByRole('navigation', { name: '입력 목차' }).getByRole('link').nth(n).click();
    const save = () => page.getByRole('button', { name: '브라우저에 초안 저장', exact: true }).first().click();
    const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
    const row = id => page.locator(`[data-allocation-cost="${id}"]`);
    const reveal = async id => { const el = row(id); if (!await el.evaluate(e => e.open)) await el.locator(':scope > summary').click(); return el; };
    const generate = async () => {
      await open(5); await page.getByRole('button', { name: /^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/ }).click();
      await page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]').getByTestId('report-result').waitFor();
    };
    return { context, page, open, row, reveal, save, stored, generate };
  }
  const original = reportCaseDraft('F01'), fresh = structuredClone(original);
  fresh.calculation.plans = [];
  fresh.costs.forEach(c => { c.targetIds = []; c.allocation = '미정'; c.reason = ''; });
  const a = await seeded(fresh);
  await a.open(4);
  for (const cost of fresh.costs) {
    const row = await a.reveal(cost.id), simple = row.getByTestId('simple-allocation');
    assert.ok(await simple.isVisible());
    assert.equal(await row.getByLabel('단계 유형', { exact: true }).count(), 0);
    if (cost.stageId === 'app') {
      assert.ok(await simple.getByRole('button', { name: '간편 배분 계획 적용' }).isDisabled());
      await simple.getByLabel('신청비용 부담 재판 준용 근거', { exact: true }).fill('검증용: 확정신청비용에 본안 주문의 비율을 준용한다고 가정');
      await a.page.locator('[data-cost-section="4"] > summary').click(); await a.open(4);
      assert.match(await simple.getByLabel('신청비용 부담 재판 준용 근거', { exact: true }).inputValue(), /검증용/);
    }
    await simple.getByRole('button', { name: '간편 배분 계획 적용', exact: true }).click();
    await simple.getByTestId('simple-allocation-current').waitFor();
  }
  assert.match(await a.page.getByTestId('calculated-results').innerText(), /4,407,000원/);
  await a.save(); const saved = await a.stored();
  assert.equal(saved.calculation.plans.length, 2);
  assert.ok(saved.calculation.plans.every(p => p.root.type === 'pair'));
  assert.ok(saved.costs.every(c => c.targetIds.length === 2 && c.allocation === '직접 귀속'));
  // Explicit restoration discards tentative local selection/grounds as well as draft changes.
  const appCost = fresh.costs.find(c => c.stageId === 'app');
  const appEditor = (await a.reveal(appCost.id)).getByTestId('simple-allocation');
  await appEditor.getByLabel('신청비용 부담 재판 준용 근거', { exact: true }).fill('적용하지 않은 임시 입력');
  await a.page.getByRole('button', { name: '저장 초안 복원', exact: true }).click();
  await a.page.getByRole('button', { name: '입력 바꾸기', exact: true }).click();
  await a.open(4);
  const restoredApp = (await a.reveal(appCost.id)).getByTestId('simple-allocation');
  assert.match(await restoredApp.getByLabel('신청비용 부담 재판 준용 근거', { exact: true }).inputValue(), /검증용/);
  await a.generate();
  const html = await a.page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').getAttribute('srcdoc');
  fs.writeFileSync(path.join(out, 'simple-F01.html'), html);
  const paper = await a.context.newPage(); await paper.setContent(html); await paper.evaluate(() => document.fonts.ready);
  const pdf = path.join(out, 'simple-F01.pdf'); await paper.pdf({ path: pdf, preferCSSPageSize: true, printBackground: true });
  const extracted = execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' });
  assert.match(extracted, /4,407,000원/); assert.match(extracted, /검증용/); await paper.close();
  await a.page.reload(); await a.page.getByRole('button', { name: '저장 초안 복원', exact: true }).click(); await a.open(4);
  assert.match(await a.page.getByTestId('calculated-results').innerText(), /4,407,000원/);
  assert.deepEqual(await a.stored(), saved);
  const firstRow = await a.reveal(fresh.costs[0].id);
  assert.equal(await firstRow.getByLabel('단계 유형', { exact: true }).isVisible(), false);
  await firstRow.getByTestId('simple-allocation').scrollIntoViewIfNeeded();
  await a.page.screenshot({ path: path.join(out, 'simple-desktop.png') });
  await a.page.setViewportSize({ width: 390, height: 844 }); await a.open(4); await a.page.waitForTimeout(350);
  await firstRow.getByTestId('simple-allocation').scrollIntoViewIfNeeded();
  assert.ok(await a.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await a.page.screenshot({ path: path.join(out, 'simple-mobile.png') });
  await a.context.close();
  console.log('PASS fresh plans: no tree editing, explicit application grounds, cost scope, amount 4,407,000 won, PDF, fold retention, restoration and mobile');

  const two = reportCaseDraft('F01');
  two.rulings.push({ ...two.rulings[0], id: 'half-order', numerator: '1', denominator: '2', text: '검증용 다른 부담 관계: 상대방이 이 비용의 1/2 부담' });
  const b = await seeded(two); await b.generate(); await b.open(4);
  const fee = two.costs[0], edit = (await b.reveal(fee.id)).getByTestId('simple-allocation');
  await edit.getByLabel('적용 부담 관계', { exact: true }).selectOption('half-order');
  // A tentative selection does not rewrite the existing plan or stale the report.
  assert.match(await b.page.getByTestId('calculated-results').innerText(), /4,407,000원/);
  assert.equal(await b.page.locator('iframe').count(), 1);
  await edit.getByRole('button', { name: '간편 배분 계획 적용', exact: true }).click();
  assert.equal(await b.page.locator('iframe').count(), 0);
  assert.match(await b.page.getByTestId('calculated-results').innerText(), /2,207,000원/);
  await b.save(); const changed = await b.stored();
  const beforeRoot = structuredClone(two.calculation.plans[0].root);
  let leaf = beforeRoot; while (leaf.type === 'split') leaf = leaf.branches[0].node; leaf.rulingId = 'half-order';
  assert.deepEqual(changed.calculation.plans[0].root, beforeRoot);
  assert.deepEqual(changed.costs[0].attorneyFee, two.costs[0].attorneyFee);
  await b.context.close();
  console.log('PASS explicit edit: half burden gives 2,207,000 won, old preview invalidates on apply, existing tree and fee preserved');

  const ambiguous = structuredClone(two); ambiguous.calculation.plans = [];
  const c = await seeded(ambiguous); await c.open(4);
  const ambiguousEditor = (await c.reveal(ambiguous.costs[0].id)).getByTestId('simple-allocation');
  assert.equal(await ambiguousEditor.getByLabel('적용 부담 관계', { exact: true }).inputValue(), '');
  assert.ok(await ambiguousEditor.getByRole('button', { name: '간편 배분 계획 적용', exact: true }).isDisabled());
  await c.context.close();
  const complex = sampleDraft(), d = await seeded(complex); await d.open(4);
  await d.reveal(complex.costs[0].id);
  assert.equal(await d.page.getByTestId('simple-allocation').count(), 0);
  await d.save(); assert.deepEqual((await d.stored()).calculation, complex.calculation);
  assert.equal(await d.page.getByTestId('calculated-results').locator('tbody tr').count(), 8);
  await d.context.close(); assert.deepEqual(errors, []);
  console.log('PASS multiple candidates require selection; complex plans remain available, unchanged, and calculate eight original relations; no page errors');
} finally { await browser.close(); }
