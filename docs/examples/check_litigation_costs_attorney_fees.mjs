/* End-to-end checks for explicit stage value + actual attorney fee inputs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const loadModule = createRequire(import.meta.url);
const { chromium } = loadModule('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const examples = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/fixtures/litigation-costs-attorney-fee-cases.json'), 'utf8'));
const out = process.env.FEE_OUTPUT_DIR || '/workspace/courtai-research/attorney-fees-2026-11-17';
const url = process.env.REPORT_APP_URL || 'http://localhost:3000/litigation-costs';
const compact = s => s.replace(/\s+/g, '');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], records = [];
    page.on('pageerror', error => errors.push(error.message));
    const open = n => page.getByRole('navigation', { name: '입력 목차' }).getByRole('link').nth(n).click();
    const choose = async id => {
      await open(5);
      await page.getByLabel('단순 출력 검증 사례', { exact: true }).selectOption(id);
      await page.getByRole('button', { name: '출력 검증 사례 불러오기', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '현재 입력을 바꾸시겠습니까?' });
      if (await dialog.count()) await dialog.getByRole('button', { name: '입력 바꾸기', exact: true }).click();
      await page.getByText(`${id} 기대 차액`, { exact: false }).waitFor();
    };
    const generate = async () => {
      await open(5);
      await page.getByRole('button', { name: /^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/ }).click();
      await page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]').getByTestId('report-result').waitFor();
    };
    const firstEditor = () => page.locator('[data-attorney-cost]').first();
    const amountIs = async amount => {
      await page.waitForFunction(amount => document.querySelector('[data-attorney-cost] output')?.textContent === amount, BigInt(amount).toLocaleString('ko-KR') + '원');
    };
    await page.goto(url);
    for (const entry of examples) {
      await choose(entry.id);
      await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
      assert.equal(await page.locator('[data-attorney-cost]').count(), entry.fees.length);
      for (let i = 0; i < entry.fees.length; i++) {
        const editor = page.locator('[data-attorney-cost]').nth(i), expected = entry.fees[i];
        assert.equal(await editor.getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).inputValue(), expected.litigationValue);
        assert.equal(await editor.getByLabel('변호사보수 실비 (원)', { exact: true }).inputValue(), expected.paid);
        assert.ok((await editor.getByTestId('attorney-fee-calculation').innerText()).includes(BigInt(expected.recognized).toLocaleString('ko-KR') + '원'));
      }
      await generate();
      const frame = page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]');
      const result = await frame.getByTestId('report-result').innerText();
      assert.ok(result.includes(BigInt(entry.expected.net).toLocaleString('ko-KR') + '원'));
      assert.ok((await frame.locator('body').innerText()).includes('산입액 = min('));
      const html = await page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').getAttribute('srcdoc');
      fs.writeFileSync(path.join(out, entry.id + '.html'), html);
      const paper = await context.newPage(); await paper.setContent(html); await paper.evaluate(() => document.fonts.ready);
      const pdf = path.join(out, entry.id + '.pdf');
      await paper.pdf({ path: pdf, preferCSSPageSize: true, displayHeaderFooter: false });
      const text = compact(execFileSync('pdftotext', ['-layout', pdf, '-'], { encoding: 'utf8' }));
      assert.ok(text.includes(compact(result)) && text.includes('산입액=min(') && text.includes('별표(2020.12.28.)'));
      for (const fee of entry.fees) assert.ok(text.includes(BigInt(fee.recognized).toLocaleString('ko-KR')));
      const info = execFileSync('pdfinfo', [pdf], { encoding: 'utf8' });
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)[1]);
      records.push({ id: entry.id, net: entry.expected.net, pages, pdf });
      await paper.close(); console.log(`PASS ${entry.id}: UI input, capped fee, allocation, formula and ${pages}-page PDF`);
    }
    await choose('F01'); await page.getByRole('button', { name: '전체 펼치기', exact: true }).click(); await generate(); await open(3);
    await firstEditor().getByLabel('변호사보수 실비 (원)', { exact: true }).fill('3,300,000'); await amountIs('3300000');
    assert.equal(await page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').count(), 0);
    assert.ok(await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).isDisabled());
    await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).fill('100,000,000');
    await firstEditor().getByLabel('변호사보수 실비 (원)', { exact: true }).fill('10,000,000'); await amountIs('7400000');
    await firstEditor().getByLabel('보수 환급액 (원)', { exact: true }).fill('8000000'); await amountIs('2000000');
    await firstEditor().getByLabel('보수 환급액 (원)', { exact: true }).fill('0');
    await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).fill('50000000');
    await firstEditor().getByLabel('보수 산입 유형', { exact: true }).selectOption('제5조 1/2 산입'); await amountIs('2200000');
    await firstEditor().getByLabel('변호사보수 실비 (원)', { exact: true }).fill('1000000'); await amountIs('1000000');
    await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).fill('');
    assert.ok(await page.getByRole('button', { name: /^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/ }).isDisabled());
    assert.equal(await page.getByTestId('calculated-results').count(), 0);
    await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).fill('50000000'); await amountIs('1000000');
    await page.getByRole('button', { name: '브라우저에 초안 저장', exact: true }).first().click(); await page.reload();
    await page.getByRole('button', { name: '저장 초안 복원', exact: true }).click();
    await page.getByRole('button', { name: '전체 펼치기', exact: true }).click(); await amountIs('1000000');
    assert.equal(await firstEditor().getByLabel('보수 산입 유형', { exact: true }).inputValue(), '제5조 1/2 산입');
    console.log('PASS live value/actual/refund edits, half-before-min rule, empty-input blocking and v2 restoration');
    await choose('R01'); await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
    await firstEditor().getByLabel('변호사보수 산정 방식', { exact: true }).selectOption('소가·실비로 자동 계산');
    assert.equal(await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).inputValue(), '10000000');
    await firstEditor().getByLabel('심급별 보수 산정 소가 (원)', { exact: true }).fill('50000000');
    await firstEditor().getByLabel('변호사보수 실비 (원)', { exact: true }).fill('10000000'); await amountIs('4400000');
    await firstEditor().getByLabel('변호사보수 산정 방식', { exact: true }).selectOption('직원 인정액 직접 입력');
    assert.equal(await page.getByLabel('직원 검토 인정액 (원)', { exact: true }).first().inputValue(), '1000000');
    await choose('F01'); await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 }); await open(3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await firstEditor().evaluate(el => { el.scrollIntoView({ block: 'start' }); window.scrollBy(0, -88); });
    await page.screenshot({ path: path.join(out, 'mobile-fee-input.png') });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ cases: records, pageErrors: errors }, null, 2)+'\n');
    console.log('PASS legacy manual preservation, mobile form and zero page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
