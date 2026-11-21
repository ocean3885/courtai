'use client';

import React, { useState } from 'react';
import {
  type ApplicationPolicy,
  type Cost,
  type Party,
  type Reviews,
  type Stage,
  stageLevel,
} from './caseInput';
import {
  money,
  reviewCosts,
  subtract,
  add,
  nothing,
  type Amount,
  fraction,
} from './costReview';
import { reviewApplicationCosts } from './applicationCosts';
import { ordinaryFeeLimit } from './ordinaryFee';

type Props = {
  parties: Party[];
  stages: Stage[];
  reviews: Reviews;
  applicationCosts: Cost[];
  applicationPolicy?: ApplicationPolicy;
  label: (p: Party) => string;
  onClose: () => void;
};

function formatWon(n: bigint | number): string {
  return BigInt(n).toLocaleString('ko-KR');
}

function lawyerFeeFormula(value: bigint): string {
  if (value > 500000000n) {
    return `13,400,000＋(${formatWon(value)}－500,000,000)×0.005`;
  } else if (value > 200000000n) {
    return `10,400,000＋(${formatWon(value)}－200,000,000)×0.01`;
  } else if (value > 150000000n) {
    return `9,400,000＋(${formatWon(value)}－150,000,000)×0.02`;
  } else if (value > 100000000n) {
    return `7,400,000＋(${formatWon(value)}－100,000,000)×0.04`;
  } else if (value > 50000000n) {
    return `4,400,000＋(${formatWon(value)}－50,000,000)×0.06`;
  } else if (value > 20000000n) {
    return `2,000,000＋(${formatWon(value)}－20,000,000)×0.08`;
  } else if (value > 3000000n) {
    return `300,000＋(${formatWon(value)}－3,000,000)×0.10`;
  }
  return '300,000';
}

