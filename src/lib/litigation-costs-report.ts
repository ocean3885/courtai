import type { AttorneyFeeCalculation } from './litigation-costs-attorney-fee';
import { amount, parseDraft, type LitigationDraft, type Party } from './litigation-costs-draft';
import { calculateAllocation, formatExact, type ExactAmount, type PairResult } from './litigation-costs-calculator';
import { escapeHTML as h } from './html';

export type ReportCost = {
  id: string; title: string; kind: string; ownerId: string; recognized: string; notes: string[]; excluded: boolean; attorneyFee?: AttorneyFeeCalculation;
};
export type ReportPhase = {
  id: string; type: string; number: string; values: string[]; orders: string[]; rows: ReportCost[];
  applicantCosts: string; respondentCosts: string; forward: ExactAmount; reverse: ExactAmount;
};
export type CostReport = {
  version: 1; createdAt: string; caseTitle: string; court: string; number: string;
  applicant: Party; respondent: Party; phases: ReportPhase[]; result: PairResult;
  mainApplicantCosts: string; mainRespondentCosts: string; totalApplicantCosts: string; totalRespondentCosts: string;
  rounding: string; setoff: string; warnings: string[]; twoColumns: boolean;
  inputSnapshot: LitigationDraft;
};
export type ReportBuild = { status: 'blocked'; errors: string[]; report: null } | { status: 'preview'; errors: []; report: CostReport };
// 표시용 집계만 수행한다. 배분·부담·상계는 기존 계산 결과를 사용한다.
function sumExact(values: ExactAmount[]): ExactAmount {
  let n = BigInt(0), d = BigInt(1);
  for (const v of values) {
    n = n * BigInt(v.denominator) + BigInt(v.numerator) * d;
    d *= BigInt(v.denominator);
    let a = n < BigInt(0) ? -n : n, b = d;
    while (b) { const r = a % b; a = b; b = r; }
    const g = a || BigInt(1); n /= g; d /= g;
  }
  return { numerator: String(n), denominator: String(d) };
}
const sumMoney = (rows: ReportCost[], owner: string) => String(rows.filter(r => r.ownerId === owner).reduce((n, r) => n + BigInt(r.recognized), BigInt(0)));
const won = (v: string) => BigInt(v).toLocaleString('ko-KR') + '원';

