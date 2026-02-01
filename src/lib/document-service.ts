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
  let totalSecuredPromise = 0; // 담보부 회생채권액 합계

  creditors.forEach((c: any) => {
    const p = Number(c.principal) || 0;
    const i = Number(c.interest) || 0;
    totalPrincipal += p;
    totalInterest += i;
    
    // Check for secured data - use securedRehabilitationAmount if available
    if (c.securedRehabilitationAmount) {
        totalSecuredPromise += Number(c.securedRehabilitationAmount);
    }
  });

  const grandTotal = totalPrincipal + totalInterest;
  const totalUnsecuredPromise = grandTotal - totalSecuredPromise;

  // 2. Build Detail Rows (Section 2 - New Detailed Format)
  const detailRows = creditors.map((c: any) => {
    const baseDate = c.baseDate || '-';
    // Description text for the debt
    const description = `원금 ${formatCurrency(c.principal || 0)} 및 그 중 원금 ${formatCurrency(c.principal || 0)}에 대한 ${c.interestStartDate || '-'}부터 완제일까지 연 ${c.interestRate || 0}%의 비율에 의한 금원.`;
    // Attachments placeholder
    const attachments = `□ 부속서류<br>( )`;
    // Basis text
    const basisText = `부채증명서 참조(산정기준일 : ${baseDate})`;

    let rows = `
      <tbody style="page-break-inside: avoid; break-inside: avoid;">
      <tr>
        <td rowspan="4" class="center">${c.number}</td>
        <td rowspan="4" class="center">${c.name}</td>
        <td class="left-align" colspan="2">
            ${baseDate} 자(산정일 기준) 체납<br>
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
        <td class="amount">${formatCurrency(c.principal || 0)}</td>
        <td colspan="3" class="left-align">${basisText}</td>
      </tr>
      <tr>
        <td class="amount">${c.interest > 0 ? formatCurrency(c.interest) : '-'}</td>
        <td colspan="3" class="left-align">${c.interest > 0 ? basisText : ' - '}</td>
      </tr>
      </tbody>`;

    // Subrogated (Linked) Creditor for this row
    if (c.isSubrogated && c.subrogationData) {
      const sc = c.subrogationData;
      const scBaseDate = sc.baseDate || baseDate;
      const scDescription = `구상금 ${formatCurrency(sc.principal || 0)} 및 이에 대한 ${sc.interestStartDate || '-'}부터 완제일까지 연 ${sc.interestRate || 0}%의 비율에 의한 금원.`;
      const scAttachments = `□ 부속서류<br>( )`;
      const scBasisText = `부채증명서 참조(산정기준일 : ${scBaseDate})`;

      rows += `
      <tbody style="page-break-inside: avoid; break-inside: avoid;">
      <tr>
        <td rowspan="4" class="center">${sc.number}</td>
        <td rowspan="4" class="center">${sc.name} (대위변제자)</td>
        <td class="left-align" colspan="2">
            ${scBaseDate} 자(산정일 기준)<br>
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
        <td class="amount">${formatCurrency(sc.principal || 0)}</td>
        <td colspan="3" class="left-align">${scBasisText}</td>
      </tr>
      <tr>
        <td class="amount">${sc.interest > 0 ? formatCurrency(sc.interest) : '-'}</td>
        <td colspan="3" class="left-align">${sc.interest > 0 ? scBasisText : ' - '}</td>
      </tr>
      </tbody>`;
    }
    return rows;
  }).join('');

  // 3. Build Secured Rows (Section 3)
  const securedCreditors = creditors.filter((c: any) => 
      (c.securedRehabilitationAmount && c.securedRehabilitationAmount > 0) || c.collateralObject
  );
  
  let securedRows = '';
  if (securedCreditors.length > 0) {
      securedRows = securedCreditors.map((c: any) => {
          return `
          <tr>
            <td class="center">${c.number}</td>
            <td>${c.name}</td>
            <td>${c.collateralObject || '-'}${c.maxAmount ? '<br>채권최고액: ' + formatCurrency(c.maxAmount) : ''}</td>
            <td class="amount">${c.expectedLiquidationValue ? formatCurrency(c.expectedLiquidationValue) : '-'}</td>
            <td class="amount">${c.securedRehabilitationAmount ? formatCurrency(c.securedRehabilitationAmount) : '-'}</td>
          </tr>
          `;
      }).join('');
  } else {
      securedRows = `<tr><td colspan="5" class="center">해당 사항 없음</td></tr>`;
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
        
        /* Utility classes for new table layout */
        .header-bg { background-color: #f0f0f0 !important; }
        .left-align { text-align: left !important; padding: 5px; }
        .no-border-bottom { border-bottom: none !important; }
        .no-border-top { border-top: none !important; }
      </style>
      
      <h1>개인회생채권자 목록</h1>

      <div style="margin-bottom: 20px; font-size: 14px;">
         <b>성명:</b> ${debtorInfo.name} <span style="margin: 0 10px;">|</span>
         <b>주민등록번호:</b> ${debtorInfo.birthDate}-*******
      </div>

      <h2>1. 채권 총액 및 구분 [cite: 5, 7]</h2>
      <table>
        <colgroup>
            <col width="25%" />
            <col width="25%" />
            <col width="25%" />
            <col width="25%" />
        </colgroup>
        <thead>
          <tr>
            <th>구분</th>
            <th>원금</th>
            <th>이자</th>
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="center"><b>총 합계</b></td>
            <td class="amount">${formatCurrency(totalPrincipal)}</td>
            <td class="amount">${formatCurrency(totalInterest)}</td>
            <td class="amount"><b>${formatCurrency(grandTotal)}</b></td>
          </tr>
          <tr>
            <td class="center"><b>담보부 회생채권</b></td>
            <td colspan="2" class="center">-</td>
            <td class="amount">${formatCurrency(totalSecuredPromise)}</td>
          </tr>
          <tr>
            <td class="center"><b>무담보 회생채권</b></td>
            <td colspan="2" class="center">-</td>
            <td class="amount">${formatCurrency(totalUnsecuredPromise)}</td>
          </tr>
        </tbody>
      </table>

      <h2>2. 개인회생채권자 상세 목록 [cite: 9, 10, 11, 12, 13]</h2>
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

      <h2>3. 별제권부채권 및 담보 내역</h2>
      <table>
        <colgroup>
            <col width="10%" />
            <col width="20%" />
            <col width="30%" />
            <col width="20%" />
            <col width="20%" />
        </colgroup>
        <thead>
          <tr>
            <th>채권번호</th>
            <th>채권자</th>
            <th>담보 및 목적물 내역</th>
            <th>환가예상액(70%)</th>
            <th>담보부 회생채권액</th>
          </tr>
        </thead>
        <tbody>
            ${securedRows}
        </tbody>
      </table>
      
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
      payment: data.repaymentPlan.monthlyActualAvailableIncome
    });
  }
  return schedule;
}
