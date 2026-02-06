import { formatCurrency } from '@/app/case-input/utils';

// Types (You might want to import these from a shared types file if possible, 
// but for now defining simplified versions or using any is acceptable strictly for this utility to avoid circular deps if types are in frontend folders)
// Ideally, types should be in a shared `src/types` or `src/lib/types` folder.
// For now, we'll assume the input 'data' follows the structure we know.

export interface DocumentData {
  debtorInfo: any;
  creditors: any[];
  repaymentPlan: any;
  // Extensible: Add calculated fields here
  repaymentSchedule?: any[];
}

/**
 * Enriches the raw input data with calculated fields (e.g., Repayment Schedule).
 * Run this BEFORE saving to the database to ensure "legal consistency" of the snapshot.
 */
export function enrichDocumentData(data: DocumentData): DocumentData {
  // Deep clone to avoid mutating original
  const enrichedData = JSON.parse(JSON.stringify(data));

  // 1. Calculate Repayment Schedule
  // This is where you will implement the complex logic for priority creditors, variations in monthly payments, etc.
  // For now, we will add a placeholder structure.
  enrichedData.repaymentSchedule = calculateRepaymentSchedule(enrichedData);

  return enrichedData;
}

/**
 * Generates the HTML representation of the document based on the (enriched) snapshot data.
 * Run this ON-THE-FLY when the user views the document.
 */