/** 첫 출력 범위는 원고 1명·피고 1명의 본소다. 미지원 관계를 생략하여 출력하지 않는다. */
export function buildCostReport(input: LitigationDraft, createdAt = new Date().toISOString()): ReportBuild {
  const blocked = (message: string): ReportBuild => ({ status: 'blocked', errors: [message], report: null });
  let d: LitigationDraft;
  try { d = parseDraft(JSON.stringify(input)); } catch { return blocked('출력 입력의 형식이 올바르지 않습니다.'); }
  const result = calculateAllocation(d);
  if (result.status === 'blocked') return { status: 'blocked', errors: result.errors, report: null };
  if (d.parties.length !== 2 || d.claims.length !== 1 || d.claims[0].kind !== '본소' ||
      !d.parties.some(p => p.mainRole === '원고') || !d.parties.some(p => p.mainRole === '피고') || result.rows.length !== 1) {
    return blocked('첫 계산서 출력은 원고 1명·피고 1명의 본소 사건을 지원합니다. 다수 당사자·반소·일부 신청의 출력은 다음 검증 단계에서 확장합니다.');
  }
  if (d.stages.some(s => !['제1심', '항소심', '상고심', '확정신청'].includes(s.type))) return blocked('환송·재상고 등 특수 절차의 출력은 후속 검증 범위입니다.');
  if (!d.meta.court.trim() || !d.meta.number.trim() || d.parties.some(p => !p.name.trim())) return blocked('계산서의 법원·사건번호·당사자명을 입력하세요.');
  if (amount(d.claims[0].value) === null) return blocked('출력할 청구 소가를 0 이상의 정수로 확인하세요.');
  if (Number.isNaN(new Date(createdAt).getTime())) return blocked('문서 생성일시를 확인하세요.');
  if (d.stages.filter(s => s.type === '확정신청').length !== 1 || d.stages.some(s => !s.number.trim() || !d.costs.some(c => c.stageId === s.id))) {
    return blocked('각 절차의 사건번호와 비용을 등록하세요. 확정신청 절차는 하나로 연결하고, 실제 인정액 0원도 명시적으로 등록하세요.');
  }
  if (d.costs.some(c => c.payerIds.length !== 1 || !c.title.trim())) return blocked('첫 출력의 비용은 귀속 당사자 한 명과 비용명을 명시해야 합니다. 공동 귀속 비용의 출력은 후속 범위입니다.');
  const pair = result.rows[0];
  const applicant = d.parties.find(p => p.id === pair.applicantId)!, respondent = d.parties.find(p => p.id === pair.respondentId)!;
  const reverseBurdenExists = result.traces.some(t => {
    const ruling = d.rulings.find(r => r.id === t.rulingId)!;
    return BigInt(ruling.payerIds[0] === applicant.id ? ruling.numerator : ruling.reverseNumerator) > BigInt(0);
  });
  if (d.calculation.setoff === 'mutual' && reverseBurdenExists && !d.costs.some(c => c.payerIds.includes(respondent.id))) {
    return blocked('일부승소 사건의 피신청인 비용이 미등록입니다. 비용 확인 후 인정액 또는 명시적인 0원 항목을 등록하세요.');
  }
  const phases: ReportPhase[] = d.stages.map(stage => {
    const costs = d.costs.filter(c => c.stageId === stage.id);
    const traces = result.traces.filter(t => costs.some(c => c.id === t.costId));
    const rows: ReportCost[] = costs.map(cost => {
      const autoFee = result.attorneyFees.find(f => f.costId === cost.id)?.calculation;
      const recognized = result.budgets.find(b => b.costId === cost.id)!.recognized;
      const ct = traces.filter(t => t.costId === cost.id);
      return { id: cost.id, title: cost.title, kind: cost.kind, ownerId: cost.payerIds[0], recognized, attorneyFee: autoFee,
        excluded: ct.every(t => !t.included),
        notes: [...(autoFee?.formula || []), !autoFee && (cost.refund !== '0' || cost.claimed !== recognized) ? `청구 ${won(cost.claimed)} · 환급 ${won(cost.refund)} · 인정 ${won(recognized)}` : '',
          !autoFee && ct[0]?.basisValue ? `보수 산정 기초 ${won(ct[0].basisValue)} (한도 자동 산정 아님)` : '',
          `상대방 부담 ${[...new Set(ct.map(t => `${t.burden.numerator}/${t.burden.denominator}`))].join(' / ')}`,
          cost.reason, cost.note, cost.evidence ? `자료: ${cost.evidence}` : '',
          stage.type === '확정신청' ? d.calculation.plans.find(p => p.costId === cost.id)?.applicationBasis || '' : '',
        ].filter(Boolean),
      };
    });
    const manualGroupValues = new Set(d.calculation.plans.filter(p => costs.some(cost => cost.id === p.costId && !cost.attorneyFee)).flatMap(p => d.calculation.groups.find(g => g.id === p.basisGroupId)?.valueIds || []));
    const valueTexts = [...new Set([
      ...d.calculation.values.filter(v => v.stageId === stage.id && (v.purpose === '인지 불복액' || (v.purpose === '보수 소가' && manualGroupValues.has(v.id)))).map(v => `${v.label}: ${won(v.amount)}`),
      ...rows.filter(row => row.attorneyFee).map(row => `${d.parties.find(p => p.id === row.ownerId)?.name} 보수 산정 소가 ${won(row.attorneyFee!.litigationValue)}`),
    ])];
    if (!valueTexts.length && stage.type !== '확정신청') valueTexts.push(`본소 청구 자료값 ${won(d.claims[0].value)} (심급별 산정 소가 별도 확인)`);
    return { id: stage.id, type: stage.type, number: stage.number, rows, values: valueTexts,
      orders: [...new Set(traces.map(t => d.rulings.find(r => r.id === t.rulingId)!.text))],
      applicantCosts: sumMoney(rows, applicant.id), respondentCosts: sumMoney(rows, respondent.id),
      forward: sumExact(traces.filter(t => t.included && t.ownerId === applicant.id).map(t => t.reimbursable)),
      reverse: sumExact(traces.filter(t => t.included && t.ownerId === respondent.id).map(t => t.reimbursable)),
    };
  });
  const allRows = phases.flatMap(p => p.rows), mainRows = phases.filter(p => p.type !== '확정신청').flatMap(p => p.rows);
  return { status: 'preview', errors: [], report: {
    version: 1, createdAt, caseTitle: d.meta.title, court: d.meta.court, number: d.meta.number, applicant, respondent, phases, result: { ...pair },
    mainApplicantCosts: sumMoney(mainRows, applicant.id), mainRespondentCosts: sumMoney(mainRows, respondent.id),
    totalApplicantCosts: sumMoney(allRows, applicant.id), totalRespondentCosts: sumMoney(allRows, respondent.id),
    rounding: `${d.calculation.rounding.timing === 'direction' ? '각 방향 금액을 절사한 뒤 상계' : '정밀 금액을 상계한 뒤 차액 절사'} · ${d.calculation.rounding.unit}원 미만 버림`,
    setoff: d.calculation.setoff === 'applicantOnly' ? '신청인 비용만 반영 · 피신청인 비용은 표에 보존하고 상계 미반영' : '쌍방 상환의무를 대등액에서 상계',
    warnings: result.warnings, twoColumns: allRows.some(r => r.ownerId === respondent.id), inputSnapshot: d,
  } };
}

