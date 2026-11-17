/* Input-review regression: synthetic F01, optional sections and one rounding source. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.FORM_REVIEW_OUTPUT_DIR || '/workspace/courtai-research/form-review-2026-11-17';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.REPORT_APP_URL || 'http://localhost:3000/litigation-costs');
  const open = n => page.getByRole('navigation', { name: '입력 목차' }).getByRole('link').nth(n).click();
  const section = n => page.locator(`[data-cost-section="${n}"]`);
  await open(5);
  await page.getByLabel('단순 출력 검증 사례', { exact: true }).selectOption('F01');
  await page.getByRole('button', { name: '출력 검증 사례 불러오기', exact: true }).click();
  await page.getByText('F01 기대 차액', { exact: false }).waitFor();
  await open(3);
  assert.equal(await section(3).locator('h3').first().innerText(), '비용·증빙');
  const advanced = section(3).locator('[data-advanced-fields]');
  assert.equal(await advanced.evaluate(e => e.open), false);
  assert.equal(await page.getByLabel('지급보수 (원)', { exact: true }).isVisible(), false);
  // Open costs only; optional contract fields stay folded.
  await section(3).locator('details:not([data-advanced-fields])').filter({ has: page.getByLabel('변호사보수 실비 (원)', { exact: true }) }).locator(':scope > summary').first().click();
  assert.equal(await page.getByLabel('발생 절차', { exact: true }).first().inputValue(), 's1');
  const before = await page.getByTestId('attorney-fee-calculation').innerText();
  await page.screenshot({ path: `${out}/after-costs.png` });
  await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
  assert.equal(await advanced.evaluate(e => e.open), true);
  await page.getByLabel('지급보수 (원)', { exact: true }).fill('123456');
  assert.equal(await page.getByTestId('attorney-fee-calculation').innerText(), before);
  await open(4);
  assert.equal(await page.getByLabel('절사 계획', { exact: true }).count(), 0);
  await page.getByLabel('절사 단위', { exact: true }).selectOption('10');
  await page.getByLabel('절사 적용 시점', { exact: true }).selectOption('net');
  assert.match(await page.getByTestId('rounding-summary').innerText(), /10원 미만 절사 · 상계 후 절사/);
  await open(0); await page.getByLabel('작업명', { exact: true }).fill('');
  await open(4);
  assert.equal(await section(4).getByRole('button', { name: /작업명을 입력하세요/ }).count(), 0);
  await page.getByRole('button', { name: '브라우저에 초안 저장', exact: true }).first().click();
  await page.reload(); await page.getByRole('button', { name: '저장 초안 복원', exact: true }).click();
  await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
  assert.equal(await page.getByLabel('지급보수 (원)', { exact: true }).inputValue(), '123456');
  assert.equal(await page.getByLabel('변호사보수 실비 (원)', { exact: true }).inputValue(), '10000000');
  assert.match(await page.getByTestId('rounding-summary').innerText(), /10원 미만 절사 · 상계 후 절사/);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 }); await open(3);
    await page.waitForTimeout(350); // Let the shared sidebar finish its responsive transition before capture.
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${out}/after-expanded-${width}.png` });
  }
  assert.deepEqual(errors, []);
  console.log('PASS cost-first order, folded optional fields, accessible stage selector, independent contract reference, shared rounding, optional work title, restore and responsive width');
} finally { await browser.close(); }