export function CostStatementModal({
  parties,
  stages,
  reviews,
  applicationCosts,
  applicationPolicy,
  label,
  onClose,
}: Props) {
  const [caseNumber, setCaseNumber] = useState<string>('2026카확');
  const [isEditingCaseNumber, setIsEditingCaseNumber] = useState(false);

  const { lines, errors, ownerTotals } = reviewCosts(stages, parties);
  const application = reviewApplicationCosts(applicationCosts, parties, stages, applicationPolicy);

  const applicants = parties.filter((p) => p.group === '신청인');
  const respondents = parties.filter((p) => p.group === '피신청인');

  const mainApplicant = applicants[0];
  const mainRespondent = respondents[0];

  // 피신청인 지출 비용 유무 판단 (쌍방 비용 테이블 여부)
  const hasRespondentCosts = respondents.some((resp) => {
    const total = ownerTotals.get(resp.id);
    return total && total.n > 0n;
  });

  // 상환액 계산
  const total = (owner: string, debtor: string) =>
    lines
      .filter((l) => l.owner === owner && l.debtor === debtor)
      .reduce((sum, l) => add(sum, l.amount), nothing);

  const applicationTotal = (owner: string, debtor: string) =>
    application.lines
      .filter((l) => l.owner === owner && l.debtor === debtor)
      .reduce((sum, l) => add(sum, l.amount), nothing);

  const settlements = applicants.flatMap((a) =>
    respondents.map((b) => {
      const r = reviews[b.id];
      const forward = total(a.id, b.id);
      const reverse = total(b.id, a.id);
      const mutual = r?.treatment === '쌍방 비용 상계';
      const appAmount = applicationTotal(a.id, b.id);
      const net = subtract(forward, mutual ? reverse : nothing);
      const combined = add(net, appAmount);
      return { a, b, forward, reverse, mutual, net, appAmount, combined };
    })
  );

  const activeSettlement = settlements[0];

  // 사건번호 모음
  const mainCaseNumbers = stages
    .map((s) => s.number?.trim())
    .filter(Boolean)
    .join(', ');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 md:p-6 overflow-y-auto">
      {/* 인쇄 스타일 */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #cost-statement-printable, #cost-statement-printable * {
            visibility: visible;
          }
          #cost-statement-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 15mm;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl max-h-[94vh] flex flex-col rounded-xl bg-white shadow-2xl overflow-hidden border border-slate-300">
        {/* 상단 툴바 (화면 전용) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-800">📄 소송비용계산서 양식 미리보기</span>
            <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">법원 표준 서식</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              🖨️ PDF 인쇄 / 저장
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              닫기
            </button>
          </div>
        </div>

        {/* 안내 배너 (화면 전용) */}
        <div className="no-print bg-blue-50/70 border-b border-blue-100 px-4 py-2 text-xs text-blue-900 flex items-center justify-between">
          <span>인쇄 대화상자에서 대상 프린터를 <strong>&apos;PDF로 저장&apos;</strong>으로 선택하시면 실제 법원 소송비용계산서 PDF 파일로 다운로드됩니다.</span>
          <span className="text-slate-500 font-normal">A4 기준</span>
        </div>

        {/* 문서 본문 영역 (출력 대상) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-slate-100/50">
          <div
            id="cost-statement-printable"
            className="mx-auto max-w-[210mm] min-h-[297mm] bg-white p-8 md:p-12 shadow-sm border border-slate-200 text-slate-900 font-serif"
            style={{ fontFamily: "'Batang', 'Apple SD Gothic Neo', serif" }}
          >
            {/* 1. 문서 제목 */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-[0.5em] pl-[0.5em] text-black">
                소 송 비 용 계 산 서
              </h1>
            </div>

            {/* 2. 사건 및 당사자 정보 */}
            <div className="space-y-1.5 text-sm leading-relaxed mb-6">
              <div className="flex items-baseline gap-2">
                <span className="font-bold">
                  {isEditingCaseNumber ? (
                    <input
                      type="text"
                      className="border border-blue-500 rounded px-1.5 py-0.5 text-sm font-serif"
                      value={caseNumber}
                      onChange={(e) => setCaseNumber(e.target.value)}
                      onBlur={() => setIsEditingCaseNumber(false)}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => setIsEditingCaseNumber(true)}
                      className="cursor-pointer hover:bg-slate-100 px-1 py-0.5 rounded border border-dashed border-transparent hover:border-slate-300 no-print-border"
                      title="클릭하여 사건번호 변경"
                    >
                      {caseNumber || '사건번호 입력'}
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="font-semibold">신청인 : </span>
                <span>
                  {mainApplicant ? label(mainApplicant) : '신청인'}
                  {mainCaseNumbers && ` (${mainCaseNumbers})`}
                </span>
              </div>

              {mainRespondent && (
                <div>
                  <span className="font-semibold">피신청인 : </span>
                  <span>{label(mainRespondent)}</span>
                </div>
              )}

              {/* 심급별 소가 */}
              <div className="pt-1">
                {stages.map((s, idx) => {
                  const sLevel = stageLevel(s, idx);
                  const soga = s.value ? BigInt(s.value) : 0n;
                  const counterSoga = s.counter && s.counterValue ? BigInt(s.counterValue) : 0n;
                  return (
                    <span key={s.id} className="mr-3">
                      제{sLevel} 소가 : {formatWon(soga + counterSoga)}원
                      {counterSoga > 0n && (
                        <span className="text-xs text-slate-600">
                          (본소 {formatWon(soga)} + 반소 {formatWon(counterSoga)})
                        </span>
                      )}
                      {idx < stages.length - 1 && ', '}
                    </span>
                  );
                })}
              </div>

              {/* 소송비용부담 주문 bullet */}
              <div className="pt-1 space-y-0.5">
                {stages.map((s, idx) => {
                  const sLevel = stageLevel(s, idx);
                  const rules = s.rules || [];
                  return rules.map((r, rIdx) => {
                    let desc = '';
                    if (r.mode === '2측 전부 부담') {
                      desc = `${sLevel} 비용은 피신청인(상대방)이 전부 부담한다.`;
                    } else if (r.mode === '1측 전부 부담') {
                      desc = `${sLevel} 비용은 신청인이 전부 부담한다.`;
                    } else if (r.mode === '비율로 분담') {
                      if (r.d === '100') {
                        desc = `${r.scope || sLevel}은 그중 ${r.n}%는 신청인이, 나머지는 피신청인이 각 부담한다.`;
                      } else {
                        desc = `${r.scope || sLevel}은 ${r.n}/${r.d} 비율로 분담한다.`;
                      }
                    } else {
                      desc = `${r.scope || sLevel}은 ${r.mode}`;
                    }
                    return (
                      <div key={`${s.id}-${rIdx}`} className="text-slate-800">
                        • &ldquo;{desc}&rdquo;
                      </div>
                    );
                  });
                })}
              </div>
            </div>

            {/* 3. 1. 총 소송비용 표 */}
            <div className="mb-6">
              <div className="flex justify-between items-baseline mb-1 text-xs">
                <span className="font-bold text-sm">1. 총 소송비용</span>
                <span className="text-slate-600">(단위 : 원, 원 미만 버림)</span>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-slate-50 text-center font-bold">
                    <th className="border border-black p-1.5 w-14">심급</th>
                    <th className="border border-black p-1.5 w-24">비목</th>
                    {hasRespondentCosts ? (
                      <>
                        <th className="border border-black p-1.5 w-28">비용액 (신청인)</th>
                        <th className="border border-black p-1.5 w-28">비용액 (피신청인)</th>
                      </>
                    ) : (
                      <th className="border border-black p-1.5 w-32">비용액</th>
                    )}
                    <th className="border border-black p-1.5">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {stages.map((s, idx) => {
                    const sLevel = stageLevel(s, idx);
                    const stageCosts = s.costs || [];
                    const soga = s.value ? BigInt(s.value) : 0n;

                    let stageAppTotal = 0n;
                    let stageRespTotal = 0n;

                    return (
                      <React.Fragment key={s.id}>
                        {stageCosts.map((c, cIdx) => {
                          const isFee = c.kind === '변호사보수';
                          const paidAmount = BigInt(c.paid || '0');
                          const refundAmount = BigInt(c.refund || '0');
                          const netAmount = paidAmount - refundAmount;

                          // 변호사보수 법정한도
                          const feeLimit = isFee && soga > 0n ? ordinaryFeeLimit(soga) : netAmount;
                          const recognizedAmount = isFee ? (netAmount < feeLimit ? netAmount : feeLimit) : netAmount;

                          const isApplicantOwner = c.payer === mainApplicant?.id || (c.ids || []).includes(mainApplicant?.id || '');

                          if (isApplicantOwner) {
                            stageAppTotal += recognizedAmount;
                          } else {
                            stageRespTotal += recognizedAmount;
                          }

                          let remark = '';
                          if (isFee) {
                            remark = `변호사보수의 소송비용산입에 관한 규칙 제3조에 의거 산정하면 ${lawyerFeeFormula(soga)}`;
                          } else if (c.refund && c.refund !== '0') {
                            remark = `실제 지출비용 산입(환급액 ${formatWon(refundAmount)} 제외)`;
                          } else if (c.evidence) {
                            remark = c.evidence;
                          }

                          return (
                            <tr key={c.id}>
                              {cIdx === 0 && (
                                <td
                                  rowSpan={stageCosts.length + 1}
                                  className="border border-black p-1.5 text-center font-bold align-middle bg-white"
                                >
                                  {sLevel}
                                </td>
                              )}
                              <td className="border border-black p-1.5 text-center font-medium">
                                {c.title || c.kind}
                              </td>
                              {hasRespondentCosts ? (
                                <>
                                  <td className="border border-black p-1.5 text-right tabular-nums">
                                    {isApplicantOwner ? formatWon(recognizedAmount) : ''}
                                  </td>
                                  <td className="border border-black p-1.5 text-right tabular-nums">
                                    {!isApplicantOwner ? formatWon(recognizedAmount) : ''}
                                  </td>
                                </>
                              ) : (
                                <td className="border border-black p-1.5 text-right tabular-nums font-medium">
                                  {formatWon(recognizedAmount)}
                                </td>
                              )}
                              <td className="border border-black p-1.5 text-left text-[11px] leading-tight text-slate-700">
                                {remark}
                              </td>
                            </tr>
                          );
                        })}

                        {/* 심급 소계 */}
                        <tr className="bg-slate-50/50 font-semibold">
                          <td className="border border-black p-1.5 text-center">소계</td>
                          {hasRespondentCosts ? (
                            <>
                              <td className="border border-black p-1.5 text-right tabular-nums">
                                {formatWon(stageAppTotal)}
                              </td>
                              <td className="border border-black p-1.5 text-right tabular-nums">
                                {formatWon(stageRespTotal)}
                              </td>
                            </>
                          ) : (
                            <td className="border border-black p-1.5 text-right tabular-nums">
                              {formatWon(stageAppTotal)}
                            </td>
                          )}
                          <td className="border border-black p-1.5 text-left text-[11px]"></td>
                        </tr>
                      </React.Fragment>
                    );
                  })}

                  {/* 본안비용소계 */}
                  {(() => {
                    const applicantMainTotal = lines
                      .filter((l) => l.owner === mainApplicant?.id)
                      .reduce((sum, l) => add(sum, l.amount), nothing);

                    const respondentMainTotal = lines
                      .filter((l) => l.owner === mainRespondent?.id)
                      .reduce((sum, l) => add(sum, l.amount), nothing);

                    return (
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={2} className="border border-black p-1.5 text-center">
                          본안비용소계
                        </td>
                        {hasRespondentCosts ? (
                          <>
                            <td className="border border-black p-1.5 text-right tabular-nums">
                              {formatWon(applicantMainTotal.n / (applicantMainTotal.d || 1n))}
                            </td>
                            <td className="border border-black p-1.5 text-right tabular-nums">
                              {formatWon(respondentMainTotal.n / (respondentMainTotal.d || 1n))}
                            </td>
                          </>
                        ) : (
                          <td className="border border-black p-1.5 text-right tabular-nums">
                            {formatWon(applicantMainTotal.n / (applicantMainTotal.d || 1n))}
                          </td>
                        )}
                        <td className="border border-black p-1.5 text-left text-[11px]">
                          {stages.map((s, idx) => stageLevel(s, idx)).join(' + ')}
                        </td>
                      </tr>
                    );
                  })()}

                  {/* 소송비용확정신청 비용 */}
                  {applicationCosts.length > 0 && (
                    <>
                      {applicationCosts.map((ac, acIdx) => {
                        const paidAmount = BigInt(ac.paid || '0');
                        let remark = '';
                        if (ac.kind.includes('송달료')) {
                          if (ac.deliveryDetail && (ac.deliveryDetail.incurred || ac.deliveryDetail.decision || ac.deliveryDetail.mobile)) {
                            const inc = ac.deliveryDetail.incurred ? `기발생 ${formatWon(BigInt(ac.deliveryDetail.incurred))}` : '';
                            const dec = ac.deliveryDetail.decision ? `결정정본 ${formatWon(BigInt(ac.deliveryDetail.decision))}` : '';
                            const mob = ac.deliveryDetail.mobile ? `모바일단문메시지 ${formatWon(BigInt(ac.deliveryDetail.mobile))}` : '';
                            const parts = [inc, dec, mob].filter(Boolean).join(' + ');
                            remark = `${parts} (잔액은 확정 후 자동 환급)`;
                          } else {
                            remark = '기발생 + 결정정본 송달료 등 (잔액은 확정 후 환급)';
                          }
                        } else if (ac.kind.includes('발급비')) {
                          remark = ac.title || '법인등기사항증명서 또는 제증명 발급';
                        }
                        return (
                          <tr key={ac.id}>
                            {acIdx === 0 && (
                              <td
                                rowSpan={applicationCosts.length + 1}
                                className="border border-black p-1.5 text-center font-bold align-middle bg-white"
                              >
                                소송비용<br />확정신청
                              </td>
                            )}
                            <td className="border border-black p-1.5 text-center font-medium">
                              {ac.title || ac.kind}
                            </td>
                            {hasRespondentCosts ? (
                              <>
                                <td className="border border-black p-1.5 text-right tabular-nums">
                                  {formatWon(paidAmount)}
                                </td>
                                <td className="border border-black p-1.5 text-right tabular-nums">-</td>
                              </>
                            ) : (
                              <td className="border border-black p-1.5 text-right tabular-nums">
                                {formatWon(paidAmount)}
                              </td>
                            )}
                            <td className="border border-black p-1.5 text-left text-[11px] text-slate-700">
                              {remark}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-50/50 font-semibold">
                        <td className="border border-black p-1.5 text-center">신청비용소계</td>
                        {hasRespondentCosts ? (
                          <>
                            <td className="border border-black p-1.5 text-right tabular-nums">
                              {formatWon(application.lines.reduce((s, l) => add(s, l.amount), nothing).n)}
                            </td>
                            <td className="border border-black p-1.5 text-right tabular-nums">-</td>
                          </>
                        ) : (
                          <td className="border border-black p-1.5 text-right tabular-nums">
                            {formatWon(application.lines.reduce((s, l) => add(s, l.amount), nothing).n)}
                          </td>
                        )}
                        <td className="border border-black p-1.5 text-left text-[11px]"></td>
                      </tr>
                    </>
                  )}

                  {/* 총 합계 */}
                  {(() => {
                    const appGrand = activeSettlement
                      ? add(activeSettlement.forward, activeSettlement.appAmount)
                      : nothing;
                    const respGrand = activeSettlement ? activeSettlement.reverse : nothing;

                    return (
                      <tr className="bg-slate-200/80 font-bold text-sm">
                        <td colSpan={2} className="border border-black p-2 text-center">
                          합계
                        </td>
                        {hasRespondentCosts ? (
                          <>
                            <td className="border border-black p-2 text-right tabular-nums">
                              {formatWon(appGrand.n / (appGrand.d || 1n))}
                            </td>
                            <td className="border border-black p-2 text-right tabular-nums">
                              {formatWon(respGrand.n / (respGrand.d || 1n))}
                            </td>
                          </>
                        ) : (
                          <td className="border border-black p-2 text-right tabular-nums">
                            {formatWon(appGrand.n / (appGrand.d || 1n))}
                          </td>
                        )}
                        <td className="border border-black p-2 text-left text-xs font-normal">
                          본안비용 ＋ 신청비용
                        </td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* 4. 2. 피신청인이 신청인에게 상환하여야 할 소송비용액 */}
            <div className="border border-black p-4 mb-8 bg-slate-50/60">
              <h2 className="text-base font-bold text-black mb-1">
                2. {mainRespondent ? label(mainRespondent) : '피신청인'}이{' '}
                {mainApplicant ? label(mainApplicant) : '신청인'}에게 상환하여야 할 소송비용액
              </h2>
              <div className="text-lg font-bold text-black pl-4">
                금 {activeSettlement ? money(activeSettlement.combined) : '0원'}
                {activeSettlement && activeSettlement.mutual && (
                  <span className="block text-xs font-normal text-slate-600 mt-1">
                    (= 신청인 인정액 {money(add(activeSettlement.forward, activeSettlement.appAmount))} - 피신청인 상계액 {money(activeSettlement.reverse)})
                  </span>
                )}
              </div>
            </div>

            {/* 5. 각주 (Footnotes) */}
            <div className="border-t border-slate-300 pt-3 text-[11px] text-slate-600 leading-relaxed space-y-1">
              <div>
                1) 변호사보수액은 대법원규칙에 의하여 산정된 금액과 실제 지급한(또는 지급할) 금액 중 적은 금액을 소송비용으로 인정한다(민사소송법 제109조 제1항, 변호사보수의 소송비용 산입에 관한 규칙 제3조 제1항).
              </div>
              <div>
                2) 소송비용액확정신청비용의 분담비율은 본안 확정 판결의 소송비용부담 재판에서의 비율에 따라 산정한다.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