export function reportResultText(r: CostReport): string {
  const net = BigInt(r.result.net);
  if (net === BigInt(0)) return '상계 후 상환 차액 없음 (0원)';
  if (net < BigInt(0)) return `계산상 역방향 차액: 신청인 ${r.applicant.name} → 피신청인 ${r.respondent.name} ${won(String(-net))}`;
  return `가계산 상환액: 피신청인 ${r.respondent.name} → 신청인 ${r.applicant.name} ${won(String(net))}`;
}

export function renderCostReport(r: CostReport): string {
  const number = (n: string) => h(BigInt(n).toLocaleString('ko-KR'));
  const cols = r.twoColumns ? 5 : 4;
  const rows = r.phases.flatMap(p => p.rows);
  const recognitionNote = rows.some(row => row.attorneyFee) ? '입력 소가·실비로 자동 산입한 보수와 직접 입력한 그 밖의 비용에 부담 관계를 적용했습니다. 지급의무·소가·규칙 적용의 적정성, 재량 조정과 결정문 확정은 별도 검토 사항입니다.' : '직원 인정액과 명시한 부담 관계를 사용했습니다. 실제 지급·지급의무, 법률상 소가·보수 한도, 재량 조정과 결정문 확정은 별도 검토 사항입니다.';
  const commonNotes = rows.length > 1 ? rows[0].notes.filter(note => rows.every(row => row.notes.includes(note))) : [];
  const appPhase = r.phases.find(p => p.type === '확정신청')!;
  const applicationNotes = r.inputSnapshot.calculation.plans.filter(p => appPhase.rows.some(row => row.id === p.costId)).map(p => p.applicationBasis).filter(Boolean).filter((v,i,a) => a.indexOf(v) === i);
  const amounts = (f: string, rev: string) => `<td class="amount">${number(f)}</td>${r.twoColumns ? `<td class="amount">${number(rev)}</td>` : ''}`;
  const phaseRows = (phase: ReportPhase) => phase.rows.map(row => `<tr data-cost-id="${h(row.id)}"><td>${h(phase.type)}</td><td>${h(row.title)}${!row.title.includes(row.kind) ? `<small>${h(row.kind)}</small>` : ''}</td><td class="amount">${row.ownerId === r.applicant.id ? number(row.recognized) : '—'}</td>${r.twoColumns ? `<td class="amount">${row.ownerId === r.respondent.id ? number(row.recognized) : '—'}</td>` : ''}<td class="notes">${row.excluded ? '<strong>상계 미반영</strong><br>' : ''}${row.notes.filter(note => !commonNotes.includes(note) && !applicationNotes.includes(note)).map(h).join('<br>') || '—'}</td></tr>`).join('')
    + `<tr class="subtotal"><th colspan="2">${h(phase.type)} 소계</th>${amounts(phase.applicantCosts, phase.respondentCosts)}<td></td></tr>`;
  const app = r.phases.find(p => p.type === '확정신청')!;
  const totalRow = (label: string, f: string, rev: string) => `<tr class="total"><th colspan="2">${label}</th>${amounts(f, rev)}<td></td></tr>`;
  const moneyExact = (v: ExactAmount) => h(formatExact(v));
  const bodyRows = r.phases.filter(p => p.type !== '확정신청').map(phaseRows).join('');
  const orderGroups = new Map<string, string[]>();
  for (const phase of r.phases.filter(p => p.type !== '확정신청')) {
    for (const order of phase.orders) orderGroups.set(order, [...new Set([...(orderGroups.get(order) || []), phase.type])]);
  }
  const usedOrders = [...orderGroups].map(([order, types]) => `<li>${h(types.join('·'))}: ${h(order)}</li>`).join('');
  const hasFraction = r.phases.some(p => p.forward.denominator !== '1' || p.reverse.denominator !== '1') || r.result.forward.denominator !== '1' || r.result.reverse.denominator !== '1';
  const dated = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(r.createdAt));
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${h(r.number)} 소송비용계산서 (검토용)</title><style>
@page { size: A4; margin: 13mm 12mm 16mm; @bottom-center { content: "- " counter(page) " -"; font-size: 9pt; } @bottom-left { content: ${JSON.stringify(`검토용 · v${r.version} · ${dated}`)}; font-size: 7pt; } }
* { box-sizing: border-box; } body { margin: 0; color: #111; background: #fff; font-family: "Noto Serif CJK KR", Batang, serif; font-size: 10pt; line-height: 1.4; }
article { width: 186mm; margin: 13mm auto 16mm; padding: 0 2px; } h1 { text-align: center; font-size: 19pt; letter-spacing: 0.2em; margin: 6px 0 10px; } h2 { font-size: 11pt; margin: 12px 0 6px; } p { margin: 4px 0; } ul,ol { padding-left: 20px; margin: 6px 0; } .draft { text-align: center; font-size: 9pt; margin-bottom: 12px; } .meta { margin-bottom: 12px; overflow-wrap: anywhere; } .unit { text-align: right; font-size: 9pt; } table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; } th,td { border: 1px solid #333; padding: 4px; vertical-align: middle; overflow-wrap: anywhere; } th { text-align: center; font-weight: 600; } .amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; } .notes { font-size: 8pt; line-height: 1.45; } small { display: block; font-size: 8pt; } .subtotal,.total { font-weight: 600; } .total { border-top: 2px solid #111; } .result { margin-top: 12px; padding: 8px 0; font-size: 11pt; font-weight: 600; } .calculation { border: 1px solid #777; padding: 8px; margin: 8px 0; font-size: 9pt; } .footnotes { break-inside: avoid; border-top: 1px solid #555; padding-top: 6px; margin-top: 12px; font-size: 8pt; } .footnotes li { margin: 3px 0; } .audit { font-size: 8pt; } .audit tr { break-inside: avoid; } footer { margin-top: 4px; line-height: 1.2; font-size: 8pt; color: #444; } thead { display: table-header-group; } tr { break-inside: avoid; } h2,.result { break-after: avoid; } .result,.calculation { break-inside: avoid; } @media print { article { width: auto; margin: 0; padding: 0 2px; } footer { display: none; } }
</style></head><body><article data-testid="cost-report"><h1>소송비용계산서</h1><p class="draft">검토용 초안 · 입력 소가·인정 비용을 기준으로 한 가계산</p>
<div class="meta"><p>${h(r.court)} · ${h(r.number)}</p><p>신청인: ${h(r.applicant.name)} (${h(r.applicant.mainRole)}) / 피신청인: ${h(r.respondent.name)} (${h(r.respondent.mainRole)})</p>${r.phases.filter(p => p.type !== '확정신청').map(p => `<p>${h(p.type)} ${h(p.number)} · ${p.values.map(h).join(' / ')}</p>`).join('')}<ul>${usedOrders}</ul></div>
<h2>1. 총 소송비용</h2><p class="unit">단위: 원 · 표의 비용은 부담 비율 적용 전 산입액</p><table data-testid="report-cost-table"><colgroup><col style="width:9%"><col style="width:18%"><col style="width:16%">${r.twoColumns ? '<col style="width:16%">' : ''}<col></colgroup><thead><tr><th>심급</th><th>비목</th><th>${r.twoColumns ? '신청인' : '비용액'}</th>${r.twoColumns ? '<th>피신청인</th>' : ''}<th>비고</th></tr></thead><tbody>${bodyRows}${totalRow('본안비용 소계',r.mainApplicantCosts,r.mainRespondentCosts)}${phaseRows(app)}${totalRow('인정 비용 합계 (부담 적용 전)',r.totalApplicantCosts,r.totalRespondentCosts)}<tr><td colspan="${cols}" class="notes">인정 비용에 아래 부담 비율·상계·절사를 적용합니다. 이 표의 합계는 최종 상환액과 구분합니다.</td></tr></tbody></table>
<h2>2. 부담액과 상계</h2><table class="audit"><thead><tr><th>절차</th><th>신청인 비용 중 상대방 부담<br>(절사 전)</th><th>피신청인 비용 중 신청인 부담<br>(절사 전)</th></tr></thead><tbody>${r.phases.map(p => `<tr><td>${h(p.type)}</td><td class="amount">${moneyExact(p.forward)}</td><td class="amount">${moneyExact(p.reverse)}</td></tr>`).join('')}</tbody></table>
<div class="calculation"><p>정방향 합계 ${moneyExact(r.result.forward)} − 역방향 합계 ${moneyExact(r.result.reverse)}</p>${r.result.forwardRounded !== null ? `<p>각 방향 절사 후 ${h(won(r.result.forwardRounded))} − ${h(won(r.result.reverseRounded!))}</p>` : ''}<p>${h(r.rounding)} · ${h(r.setoff)}</p></div>
<h2>3. 상계 후 계산 결과</h2><p class="result" data-testid="report-result">${h(reportResultText(r))}</p>${BigInt(r.result.net) < BigInt(0) ? '<p>역방향 차액의 절차상 처리·신청 범위는 별도로 검토해야 합니다.</p>' : ''}
<ol class="footnotes">${hasFraction ? '<li>중간 금액의 소수는 참고 표시입니다. 내부 계산은 분수를 유지하며 지정한 단위·시점에 절사합니다.</li>' : ''}<li>${h(recognitionNote)}</li><li>신청비용 적용 근거: ${h(applicationNotes.join(' / ') || '신청 절차에 직접 연결한 부담 관계')}</li>${commonNotes.length ? `<li>비용 공통 사항: ${commonNotes.map(h).join(' / ')}</li>` : ''}${r.warnings.filter(w => !w.startsWith('직원 인정액과') && !w.startsWith('입력 소가·실비와 선택한 별표로')).map(w => `<li>${h(w)}</li>`).join('')}</ol><footer>생성: ${h(dated)} (한국시간) · 계산서 서식 v${r.version} · 생성 시점 계산 결과 · 검토용 초안</footer></article></body></html>`;
}