export function generateDocumentHTML(title: string, data: DocumentData): string {
  const { debtorInfo, creditors, repaymentPlan } = data;

  // 1. Calculate Totals
  let totalPrincipal = 0;
  let totalInterest = 0;
  let totalSecuredPromise = 0; // 담보부 회생채권액 합계 (별제권부 채권의 원리금 합계)
  let totalUnsecuredPromise = 0; // 무담보 회생채권액 합계 (별제권부 제외)

  creditors.forEach((c: any) => {
    // 1. Main Creditor
    const p = Number(c.principal) || 0;
    const i = Number(c.interest) || 0;
    const total = p + i;

    totalPrincipal += p;
    totalInterest += i;

    // 별제권부 채권 여부에 따라 담보부/무담보 구분
    if (c.isSecured) {
      // 별제권부 채권: 원리금 합계를 담보부 회생채권액에 포함
      totalSecuredPromise += total;
    } else {
      // 별제권부가 아닌 채권: 무담보 회생채권액에 포함
      totalUnsecuredPromise += total;
    }

    // 2. Subrogated Creditors
    // Support multiple subrogated creditors (subrogatedList) or single legacy (subrogationData)
    const subList = c.subrogatedList && c.subrogatedList.length > 0
      ? c.subrogatedList
      : (c.isSubrogated && c.subrogationData ? [c.subrogationData] : []);

    if (subList.length > 0) {
      subList.forEach((sub: any) => {
        const sp = Number(sub.principal) || 0;
        const si = Number(sub.interest) || 0;
        const stotal = sp + si;

        totalPrincipal += sp;
        totalInterest += si;

        // 대위변제자는 일반적으로 무담보 회생채권으로 분류 (별도 담보 설정이 없는 한)
        totalUnsecuredPromise += stotal;
      });
    }
  });

  const grandTotal = totalPrincipal + totalInterest;

  // 2. Build Detail Rows (Section 2 - New Detailed Format)
  const detailRows = creditors.map((c: any) => {
    const baseDate = c.baseDate || '-';

    // Description text for the debt
    const principal = Number(c.principal) || 0;
    const interest = Number(c.interest) || 0;
    const total = principal + interest;

    let interestRateText = '';
    const rate = c.interestRate;
    if (!rate || (!isNaN(Number(rate)) && rate !== '')) {
      interestRateText = `연 ${rate || 0}%의 비율에 의한 금원`;
    } else {
      interestRateText = `${rate}이율에 의한 금원`;
    }

    const description = `원리금 ${formatCurrency(total)} 및 그 중 원금 ${formatCurrency(principal)}에 대한 ${c.interestStartDate || '-'}부터 완제일까지 ${interestRateText}.`;

    // Attachments placeholder
    const attachmentTypes = c.attachmentTypes || [];
    let attachments = '';
    if (attachmentTypes.length > 0) {
      attachments = `■ 부속서류<br>( ${attachmentTypes.sort().join(', ')} )`;
    } else {
      attachments = `□ 부속서류<br>(부속서류없음)`;
    }
    // Basis text
    const basisText = `부채증명서 참조(산정기준일 : ${baseDate})`;

    let rows = `
      <tbody style="page-break-inside: avoid; break-inside: avoid;">
      <tr>
        <td rowspan="4" class="center">${c.number}</td>
        <td rowspan="4" class="center">${c.name}</td>
        <td class="left-align" colspan="2">
            ${c.reason || '채권'}
        </td>
        <td class="left-align" colspan="2">
            (주소) ${c.address || '-'}<br>
            (전화) ${c.phone || '-'}<br>
            (팩스) ${c.fax || '-'}
        </td>
      </tr>
      <tr>
        <td class="left-align" rowspan="1" colspan="3">
            ${description}
        </td>
        <td colspan="1" class="left-align" style="vertical-align: top;">
            ${attachments}
        </td>
      </tr>
      <tr>
        <td class="amount">${formatCurrency(principal)}</td>
        <td colspan="3" class="left-align">${basisText}</td>
      </tr>
      <tr>
        <td class="amount">${c.interest > 0 ? formatCurrency(c.interest) : '-'}</td>
        <td colspan="3" class="left-align">${c.interest > 0 ? basisText : ' - '}</td>
      </tr>
      </tbody>`;

    // Subrogated (Linked) Creditor for this row
    // Support multiple subrogated creditors (subrogatedList) or single legacy (subrogationData)
    const subList = c.subrogatedList && c.subrogatedList.length > 0
      ? c.subrogatedList
      : (c.isSubrogated && c.subrogationData ? [c.subrogationData] : []);

    if (subList.length > 0) {
      subList.forEach((sc: any) => {
        const scBaseDate = sc.baseDate || baseDate;

        const scPrincipal = Number(sc.principal) || 0;
        const scInterest = Number(sc.interest) || 0;
        const scTotal = scPrincipal + scInterest;

        let scInterestRateText = '';
        const scRate = sc.interestRate;
        if (!scRate || (!isNaN(Number(scRate)) && scRate !== '')) {
          scInterestRateText = `연 ${scRate || 0}%의 비율에 의한 금원`;
        } else {
          scInterestRateText = `${scRate}이율에 의한 금원`;
        }

        const scDescription = `원리금 ${formatCurrency(scTotal)} 및 그 중 원금 ${formatCurrency(scPrincipal)}에 대한 ${sc.interestStartDate || '-'}부터 완제일까지 ${scInterestRateText}.`;

        const scAttachments = `□ 부속서류<br>부속서류없음`;
        const scBasisText = `부채증명서 참조(산정기준일 : ${scBaseDate})`;

        rows += `
          <tbody style="page-break-inside: avoid; break-inside: avoid;">
          <tr>
            <td rowspan="4" class="center">${sc.number}</td>
            <td rowspan="4" class="center">${sc.name}</td>
            <td class="left-align" colspan="2">
                ${sc.reason || '구상금'}
            </td>
            <td class="left-align" colspan="2">
                (주소) ${sc.address || '-'}<br>
                (전화) ${sc.phone || '-'}<br>
                (팩스) ${sc.fax || '-'}
            </td>
          </tr>
          <tr>
            <td class="left-align" rowspan="1" colspan="3">
                ${scDescription}
            </td>
            <td colspan="1" class="left-align" style="vertical-align: top;">
                ${scAttachments}
            </td>
          </tr>
          <tr>
            <td class="amount">${formatCurrency(scPrincipal)}</td>
            <td colspan="3" class="left-align">${scBasisText}</td>
          </tr>
          <tr>
            <td class="amount">${sc.interest > 0 ? formatCurrency(sc.interest) : '-'}</td>
            <td colspan="3" class="left-align">${sc.interest > 0 ? scBasisText : ' - '}</td>
          </tr>
          </tbody>`;
      });
    }
    return rows;
  }).join('');

  // 3. Build Secured Rows (Section 3) - 별제권부채권 및 이에 준하는 채권의 내역
  const securedCreditors = creditors.filter((c: any) => c.isSecured);

  let securedRows = '';
  let securedTotalPrincipal = 0;
  let securedTotalInterest = 0;
  let securedTotalExpectedRepayment = 0;
  let securedTotalUnrepayable = 0;
  let securedTotalRehabilitationAmount = 0;

  if (securedCreditors.length > 0) {
    securedRows = securedCreditors.map((c: any) => {
      const principal = Number(c.principal) || 0;
      const interest = Number(c.interest) || 0;
      const securedData = c.securedData || {};
      const expectedRepaymentAmount = Number(securedData.expectedRepaymentAmount) || 0;
      const unrepayableAmount = Number(securedData.unrepayableAmount) || 0;
      const securedRehabilitationAmount = Number(securedData.securedRehabilitationAmount) || 0;

      securedTotalPrincipal += principal;
      securedTotalInterest += interest;
      securedTotalExpectedRepayment += expectedRepaymentAmount;
      securedTotalUnrepayable += unrepayableAmount;
      securedTotalRehabilitationAmount += securedRehabilitationAmount;

      const maxAmount = securedData.maxAmount || 0;
      const collateralObject = securedData.collateralObject || '-';
      const expectedLiquidationValue = securedData.expectedLiquidationValue || '-';
      const securedRightDetails = securedData.securedRightDetails || '';

      return `
          <tr>
            <td rowspan="3" class="center">${c.number}</td>
            <td rowspan="3" class="center">${c.name}</td>
            <td class="text-right">${formatCurrency(principal)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(expectedRepaymentAmount)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(unrepayableAmount)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(securedRehabilitationAmount)}</td>
          </tr>
          <tr>
            <td class="text-right">${formatCurrency(interest)}</td>
          </tr>
          <tr>
            <td colspan="4" class="text-left" style="padding: 8px;">
              <div>
                ${securedRightDetails}<br>
                채권최고액 : ${formatCurrency(maxAmount)}<br>
                목적물 : ${collateralObject}<br>
                환가예상액 : ${expectedLiquidationValue}
              </div>
            </td>
          </tr>
          `;
    }).join('');

    // 합계 행 추가
    securedRows += `
          <tr>
            <th colspan="2" rowspan="2" class="center">합 계</th>
            <td class="text-right">${formatCurrency(securedTotalPrincipal)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(securedTotalExpectedRepayment)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(securedTotalUnrepayable)}</td>
            <td rowspan="2" class="text-right">${formatCurrency(securedTotalRehabilitationAmount)}</td>
          </tr>
          <tr>
            <td class="text-right">${formatCurrency(securedTotalInterest)}</td>
          </tr>
      `;
  } else {
    securedRows = `<tr><td colspan="6" class="center">해당 사항 없음</td></tr>`;
  }

  return `
    <div class="document-container">
      <style>
        @media print {
          @page { 
            margin: 15mm; /* Apply margins to every page */
            size: A4;
          }
          body { 
            margin: 0; 
            background: none;
            -webkit-print-color-adjust: exact;
          }
          .document-container {
            width: 100%;
            margin: 0 !important;
            padding: 0 !important; /* Remove container padding, use @page margin instead */
            box-shadow: none !important;
            border: none !important;
          }
          
          /* Prevent table header repetition on new pages */
          thead {
            display: table-row-group;
          }

          /* Prevent table rows from breaking across pages */
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          
          /* Ensure table itself doesn't break awkwardly if possible */
          table { 
            page-break-inside: auto;
            width: 99% !important; /* PDF 저장 시 오른쪽 테두리 짤림 방지 */
            margin: 0 auto !important; /* 가운데 정렬 */
          }
        }
        
        .document-container {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
          line-height: 1.4;
          color: black;
          
          /* A4 Paper Styles for Screen */
          width: 210mm;
          min-height: 297mm;
          padding: 15mm;
          margin: 0 auto;
          background: white;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
          box-sizing: border-box;
          word-break: keep-all;
        }
        
        .document-container h1 {
          text-align: center;
          font-size: 24px;
          margin-bottom: 30px;
          font-weight: bold;
          text-decoration: underline;
          text-underline-offset: 8px;
        }
        
        .document-container h2 {
          font-size: 18px;
          margin-top: 30px;
          margin-bottom: 10px;
          font-weight: bold;
        }
        
        .document-container table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
          table-layout: fixed;
          word-wrap: break-word; /* Ensure wrapping */
        }
        
        .document-container th, .document-container td {
          border: 1px solid #444;
          padding: 6px 4px;
          vertical-align: middle;
          word-break: break-all; /* Force break if necessary */
        }
        
        .document-container th {
          background-color: #f8f9fa;
          font-weight: bold;
          text-align: center;
          white-space: nowrap;
        }

        .document-container .center { text-align: center; }
        .document-container .amount { text-align: right; padding-right: 8px; }
        .document-container .text-right { text-align: right !important; padding-right: 8px; }
        
        /* Utility classes for new table layout */
        .header-bg { background-color: #f0f0f0 !important; }
        .left-align { text-align: left !important; padding: 5px; }
        .no-border-bottom { border-bottom: none !important; }
        .no-border-top { border-top: none !important; }
        
        /* Footer note styling */
        .footer-note { 
          font-size: 12px; 
          margin: 10px 0 12px 0;
          line-height: 1.4;
        }
        
        /* Header info styling */
        .header-info {
          text-align: right;
          margin-bottom: 8px;
          font-size: 13px;
        }
      </style>
      
      <h1>개인회생채권자 목록</h1>

      <div style="margin-bottom: 20px; font-size: 14px;">
         <b>성명:</b> ${debtorInfo.name} <span style="margin: 0 10px;">|</span>
         <b>생년월일:</b> ${debtorInfo.birthDate}
      </div>

      <div class="debt-table-container">
        <div class="header-info">
          <span>목록작성일: ${new Date().toISOString().split('T')[0]}</span>
        </div>

        <table>
          <tr>
            <th rowspan="3" style="width: 15%;">채권현재액</th>
            <th style="width: 8%;">합계</th>
            <td class="text-right" style="width: 15%;">${formatCurrency(grandTotal)}</td>
            
            <th rowspan="3" style="width: 18%;">담보부 회생<br>채권액의 합계</th>
            <td rowspan="3" class="text-right" style="width: 15%;">${formatCurrency(totalSecuredPromise)}</td>
            
            <th rowspan="3" style="width: 18%;">무담보 회생<br>채권액의 합계</th>
            <td rowspan="3" class="text-right" style="width: 15%;">${formatCurrency(totalUnsecuredPromise)}</td>
          </tr>
          <tr>
            <th>원금</th>
            <td class="text-right">${formatCurrency(totalPrincipal)}</td>
          </tr>
          <tr>
            <th>이자</th>
            <td class="text-right">${formatCurrency(totalInterest)}</td>
          </tr>
        </table>

        <div class="footer-note">
          ※ 개시후이자 등: 아래 각 채권의 개시결정일 이후의 이자 · 지연손해금 등은 채무자 회생 및 파산에 관한 법률 제581조 제2항, 제446조 제1항 제1, 2호의 후순위채권입니다.
        </div>
      </div>

      <table>
        <colgroup>
            <col style="width: 8%;">
            <col style="width: 15%;">
            <col style="width: 23.1%;">
            <col style="width: 15.4%;">
            <col style="width: 15.4%;">
            <col style="width: 23.1%;">
        </colgroup>
        <thead>
            <tr class="header-bg">
                <th rowspan="4">채권<br>번호</th>
                <th rowspan="4">채권자</th>
                <th colspan="2">채권의 원인</th>
                <th colspan="2">주소 및 연락처</th>
            </tr>
            <tr class="header-bg">
                <th colspan="3">채권의 내용</th>
                <th>부속서류 유무</th>
            </tr>
            <tr class="header-bg">
                <th>채권현재액(원금)</th>
                <th colspan="3">채권현재액(원금) 산정근거</th>
            </tr>
            <tr class="header-bg">
                <th>채권현재액(이자)</th>
                <th colspan="3">채권현재액(이자) 산정근거</th>
            </tr>
        </thead>
          ${detailRows}
      </table>

      ${securedCreditors.length > 0 ? `
      <h2>부속서류 1. 별제권부채권 및 이에 준하는 채권의 내역</h2>
      <div style="text-align: right; font-size: 13px; margin-bottom: 5px;">(단위 : 원)</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 8%;">채권<br>번호</th>
            <th rowspan="2" style="width: 12%;">채권자</th>
            <th style="width: 20%;">①채권현재액(원금)</th>
            <th rowspan="2" style="width: 20%;">③별제권행사등으로<br>변제가 예상되는<br>채권액</th>
            <th rowspan="2" style="width: 20%;">④별제권행사등으로<br>도 변제받을 수 없을<br>채권액</th>
            <th rowspan="2" style="width: 20%;">⑤담보부<br>회생채권액</th>
          </tr>
          <tr>
            <th>②채권현재액(이자)</th>
          </tr>
          <tr>
            <th colspan="6">⑥별제권 등의 내용 및 목적물</th>
          </tr>
        </thead>
        <tbody>
            ${securedRows}
        </tbody>
      </table>
      ` : ''}
      
      <div style="margin-top: 50px; text-align: center; color: #888; font-size: 10px;">
        <!-- Footer info if needed -->
      </div>
    </div>`;
}

/**
 * Internal helper to calculate repayment schedule.
 * This should return the array of monthly payments that will be frozen in the snapshot.
 */
function calculateRepaymentSchedule(data: DocumentData): any[] {
  // Placeholder logic
  // In the future, implement the actual calculation here based on data.repaymentPlan and data.creditors
  const months = data.repaymentPlan?.repaymentPeriod?.months || 36;
  const schedule = [];
  for (let i = 1; i <= months; i++) {
    schedule.push({
      month: i,
      payment: data.repaymentPlan?.monthlyActualAvailableIncome || 0
    });
  }
  return schedule;
}
