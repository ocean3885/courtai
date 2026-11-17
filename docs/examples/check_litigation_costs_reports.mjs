/* Requires a running development app, Playwright, Chromium, and Poppler tools.
 * Emits synthetic HTML/PDF artifacts outside Git; never reads private reference PDFs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const loadModule = createRequire(import.meta.url);
const { chromium } = loadModule('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cases = JSON.parse(fs.readFileSync(path.join(root, 'src/lib/fixtures/litigation-costs-report-cases.json'), 'utf8'));
const out = process.env.REPORT_OUTPUT_DIR || '/workspace/courtai-research/report-validation-2026-11-17';
const url = process.env.REPORT_APP_URL || 'http://localhost:3000/litigation-costs';
const compact = value => value.replace(/\s+/g, '');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium' });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], records = [];
    page.on('pageerror', e => errors.push(e.message));
    const openSection = n => page.getByRole('navigation', { name: '입력 목차' }).getByRole('link').nth(n).click();
    const frame = () => page.frameLocator('iframe[title="소송비용계산서 검토용 미리보기"]');
    const generate = async () => {
      await page.getByRole('button', { name: /^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/ }).click();
      await frame().getByTestId('report-result').waitFor();
      await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).waitFor();
    };
    const choose = async id => {
      await page.getByRole('combobox', { name: '단순 출력 검증 사례', exact: true }).selectOption(id);
      await page.getByRole('button', { name: '출력 검증 사례 불러오기', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '현재 입력을 바꾸시겠습니까?' });
      if (await dialog.count()) await dialog.getByRole('button', { name: '입력 바꾸기', exact: true }).click();
      await page.getByText(`${id} 기대 차액`, { exact: false }).waitFor();
    };
    await page.goto(url); await openSection(5);
    for (const c of cases) {
      await choose(c.id); await generate();
      const result = await frame().getByTestId('report-result').innerText();
      const amount = BigInt(c.expected.amount).toLocaleString('ko-KR') + '원';
      assert.ok(result.includes(amount), `${c.id}: ${result}`);
      if (c.expected.debtorId) {
        const debtor = c.parties.find(p => p.id === c.expected.debtorId).name;
        const creditor = c.parties.find(p => p.id === c.expected.creditorId).name;
        assert.ok(result.indexOf(debtor) < result.indexOf(creditor), result);
      } else assert.ok(result.includes('상환 차액 없음'));
      assert.equal(await frame().locator('[data-cost-id]').count(), c.costs.length);
      const html = await page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').getAttribute('srcdoc');
      fs.writeFileSync(path.join(out, c.id + '.html'), html);
      const paper = await context.newPage(); await paper.setContent(html); await paper.evaluate(() => document.fonts.ready);
      const pdfPath = path.join(out, c.id + '.pdf');
      await paper.pdf({ path: pdfPath, preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
      const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
      const pages = Number(info.match(/^Pages:\s+(\d+)/m)[1]);
      const size = info.match(/Page size:\s+([\d.]+) x ([\d.]+) pts \(A4\)/);
      assert.ok(size && Math.abs(Number(size[1]) - 595.28) < 1 && Math.abs(Number(size[2]) - 841.89) < 1, info);
      assert.equal(pages, 1, `${c.id}: simple report should fit one A4 page`);
      const extracted = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
      const text = compact(extracted), resultText = compact(result);
      assert.ok(text.includes(resultText), `${c.id}: rendered PDF differs from the preview result`);
      assert.ok(text.includes('소송비용계산서') && text.includes('검토용초안'));
      assert.ok(!text.includes('브라우저에초안저장'));
      await paper.screenshot({ path: path.join(out, c.id + '.png'), fullPage: true });
      records.push({ id: c.id, title: c.title, expectedNet: c.expected.net, result, pages, pdf: pdfPath });
      await paper.close();
      console.log(`PASS ${c.id}: UI result and ${pages}-page A4 PDF match`);
    }
    // Longer evidence notes exercise multi-page tables with repeated column headings.
    const load = loadModule(path.join(root, 'tests/load-ts.cjs'))();
    const { reportCaseDraft } = load('src/lib/litigation-costs-report-cases.ts');
    const { buildCostReport, renderCostReport } = load('src/lib/litigation-costs-report.ts');
    const longDraft = reportCaseDraft('R07');
    longDraft.costs.forEach((c, i) => { c.reason = `검토기록-${i + 1}: ` + '기록과 증빙에 따라 인정액과 부담 범위를 확인하는 긴 비고 검증입니다. '.repeat(16) + ` 끝표시-${i + 1}`; });
    const longBuild = buildCostReport(longDraft); assert.equal(longBuild.status, 'preview');
    const longPaper = await context.newPage(); await longPaper.setContent(renderCostReport(longBuild.report)); await longPaper.evaluate(() => document.fonts.ready);
    const longPath = path.join(out, 'R07-long-notes.pdf');
    await longPaper.pdf({ path: longPath, preferCSSPageSize: true, displayHeaderFooter: false });
    const longInfo = execFileSync('pdfinfo', [longPath], { encoding: 'utf8' });
    assert.ok(Number(longInfo.match(/^Pages:\s+(\d+)/m)[1]) >= 2);
    const longText = compact(execFileSync('pdftotext', ['-layout', longPath, '-'], { encoding: 'utf8' }));
    assert.ok((longText.match(/심급비목비용액비고/g) || []).length >= 2);
    for (let i = 1; i <= longDraft.costs.length; i++) assert.ok(longText.includes(`끝표시-${i}`));
    assert.ok(longText.includes('905,000원'));
    await longPaper.close();
    console.log('PASS long report: multi-page table headers, all notes and final amount retained');
    // Print sends only the current isolated document to its print window.
    await page.evaluate(() => { const w = document.querySelector('iframe[title="소송비용계산서 검토용 미리보기"]').contentWindow; w.print = () => { w.__printCalled = true; }; });
    await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).click();
    assert.equal(await page.evaluate(() => document.querySelector('iframe[title="소송비용계산서 검토용 미리보기"]').contentWindow.__printCalled), true);
    await choose('R06'); await generate();
    await openSection(4);
    await page.getByLabel('절사 적용 시점', { exact: true }).selectOption('direction');
    assert.equal(await page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').count(), 0);
    assert.ok(await page.getByRole('button', { name: '인쇄 / PDF 저장', exact: true }).isDisabled());
    await generate(); assert.ok((await frame().getByTestId('report-result').innerText()).includes('56,670원'));
    await page.getByLabel('상계 계산 방식', { exact: true }).selectOption('unreviewed');
    assert.equal(await page.locator('iframe[title="소송비용계산서 검토용 미리보기"]').count(), 0);
    assert.ok(await page.getByRole('button', { name: /계산서 다시 생성/ }).isDisabled());
    console.log('PASS changed input clears old report and recalculates; blocked calculation disables print');
    await choose('R01'); await generate();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.getByRole('region', { name: '문서 미리보기', exact: true }).screenshot({ path: path.join(out, 'mobile-preview.png') });
    await page.getByRole('button', { name: '유형별 사례', exact: true }).click();
    await page.getByRole('button', { name: 'B04 사례 불러오기', exact: true }).click();
    await page.getByRole('button', { name: '입력 바꾸기', exact: true }).click();
    await openSection(5); assert.ok(await page.getByRole('button', { name: /^(계산서 미리보기|현재 입력으로 계산서 다시 생성)$/ }).isDisabled());
    assert.ok(await page.getByText('첫 계산서 출력은 원고 1명·피고 1명의 본소 사건을 지원합니다.', { exact: false }).count());
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ cases: records, pageErrors: errors }, null, 2) + '\n');
    console.log('PASS mobile fit, unsupported multi-party report guard and no page errors');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
