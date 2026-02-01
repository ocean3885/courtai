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
  const { debtorInfo, creditors, repaymentPlan, repaymentSchedule } = data;

  const creditorRows = creditors.map((c: any) => {
    let rows = `
      <tr>
        <td>${c.number}</td>
        <td>${c.name}</td>
        <td>${formatCurrency(c.principal)}</td>
        <td>${formatCurrency(c.interest)}</td>
        <td>${formatCurrency(c.principal + c.interest)}</td>
        <td>${c.address}</td>
        <td>${c.phone}</td>
      </tr>`;

    if (c.isSubrogated && c.subrogationData) {
      rows += `
      <tr style="background-color: #e3f2fd;">
        <td>${c.subrogationData.number}</td>
        <td>${c.subrogationData.name} (대위변제자)</td>
        <td>${formatCurrency(c.subrogationData.principal)}</td>
        <td>-</td>
        <td>${formatCurrency(c.subrogationData.principal)}</td>
        <td>${c.subrogationData.address}</td>
        <td>${c.subrogationData.phone}</td>
      </tr>`;
    }
    return rows;
  }).join('');

  const totalPrincipal = creditors.reduce((sum: number, c: any) => sum + c.principal, 0);
  const totalInterest = creditors.reduce((sum: number, c: any) => sum + c.interest, 0);

  return `
    <div class="document-container">
      <style>
        @media print {
          @page { margin: 20mm; }
          body { margin: 0; }
        }
        .document-container {
          font-family: 'Malgun Gothic', sans-serif;
          line-height: 1.6;
          width: 100%;
          background: white;
          color: black;
        }
        .document-container h1 {
          text-align: center;
          font-size: 24px;
          margin-bottom: 30px;
          border-bottom: 3px solid #000;
          padding-bottom: 10px;
        }
        .document-container h2 {
          font-size: 18px;
          margin-top: 30px;
          margin-bottom: 15px;
          border-bottom: 2px solid #333;
          padding-bottom: 5px;
        }
        .document-container table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 12px;
          table-layout: fixed;
        }
        .document-container th, .document-container td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        .document-container th {
          background-color: #f0f0f0;
          font-weight: bold;
        }
        .document-container .info-section {
          margin-bottom: 20px;
        }
        .document-container .info-row {
          display: flex;
          margin-bottom: 5px;
        }
        .document-container .info-label {
          font-weight: bold;
          width: 150px;
        }
        .document-container .info-value {
          flex: 1;
        }
      </style>
      
      <h1>채권자목록 및 변제계획안</h1>

      <div class="info-section">
        <h2>1. 채무자 정보</h2>
        <div class="info-row">
          <div class="info-label">성명:</div>
          <div class="info-value">${debtorInfo.name || ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">생년월일:</div>
          <div class="info-value">${debtorInfo.birthDate || ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">주소:</div>
          <div class="info-value">${debtorInfo.address || ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">전화번호:</div>
          <div class="info-value">${debtorInfo.phone || ''}</div>
        </div>
        <div class="info-row">
          <div class="info-label">관할법원:</div>
          <div class="info-value">${debtorInfo.court || ''}</div>
        </div>
      </div>

      <h2>2. 채권자 목록</h2>
      <table>
        <thead>
          <tr>
            <th>번호</th>
            <th>채권자명</th>
            <th>원금</th>
            <th>이자</th>
            <th>합계</th>
            <th>주소</th>
            <th>전화</th>
          </tr>
        </thead>
        <tbody>
          ${creditorRows}
          <tr style="font-weight: bold; background-color: #f5f5f5;">
            <td colspan="2">합계</td>
            <td>${formatCurrency(totalPrincipal)}</td>
            <td>${formatCurrency(totalInterest)}</td>
            <td>${formatCurrency(totalPrincipal + totalInterest)}</td>
            <td colspan="2"></td>
          </tr>
        </tbody>
      </table>

      <h2>3. 변제계획</h2>
      <table>
        <tr>
          <th>변제기간</th>
          <td>${repaymentPlan.repaymentPeriod.startDate} ~ ${repaymentPlan.repaymentPeriod.endDate} (${repaymentPlan.repaymentPeriod.months}개월)</td>
        </tr>
        <tr>
          <th>수입형태</th>
          <td>${repaymentPlan.incomeType === 'wage' ? '급여소득자' : '영업소득자'}</td>
        </tr>
        <tr>
          <th>월평균수입</th>
          <td>${formatCurrency(repaymentPlan.monthlyAverageIncome)}</td>
        </tr>
        <tr>
          <th>월평균생계비</th>
          <td>${formatCurrency(repaymentPlan.monthlyAverageLivingCost)}</td>
        </tr>
        <tr>
          <th>월평균가용소득</th>
          <td>${formatCurrency(repaymentPlan.monthlyAverageAvailableIncome)}</td>
        </tr>
        <tr>
          <th>월회생위원보수</th>
          <td>${formatCurrency(repaymentPlan.monthlyTrusteeFee)}</td>
        </tr>
        <tr>
          <th>기타재단채권</th>
          <td>${formatCurrency(repaymentPlan.otherEstateClaims)}</td>
        </tr>
        <tr>
          <th>월실제가용소득</th>
          <td>${formatCurrency(repaymentPlan.monthlyActualAvailableIncome)}</td>
        </tr>
        <tr style="font-weight: bold; background-color: #fff3cd;">
          <th>총실제가용소득</th>
          <td>${formatCurrency(repaymentPlan.totalActualAvailableIncome)}</td>
        </tr>
      </table>

      <div style="margin-top: 40px; text-align: right;">
        <p>작성일: ${repaymentPlan.createDate}</p>
        <p>채무자: ${debtorInfo.name} (인)</p>
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
