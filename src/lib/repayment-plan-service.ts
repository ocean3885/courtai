import { formatCurrency, parseCurrency } from '@/app/case-input/utils';
import { generateRepaymentScheduleWithSeizedReserves } from './repayment-plan-seized-service';

export interface RepaymentPlanData {
  debtorInfo: any;
  creditors: any[];
  repaymentPlan: any;
  creationDate?: string;
}

export interface RepaymentScheduleRow {
  round: number;
  payments: { [creditorId: string]: number };
  total: number;
}

export interface CreditorTotal {
  creditorId: string;
  creditorNumber: string;
  creditorName: string;
  totalDebt: number;
  totalPayment: number;
  repaymentRate: number;
}

// 월단위 라이프니츠 수치표 (누적 계수)
// Index: 월 (0~70)
const LEIBNIZ_CUMULATIVE = [
  0,
  0.99585062, 1.98756908, 2.97517253, 3.95867804, 4.93810261,
  5.91346318, 6.88477661, 7.85205970, 8.81532916, 9.77460165,
  10.72989376, 11.68122200, 12.62860283, 13.57205261, 14.51158766,
  15.44722422, 16.37897848, 17.30686654, 18.23090443, 19.15110815,
  20.06749359, 20.98007661, 21.88887297, 22.79389839, 23.69516853,
  24.59269895, 25.48650517, 26.37660266, 27.26300680, 28.14573291,
  29.02479626, 29.90021205, 30.77199540, 31.64016139, 32.50472504,
  33.36570128, 34.22310501, 35.07695105, 35.92725416, 36.77402904,
  37.61729033, 38.45705261, 39.29333040, 40.12613816, 40.95549028,
  41.78140111, 42.60388492, 43.42295594, 44.23862832, 45.05091617,
  45.85983353, 46.66539439, 47.46761267, 48.26650224, 49.06207692,
  49.85435046, 50.64333656, 51.42904885, 52.21150093, 52.99070632,
  53.76667850, 54.53943087, 55.30897680, 56.07532959, 56.83850250,
  57.59850871, 58.35536137, 59.10907357, 59.85965832, 60.60712862
];

/**
 * 라이프니츠 계수 계산 (연 5%, 월복리, 소수점 8자리 반올림)
 */
function getLeibnizCoefficient(month: number): number {
  return 0; // Unused in new logic, but kept for interface compatibility if needed
}

/**
 * 누적 라이프니츠 계수 가져오기
 */
function getCumulativeLeibniz(month: number): number {
  if (month <= 0) return 0;
  // 표 범위 내
  if (month < LEIBNIZ_CUMULATIVE.length) {
    return LEIBNIZ_CUMULATIVE[month];
  }
  // 표 범위 초과 시 공식 사용 (연 5%, 월복리)
  const r = 0.05 / 12;
  // 공식: (1 - (1+r)^-n) / r
  const val = (1 - Math.pow(1 + r, -month)) / r;
  return Math.round(val * 100000000) / 100000000;
}

/**
 * 변제계획안 날짜 포맷팅 (예: [2024]년 [06]월 [05]일)
 */
function formatDateForPeriod(dateStr: string): string {
  if (!dateStr) return '[]년 []월 []일';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '[]년 []월 []일';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `[${y}]년 [${m}]월 [${day}]일`;
}

/**
 * 변제예정액표 생성
 */
function generateRepaymentSchedule(
  creditors: any[],
  monthlyActualAvailableIncome: number,
  repaymentCount: number,
  seizureDeposit: number = 0
): { schedule: RepaymentScheduleRow[]; creditorTotals: CreditorTotal[] } {

  const schedule: RepaymentScheduleRow[] = [];
  const creditorTotals: { [id: string]: CreditorTotal } = {};

  // 채권자별 총 채권액 및 잔액 초기화
  // 별제권부 채권의 경우 unrepayableAmount만 변제 대상
  const creditorBalances: { [id: string]: number } = {};
  creditors.forEach(c => {
    let repaymentTargetAmount = 0;

    if (c.isSecured && c.securedData) {
      // 별제권부 채권: 별제권행사등으로 변제받을 수 없는 채권액만 대상
      repaymentTargetAmount = Number(c.securedData.unrepayableAmount) || 0;
    } else {
      // 일반 채권: 원금만 대상 (이자 제외)
      const principal = Number(c.principal) || 0;
      // const interest = Number(c.interest) || 0;
      repaymentTargetAmount = principal;
    }

    creditorBalances[c.id] = repaymentTargetAmount;
    creditorTotals[c.id] = {
      creditorId: c.id,
      creditorNumber: c.number,
      creditorName: c.name,
      totalDebt: repaymentTargetAmount,
      totalPayment: 0,
      repaymentRate: 0
    };
  });

  // 우선변제권 채권자와 일반 채권자 구분
  const preferentialCreditors = creditors.filter(c => c.isPreferential);
  const regularCreditors = creditors.filter(c => !c.isPreferential);

  const hasPreferential = preferentialCreditors.length > 0;

  // 월실제가용소득 배당 (1회차부터)
  let preferentialCompleted = false;

  for (let round = 1; round <= repaymentCount; round++) {
    const roundPayments: { [id: string]: number } = {};
    let availableAmount = monthlyActualAvailableIncome;

    // 우선변제권 채권자가 남아있는 경우
    if (hasPreferential && !preferentialCompleted) {
      const preferentialRemaining = preferentialCreditors.filter(c => creditorBalances[c.id] > 0);

      if (preferentialRemaining.length > 0) {
        const totalPreferentialDebt = preferentialRemaining.reduce((sum, c) => sum + creditorBalances[c.id], 0);

        if (totalPreferentialDebt <= availableAmount) {
          // 우선변제권 채권 완납
          preferentialRemaining.forEach(c => {
            const payment = creditorBalances[c.id];
            roundPayments[c.id] = payment;
            creditorBalances[c.id] = 0;
            creditorTotals[c.id].totalPayment += payment;
            availableAmount -= payment;
          });
          preferentialCompleted = true;

          // 남은 금액을 일반 채권자에게 안분 (잔액 있는 채권자만)
          if (availableAmount > 0 && regularCreditors.length > 0) {
            const activeRegularCreditors = regularCreditors.filter(c => creditorBalances[c.id] > 0);
            if (activeRegularCreditors.length > 0) {
              const totalRegularDebt = activeRegularCreditors.reduce((sum, c) => sum + creditorBalances[c.id], 0);
              let distributedAmount = 0;

              activeRegularCreditors.forEach((c, index) => {
                if (totalRegularDebt > 0) {
                  let payment;
                  if (index === activeRegularCreditors.length - 1) {
                    // 마지막 채권자: 남은 전체 금액 할당
                    payment = availableAmount - distributedAmount;
                  } else {
                    // 비율에 따라 안분 (초기 채권액 기준)
                    const originalTotalDebt = activeRegularCreditors.reduce((sum, c) => sum + creditorTotals[c.id].totalDebt, 0);
                    const ratio = creditorTotals[c.id].totalDebt / originalTotalDebt;
                    payment = Math.floor(availableAmount * ratio);
                    distributedAmount += payment;
                  }
                  roundPayments[c.id] = payment;
                  creditorBalances[c.id] -= payment;
                  creditorTotals[c.id].totalPayment += payment;
                }
              });
            }
          }
        } else {
          // 우선변제권 채권에 전액 안분 (마지막 채권자에게 나머지 할당)
          let distributedAmount = 0;
          preferentialRemaining.forEach((c, index) => {
            let payment;
            if (index === preferentialRemaining.length - 1) {
              // 마지막 채권자: 남은 전체 금액 할당
              payment = availableAmount - distributedAmount;
            } else {
              // 비율에 따라 안분 (초기 채권액 기준)
              const originalTotalDebt = preferentialRemaining.reduce((sum, c) => sum + creditorTotals[c.id].totalDebt, 0);
              const ratio = creditorTotals[c.id].totalDebt / originalTotalDebt;
              payment = Math.floor(availableAmount * ratio);
              distributedAmount += payment;
            }
            roundPayments[c.id] = payment;
            creditorBalances[c.id] -= payment;
            creditorTotals[c.id].totalPayment += payment;
          });
        }
      } else {
        // 우선변제권 채권자 모두 완납됨
        preferentialCompleted = true;
      }
    }

    // 우선변제권이 없거나 완료된 경우 일반 배당
    if (!hasPreferential || preferentialCompleted) {
      const activeCreditors = (hasPreferential ? regularCreditors : creditors).filter(c => creditorBalances[c.id] > 0);

      if (activeCreditors.length > 0) {
        const totalDebt = activeCreditors.reduce((sum, c) => sum + creditorBalances[c.id], 0);
        let distributedAmount = 0;

        activeCreditors.forEach((c, index) => {
          if (totalDebt > 0) {
            let payment;
            if (index === activeCreditors.length - 1) {
              // 마지막 채권자: 남은 전체 금액 할당
              payment = availableAmount - distributedAmount;
            } else {
              // 비율에 따라 안분 (초기 채권액 기준)
              const originalTotalDebt = activeCreditors.reduce((sum, c) => sum + creditorTotals[c.id].totalDebt, 0);
              const ratio = creditorTotals[c.id].totalDebt / originalTotalDebt;
              payment = Math.floor(availableAmount * ratio);
              distributedAmount += payment;
            }
            roundPayments[c.id] = payment;
            creditorBalances[c.id] -= payment;
            creditorTotals[c.id].totalPayment += payment;
          }
        });
      }
    }

    schedule.push({
      round: round,
      payments: roundPayments,
      total: monthlyActualAvailableIncome
    });
  }

  // 변제율 계산
  Object.values(creditorTotals).forEach(ct => {
    ct.repaymentRate = ct.totalDebt > 0 ? (ct.totalPayment / ct.totalDebt) * 100 : 0;
  });

  return {
    schedule,
    creditorTotals: Object.values(creditorTotals)
  };
}



/**
 * 변제예정액표 테이블 생성 (회차별로 그룹화)
 */
function generateRepaymentPlanTables(
  creditors: any[],
  schedule: RepaymentScheduleRow[],
  monthlyActualAvailableIncome: number,
  repaymentCount: number,
  seizedReservesAmount: number = 0
): string {

  // 우선변제권 채권자가 있는지 확인
  const preferentialCreditors = creditors.filter(c => c.isPreferential);
  const hasPreferential = preferentialCreditors.length > 0;

  // 회차를 그룹으로 나누기
  let groups: { startRound: number; endRound: number; creditors: any[] }[] = [];

  if (hasPreferential) {
    const regularCreditors = creditors.filter(c => !c.isPreferential);

    // 우선변제권자만 배당받는 마지막 회차와 완납되는 회차 찾기
    let lastPreferentialOnlyRound = 0;
    let preferentialEndRound = 0;

    for (let i = 0; i < schedule.length; i++) {
      const row = schedule[i];
      const hasPreferentialPayment = preferentialCreditors.some(c => (row.payments[c.id] || 0) > 0);
      const hasRegularPayment = regularCreditors.some(c => (row.payments[c.id] || 0) > 0);

      if (hasPreferentialPayment) {
        preferentialEndRound = row.round;
        // 우선변제권자만 배당받는 회차
        if (!hasRegularPayment) {
          lastPreferentialOnlyRound = row.round;
        }
      }
    }

    // 그룹 1: 우선변제권자만 배당받는 회차 (1~8회차)
    if (lastPreferentialOnlyRound >= 1) {
      groups.push({
        startRound: 1,
        endRound: lastPreferentialOnlyRound,
        creditors: preferentialCreditors
      });
    }

    // 그룹 2: 우선변제권자 완납 회차 (9회차 - 모든 채권자 표시)
    if (preferentialEndRound > lastPreferentialOnlyRound) {
      groups.push({
        startRound: preferentialEndRound,
        endRound: preferentialEndRound,
        creditors: creditors // 모든 채권자
      });
    }

    // 그룹 3: 일반 채권자만 배당받는 회차 (10~36회차)
    if (regularCreditors.length > 0 && preferentialEndRound < repaymentCount) {
      groups.push({
        startRound: preferentialEndRound + 1,
        endRound: repaymentCount,
        creditors: regularCreditors
      });
    }
  } else {
    // 우선변제권 없으면 전체를 하나의 그룹으로
    groups.push({
      startRound: 1,
      endRound: repaymentCount,
      creditors: creditors
    });
  }

  // 압류적립금이 있는 경우 1회차 분리 로직 적용
  if (seizedReservesAmount > 0 && schedule.length > 1) {
    const newGroups: { startRound: number; endRound: number; creditors: any[] }[] = [];

    groups.forEach(group => {
      // 그룹이 1회차를 포함하고, 1회차보다 더 긴 경우 분리
      if (group.startRound === 1 && group.endRound > 1) {
        // 1회차 그룹
        newGroups.push({
          startRound: 1,
          endRound: 1,
          creditors: group.creditors
        });
        // 나머지 그룹 (2 ~ end)
        newGroups.push({
          startRound: 2,
          endRound: group.endRound,
          creditors: group.creditors
        });
      } else {
        newGroups.push(group);
      }
    });

    groups = newGroups;
  }

  let html = '';


  // 각 그룹별 테이블 생성
  groups.forEach(group => {
    if (group.startRound <= group.endRound) {
      html += generateSingleRepaymentTable(
        group.startRound,
        group.endRound,
        group.creditors,
        schedule,
        monthlyActualAvailableIncome
      );
    }
  });

  // [수정] 총 변제예정액표 추가 (전체 기간 및 전체 채권자 합산)
  html += generateSingleRepaymentTable(
    1,
    repaymentCount,
    creditors, // 전체 채권자 포함
    schedule,
    monthlyActualAvailableIncome,
    "총 변제예정액 산정내역",
    true
  );

  return html;
}

/**
 * 단일 변제예정액 테이블 생성
 */
function generateSingleRepaymentTable(
  startRound: number,
  endRound: number,
  tableCreditors: any[],
  schedule: RepaymentScheduleRow[],
  monthlyActualAvailableIncome: number,
  customTitle?: string,
  hideMonthlyPayment: boolean = false
): string {

  const roundCount = endRound - startRound + 1;

  // 각 채권자별 데이터 계산
  const creditorData = tableCreditors.map(c => {
    let confirmedDebt = 0;
    let unconfirmedDebt = 0;
    let isUnconfirmed = false; // 별제권부 채권 여부

    if (c.isSecured && c.securedData) {
      // 별제권부 채권: 미확정채권액으로 처리
      unconfirmedDebt = Number(c.securedData.unrepayableAmount) || 0;
      confirmedDebt = 0;
      isUnconfirmed = true;
    } else {
      // 일반 채권: 확정채권액으로 처리 (원금만)
      const principal = Number(c.principal) || 0;
      // const interest = Number(c.interest) || 0;
      confirmedDebt = principal;
      unconfirmedDebt = 0;
      isUnconfirmed = false;
    }

    const totalDebt = confirmedDebt + unconfirmedDebt;

    // 해당 회차 범위의 총 변제액 계산
    let totalPayment = 0;
    for (let round = startRound; round <= endRound; round++) {
      const roundData = schedule.find(s => s.round === round);
      if (roundData) {
        totalPayment += roundData.payments[c.id] || 0;
      }
    }

    const monthlyPayment = roundCount > 0 ? totalPayment / roundCount : 0;

    return {
      number: c.number,
      name: c.name,
      confirmedDebt: confirmedDebt,
      unconfirmedDebt: unconfirmedDebt,
      totalDebt: totalDebt,
      monthlyPayment: monthlyPayment,
      totalPayment: totalPayment,
      isUnconfirmed: isUnconfirmed
    };
  });

  // 합계 계산
  const sumConfirmedDebt = creditorData.reduce((sum, c) => sum + c.confirmedDebt, 0);
  const sumUnconfirmedDebt = creditorData.reduce((sum, c) => sum + c.unconfirmedDebt, 0);
  const sumTotalDebt = creditorData.reduce((sum, c) => sum + c.totalDebt, 0);

  // 월변제 합계 (확정/미확정 구분)
  const sumConfirmedMonthlyPayment = creditorData.filter(c => !c.isUnconfirmed).reduce((sum, c) => sum + c.monthlyPayment, 0);
  const sumUnconfirmedMonthlyPayment = creditorData.filter(c => c.isUnconfirmed).reduce((sum, c) => sum + c.monthlyPayment, 0);
  const sumMonthlyPayment = creditorData.reduce((sum, c) => sum + c.monthlyPayment, 0);

  // 총변제 합계 (확정/미확정 구분)
  const sumConfirmedTotalPayment = creditorData.filter(c => !c.isUnconfirmed).reduce((sum, c) => sum + c.totalPayment, 0);
  const sumUnconfirmedTotalPayment = creditorData.filter(c => c.isUnconfirmed).reduce((sum, c) => sum + c.totalPayment, 0);
  const sumTotalPayment = creditorData.reduce((sum, c) => sum + c.totalPayment, 0);

  const title = customTitle
    ? customTitle
    : (startRound === endRound
      ? `제 ${startRound} 회차 변제예정액`
      : `제 ${startRound} 회차 ~ 제 ${endRound} 회차 변제예정액`);

  // Column Width Management
  const colWidthNumber = "8%";
  const colWidthName = hideMonthlyPayment ? "22%" : "17%";
  const colWidthDebt = hideMonthlyPayment ? "35%" : "25%";
  const colWidthMonthly = "25%";
  const colWidthTotal = hideMonthlyPayment ? "35%" : "25%";

  return `
    <div style="font-weight: bold; margin-bottom: 5px; margin-top: 20px;">
      ${title}
    </div>
    <table class="repayment-plan">
      <thead>
        <tr>
          <th rowspan="2" style="width: ${colWidthNumber};">채권<br>번호</th>
          <th rowspan="2" style="width: ${colWidthName};">채권자</th>
          <th colspan="2" style="width: ${colWidthDebt};">(D)개인회생채권액</th>
          ${!hideMonthlyPayment ? `<th colspan="2" style="width: ${colWidthMonthly};">(E)월변제예정(유보)액</th>` : ''}
          <th colspan="2" style="width: ${colWidthTotal};">(F)총변제예정(유보)액</th>
        </tr>
        <tr>
          <th>확정<br>채권액</th>
          <th>미확정<br>채권액</th>
          ${!hideMonthlyPayment ? `<th>확정<br>채권액</th>
          <th>미확정<br>채권액</th>` : ''}
          <th>확정<br>채권액</th>
          <th>미확정<br>채권액</th>
        </tr>
      </thead>
      <tbody>
        ${creditorData.map(c => `
          <tr>
            <td class="center">${c.number}</td>
            <td>${c.name}</td>
            <td class="text-right" style="white-space: nowrap;">${c.confirmedDebt > 0 ? formatCurrency(c.confirmedDebt) : '0'}</td>
            <td class="text-right" style="white-space: nowrap;">${c.unconfirmedDebt > 0 ? formatCurrency(c.unconfirmedDebt) : '0'}</td>
            ${!hideMonthlyPayment ? `<td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? '0' : formatCurrency(Math.floor(c.monthlyPayment))}</td>
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? formatCurrency(Math.floor(c.monthlyPayment)) : '0'}</td>` : ''}
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? '0' : formatCurrency(c.totalPayment)}</td>
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? formatCurrency(c.totalPayment) : '0'}</td>
          </tr>
        `).join('')}
        <tr style="font-weight: bold; background-color: #f3f4f6;">
          <th colspan="2">합계</th>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumConfirmedDebt)}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumUnconfirmedDebt)}</td>
          ${!hideMonthlyPayment ? `<td class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumConfirmedMonthlyPayment))}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumUnconfirmedMonthlyPayment))}</td>` : ''}
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumConfirmedTotalPayment)}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumUnconfirmedTotalPayment)}</td>
        </tr>
        <tr style="font-weight: bold; background-color: #e5e7eb;">
          <th colspan="2">총계</th>
          <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(sumTotalDebt)}</td>
          ${!hideMonthlyPayment ? `<td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumMonthlyPayment))}</td>` : ''}
          <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(sumTotalPayment)}</td>
        </tr>
      </tbody>
    </table>
  `;
}

/**
 * 변제계획안 HTML 생성
 */
export function generateRepaymentPlanHTML(data: RepaymentPlanData): string {
  const { debtorInfo, creditors: inputCreditors, repaymentPlan, creationDate } = data;

  // 대위변제자(구상권자)를 포함한 전체 채권자 목록 생성
  const creditors: any[] = [];
  inputCreditors.forEach((c: any) => {
    // 1. 원채권자 추가 (대위변제 여부와 상관없이 무조건 추가 - 잔존 채권액이 있다면 합산됨)
    creditors.push(c);

    // 2. 대위변제자 정보 처리 (다수 대위변제자 지원)
    // Support multiple subrogated creditors (subrogatedList) or single legacy (subrogationData)
    const subList = c.subrogatedList && c.subrogatedList.length > 0
      ? c.subrogatedList
      : (c.isSubrogated && c.subrogationData ? [c.subrogationData] : []);

    if (subList.length > 0) {
      subList.forEach((sub: any) => {
        // 손해금(damages) 제외 요청으로 원금만 포함
        const principal = Number(sub.principal) || 0;
        // const damages = Number(sub.damages) || 0;

        creditors.push({
          id: sub.id, // ID must be unique
          number: sub.number,
          name: sub.name,
          principal: principal,
          interest: Number(sub.interest) || 0,
          isSecured: false, // 대위변제 채권은 일반적으로 일반회생채권
          isPreferential: false,
          securedData: null
        });
      });
    }
  });

  // 총 채권액 계산
  // 별제권부 채권인 경우: 별제권행사 등으로 변제받을 수 없는 채권액(unrepayableAmount)만 합산
  // 그 외: 원금(principal) 합산
  let totalDebt = 0;
  creditors.forEach((c: any) => {
    if (c.isSecured && c.securedData) {
      const unrepayableAmount = Number(c.securedData.unrepayableAmount) || 0;
      totalDebt += unrepayableAmount;
    } else {
      const principal = Number(c.principal) || 0;
      // const interest = Number(c.interest) || 0;
      totalDebt += principal;
    }
  });

  const repaymentPeriodMonths = repaymentPlan?.repaymentPeriod?.months || 36;
  const startYMD = repaymentPlan?.repaymentPeriod?.startDate || '';
  const endYMD = repaymentPlan?.repaymentPeriod?.endDate || '';
  const formattedStart = formatDateForPeriod(startYMD);
  const formattedEnd = formatDateForPeriod(endYMD);

  const monthlyPayment = repaymentPlan?.monthlyActualAvailableIncome || 0;
  const totalRepaymentAmount = monthlyPayment * repaymentPeriodMonths;
  const repaymentRate = totalDebt > 0 ? ((totalRepaymentAmount / totalDebt) * 100).toFixed(2) : '0.00';
  const liquidationValue = Number(repaymentPlan?.liquidationValue) || 0;

  // 가용소득 관련 데이터
  const monthlyAverageIncome = repaymentPlan?.monthlyAverageIncome || 0;
  const monthlyAverageLivingCost = repaymentPlan?.monthlyAverageLivingCost || 0;
  const monthlyAverageAvailableIncome = repaymentPlan?.monthlyAverageAvailableIncome || 0;
  const monthlyTrusteeFee = repaymentPlan?.monthlyTrusteeFee || 0;
  const otherEstateClaims = repaymentPlan?.otherEstateClaims || 0;
  const monthlyActualAvailableIncome = repaymentPlan?.monthlyActualAvailableIncome || 0;
  const repaymentCount = repaymentPlan?.repaymentCount || repaymentPeriodMonths;
  const totalActualAvailableIncome = repaymentPlan?.totalActualAvailableIncome || (monthlyActualAvailableIncome * repaymentCount);

  // 압류적립금 관련 데이터
  const seizedReservesStatus = repaymentPlan?.seizedReservesStatus || 'no';
  const seizedReservesAmount = repaymentPlan?.seizedReservesAmount || 0;
  // Ensure strict number comparison
  const hasSeizedReserves = seizedReservesStatus === 'yes' && Number(seizedReservesAmount) > 0;

  // 회생위원 보수 및 파산재단 채권 데이터
  const preConfirmationFee = Number(repaymentPlan?.trusteeFee?.preConfirmation) || 0;
  const postConfirmationRate = Number(repaymentPlan?.trusteeFee?.postConfirmationRate) || 0;
  // otherEstateClaims defined above

  const hasPreConfirmationFee = preConfirmationFee > 0;
  const hasPostConfirmationFee = postConfirmationRate > 0;
  const hasTrusteeFee = hasPreConfirmationFee || hasPostConfirmationFee;
  const hasOtherClaims = otherEstateClaims > 0;
  const hasEstateClaims = hasTrusteeFee || hasOtherClaims;

  console.log(`[RepaymentPlan] Checking Seized Reserves: Status=${seizedReservesStatus}, Amount=${seizedReservesAmount}, HasSeized=${hasSeizedReserves}`);

  // 압류적립금 계산 (화면 표시용)
  let seizedCalculationHtml = '';
  if (hasSeizedReserves) {
    const seizedAmount = Number(seizedReservesAmount);
    const totalIncome = Number(totalActualAvailableIncome);
    const adjustedTotalIncome = totalIncome - seizedAmount;
    const adjustedMonthlyIncome = repaymentCount > 1 ? Math.ceil(adjustedTotalIncome / (repaymentCount - 1)) : 0;

    seizedCalculationHtml = `
      <div style="margin-top: 10px; margin-bottom: 5px; font-weight: bold; font-size: 14px;">※ 압류적립금이 있는 경우의 가용소득 산정</div>
      <table class="income-table">
        <tr>
          <th class="wide-cell">압류적립금</th>
          <th class="wide-cell">수정된 총가용소득<br>( ⑧ - 압류적립금 )</th>
          <th class="wide-cell">수정된 월실제가용소득<br>( 수정된 총가용소득 / ${repaymentCount - 1}회 )</th>
        </tr>
        <tr>
          <td>${formatCurrency(seizedAmount)}</td>
          <td>${formatCurrency(adjustedTotalIncome)}</td>
          <td>${formatCurrency(adjustedMonthlyIncome)}</td>
        </tr>
      </table>
      <div style="font-size: 12px; color: #666; margin-top: 5px;">
        * 1회차는 압류적립금을 변제재원으로 사용하고, 2회차부터 수정된 월실제가용소득을 변제재원으로 사용함.
      </div>
     `;
  }

  // 변제예정액표 생성 (압류적립금 여부에 따라 다른 함수 호출)
  const { schedule, creditorTotals } = hasSeizedReserves
    ? generateRepaymentScheduleWithSeizedReserves(
      creditors,
      monthlyActualAvailableIncome,
      repaymentCount,
      seizedReservesAmount
    )
    : generateRepaymentSchedule(
      creditors,
      monthlyActualAvailableIncome,
      repaymentCount,
      0
    );

  // 총합계 계산 (섹션 4용) - 스케줄 기반 재계산
  // creditorTotals의 totalPayment대신 schedule을 순회하며 합산하여 섹션 3의 표와 100% 일치시킴
  const scheduleBasedTotals: { [id: string]: number } = {};
  schedule.forEach(row => {
    creditors.forEach(c => {
      const payment = row.payments[c.id] || 0;
      scheduleBasedTotals[c.id] = (scheduleBasedTotals[c.id] || 0) + payment;
    });
  });

  let section4SumConfirmedDebt = 0;
  let section4SumUnconfirmedDebt = 0;
  let section4SumConfirmedPayment = 0;
  let section4SumUnconfirmedPayment = 0;

  creditorTotals.forEach(ct => {
    const creditor = creditors.find(c => c.id === ct.creditorId);
    const isSecured = creditor?.isSecured || false;

    // ct.totalDebt는 이미 generateRepaymentSchedule에서 계산됨
    // 별제권부 채권: unrepayableAmount
    // 일반 채권: principal + interest
    const debtAmount = ct.totalDebt;

    // 스케줄에서 집계한 총 변제액 사용
    const finalTotalPayment = scheduleBasedTotals[ct.creditorId] || 0;

    // creditorTotals 객체 업데이트 (화면 표시용)
    ct.totalPayment = finalTotalPayment;

    if (isSecured) {
      section4SumUnconfirmedDebt += debtAmount;
      section4SumUnconfirmedPayment += finalTotalPayment;
    } else {
      section4SumConfirmedDebt += debtAmount;
      section4SumConfirmedPayment += finalTotalPayment;
    }
  });

  const section4GrandTotalDebt = section4SumConfirmedDebt + section4SumUnconfirmedDebt;
  const section4GrandTotalPayment = section4SumConfirmedPayment + section4SumUnconfirmedPayment;

  // Calculate Present Value (Split: Saving Period + Input Period)
  // Calculate Present Value (Split: Saving Period + Input Period)
  let savingPeriodMonths = 0;
  let savingAmountA = 0;
  let inputPeriodMonths = 0;
  let inputAmountB = 0;

  if (hasSeizedReserves) {
    // 압류적립금이 있는 경우: 1회차(압류적립금) + 나머지 회차(수정된 가용소득)
    savingPeriodMonths = 1;
    savingAmountA = Number(seizedReservesAmount);

    inputPeriodMonths = repaymentCount - 1;

    if (inputPeriodMonths > 0) {
      const seizedAmount = Number(seizedReservesAmount);
      const totalIncome = Number(totalActualAvailableIncome);
      const adjustedTotalIncome = totalIncome - seizedAmount;
      // 2회차부터의 월 변제액 (위쪽 계산 로직과 동일하게 Math.ceil 사용)
      const adjustedMonthlyIncome = Math.ceil(adjustedTotalIncome / inputPeriodMonths);

      // 라이프니츠 계수 적용 (2회차 ~ 마지막 회차)
      const leibnizTotal = getCumulativeLeibniz(repaymentCount);
      const leibnizFirst = getCumulativeLeibniz(1);
      const leibnizFactor = leibnizTotal - leibnizFirst;

      inputAmountB = Math.floor(adjustedMonthlyIncome * leibnizFactor);
    } else {
      inputAmountB = 0;
    }
  } else {
    // 일반적인 경우: 3개월 적립기간 후 나머지 기간 라이프니츠 계수 적용
    const defaultSavingMonths = 3;

    if (repaymentCount <= defaultSavingMonths) {
      // 변제기간이 3개월 이하인 경우 전액 적립기간으로 처리
      savingPeriodMonths = repaymentCount;
      savingAmountA = monthlyActualAvailableIncome * repaymentCount;
      inputPeriodMonths = 0;
      inputAmountB = 0;
    } else {
      // 3개월 초과 시
      savingPeriodMonths = defaultSavingMonths;
      savingAmountA = monthlyActualAvailableIncome * savingPeriodMonths;
      inputPeriodMonths = repaymentCount - savingPeriodMonths;

      // 누적 라이프니츠 계수 차이를 이용 (4개월차 ~ 마지막개월차 계수의 합)
      const leibnizTotal = getCumulativeLeibniz(repaymentCount);
      const leibnizSaving = getCumulativeLeibniz(savingPeriodMonths);
      const leibnizFactor = leibnizTotal - leibnizSaving;

      inputAmountB = Math.floor(monthlyActualAvailableIncome * leibnizFactor);
    }
  }

  const calculatedPresentValue = savingAmountA + inputAmountB;

  // 우선변제권 채권 필터링 및 데이터 준비
  const preferentialCreditors = creditors.filter(c => c.isPreferential);
  const hasPreferential = preferentialCreditors.length > 0;

  // 별제권부 채권 필터링 및 계산
  const securedCreditors = creditors.filter((c: any) => c.isSecured);
  const hasSecuredCreditors = securedCreditors.length > 0;

  let securedRows = '';
  let securedTotalPrincipal = 0;
  let securedTotalInterest = 0;
  let securedTotalExpectedRepayment = 0;
  let securedTotalUnrepayable = 0;
  let securedTotalRehabilitationAmount = 0;

  if (hasSecuredCreditors) {
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
  }

  return `
    <div class="document-container">
      <style>
        @media print {
          @page { 
            margin: 15mm;
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
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          table { 
            page-break-inside: auto;
          }
          .income-table, .repayment-plan {
            width: 99% !important;
            margin: 0 auto !important;
          }
          .top-tables {
            display: flex !important;
            justify-content: space-between !important;
          }
          thead {
            display: table-row-group; /* 인쇄 시 헤더 반복 방지 */
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
        }
        
        .document-container {
          font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
          line-height: 1.6;
          color: black;
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
          margin-bottom: 15px;
          font-weight: bold;
        }
        
        .document-container h3 {
          font-size: 16px;
          margin-top: 20px;
          margin-bottom: 10px;
          font-weight: bold;
        }
        
        .document-container table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
        }
        
        .document-container th, .document-container td {
          border: 1px solid #444;
          padding: 8px;
          vertical-align: middle;
        }
        
        .document-container th {
          background-color: #f8f9fa;
          font-weight: bold;
          text-align: center;
        }

        .document-container .center { text-align: center; }
        .document-container .text-right { text-align: right; padding-right: 8px; }
        .document-container .text-left { text-align: left; padding-left: 8px; }
        
        .income-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 0;
          font-size: 13px;
        }
        
        .income-table th,
        .income-table td {
          border: 1px solid #444;
          padding: 10px 8px;
          text-align: center;
          vertical-align: middle;
        }
        
        .income-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        
        .income-table .wide-cell {
          width: 33.33%;
        }
        
        .repayment-plan {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
          font-size: 13px;
          table-layout: fixed; /* 표 레이아웃 고정 */
        }
        
        .repayment-plan th,
        .repayment-plan td {
          border: 1px solid #444;
          padding: 8px;
          text-align: center;
          vertical-align: middle;
          word-break: break-all; /* 너무 긴 텍스트 줄바꿈 */
        }
        
        .repayment-plan th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        
        .repayment-plan .text-right {
          text-align: right !important;
          padding-right: 8px;
        }
        
        .repayment-plan .center {
          text-align: center !important;
        }

        /* New Styles for Section 2 */
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-top: 30px;
          margin-bottom: 15px;
        }
        .sub-section {
          margin-left: 10px;
          margin-bottom: 20px;
        }
        .sub-title {
          font-weight: bold;
          margin-bottom: 10px;
        }
        .info-box {
          margin-bottom: 15px;
        }
        .check-item {
          margin-bottom: 5px;
        }

        .calculation-container {
          margin-top: 20px;
        }
        .top-tables {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 20px;
        }
        .basis-table {
           width: 100%;
           border-collapse: collapse;
           margin-top: 10px;
        }
        .basis-table th, .basis-table td {
           border: 1px solid #444;
           padding: 8px;
           text-align: center;
        }
        .bg-gray {
           background-color: #f8f9fa;
        }
        .underline {
          text-decoration: underline;
        }
        .note {
          font-size: 12px;
          margin-top: 5px;
          color: #666;
        }
      </style>
      
      <h1>변제계획안</h1>

      <div style="margin-bottom: 5px; font-size: 14px;">
         <b>성명:</b> ${debtorInfo.name} <span style="margin: 0 10px;">|</span>
         <b>생년월일:</b> ${debtorInfo.birthDate}
      </div>
      ${creationDate ? `<div style="text-align: right; margin-bottom: 15px; font-size: 13px;"><b>작성일:</b> ${creationDate}</div>` : ''}

      <h2>1. 변제기간</h2>
      <div style="margin-left: 10px; margin-bottom: 20px;">
        ${formattedStart}부터 ${formattedEnd}까지 [${repaymentPeriodMonths}]개월간
      </div>

      <div class="section-title">2. 변제에 제공되는 소득 또는 재산</div>

      <div class="sub-section">
          <div class="sub-title">가. 소득</div>
          
          <div class="info-box">
          <div class="info-box">
              <div class="sub-title">(1) 수입</div>
              
              ${(() => {
      // 수입 상세 내역 파싱 (급여및운영일 경우)
      let wageName = '';
      let wageAmount = 0;
      let businessName = '';
      let businessAmount = 0;

      const incomeType = repaymentPlan?.incomeType;

      if (incomeType === 'wage') {
        wageName = repaymentPlan?.companyName || '';
        wageAmount = monthlyAverageIncome;
      } else if (incomeType === 'business') {
        businessName = repaymentPlan?.companyName || '';
        businessAmount = monthlyAverageIncome;
      } else if (incomeType === 'wageAndBusiness') {
        // 1. JSON 파싱 시도 (모달 입력)
        let parsed = false;
        if (repaymentPlan?.monthlyIncomeDetails) {
          try {
            // JSON 형식 체크
            if (repaymentPlan.monthlyIncomeDetails.trim().startsWith('{')) {
              const details = JSON.parse(repaymentPlan.monthlyIncomeDetails);
              wageName = details.wage?.name || '';
              wageAmount = Number(details.wage?.amount) || 0;
              businessName = details.business?.name || '';
              businessAmount = Number(details.business?.amount) || 0;
              parsed = true;
            } else if (repaymentPlan.monthlyIncomeDetails.includes('+')) {
              // 구버전: "100+200" 형식 (단순 금액 분리)
              const amounts = repaymentPlan.monthlyIncomeDetails.split('+').map((s: string) => parseCurrency(s));
              wageAmount = amounts[0] || 0;
              businessAmount = amounts[1] || 0;

              // 업체명 분리 (콤마 기준)
              const companies = (repaymentPlan?.companyName || '').split(',');
              wageName = companies[0] ? companies[0].trim() : '';
              businessName = companies[1] ? companies[1].trim() : '';
              parsed = true;
            }
          } catch (e) {
            console.error('Income details parse error', e);
          }
        }

        if (!parsed) {
          // Fallback
          const companies = (repaymentPlan?.companyName || '').split(',');
          wageName = companies[0] ? companies[0].trim() : '';
          businessName = companies[1] ? companies[1].trim() : '';
          wageAmount = monthlyAverageIncome; // 금액 분리 불가시 전액 표시? 일단 0으로 처리하거나 이슈
        }
      }

      const isWageChecked = incomeType === 'wage' || incomeType === 'wageAndBusiness';
      const isBusinessChecked = incomeType === 'business' || incomeType === 'wageAndBusiness';

      return `
                  <div class="check-item">${isWageChecked ? '■' : '□'} 변제기간 동안 [ ${isWageChecked ? wageName : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ]에서 받는 월 평균 수입 [ ${isWageChecked ? formatCurrency(wageAmount) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ]원</div>
                  <div class="check-item">${isBusinessChecked ? '■' : '□'} 변제기간 동안 [ ${isBusinessChecked ? businessName : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ]를 운영하여 얻는 월 평균 수입 <span class="underline">[${isBusinessChecked ? formatCurrency(businessAmount) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}]원</span></div>
                `;
    })()}
          </div>

          <div class="info-box">
              <div class="sub-title">(2) 채무자 및 피부양자의 생활에 필요한 생계비</div>
              <div>(가) 채무자 및 피부양자 : 총 <span class="underline">[${repaymentPlan?.dependentsCount || 0}]명</span></div>
              <div>(나) 국민기초생활보장법에 의한 기준 중위소득 : 월 <span class="underline">[${formatCurrency(repaymentPlan?.standardMedianIncome || 0)}] 원</span></div>
              <div>(다) 채무자 회생 및 파산에 관한 법률에 따라 조정된 생계비 : 월 <span class="underline">[${formatCurrency(monthlyAverageLivingCost)}]원</span></div>
          </div>

          <div class="info-box">
              <div class="sub-title">(3) 채무자의 가용소득</div>
              <div>기간 : ${formattedStart}부터 ${formattedEnd}까지</div>
              <table class="income-table" style="margin-top: 5px;">
                  <thead>
                      <tr>
                          <th>① 월 평균<br>수입</th>
                          <th>② 월 평균<br>생계비</th>
                          <th>③ 월 평균<br>가용소득<br>(① - ②)</th>
                          <th>④ 월<br>회생위원<br>보수</th>
                          <th>⑤ 월 실제<br>가용소득<br>(③ - ④)</th>
                          <th>⑥ 변제 횟수<br>(월 단위로<br>환산)</th>
                          <th>⑦ 총 실제<br>가용소득<br>(⑤ x ⑥)</th>
                      </tr>
                  </thead>
                  <tbody>
                      <tr>
                          <td>${formatCurrency(monthlyAverageIncome)}</td>
                          <td>${formatCurrency(monthlyAverageLivingCost)}</td>
                          <td>${formatCurrency(monthlyAverageAvailableIncome)}</td>
                          <td>${formatCurrency(monthlyTrusteeFee)}</td>
                          <td>${formatCurrency(monthlyActualAvailableIncome)}</td>
                          <td>${repaymentCount}</td>
                          <td>${formatCurrency(totalActualAvailableIncome)}</td>
                      </tr>
                  </tbody>
              </table>
              <div class="note">
                  ☞ 변제율 100%인 경우 마지막 회차의 월 평균 가용소득은 개인회생채권 변제예정액표의 마지막 회차 월 변제예정(유보)액 금액과 같음(다만, 외부 회생위원 선임사건의 경우 인가결정 이후 업무에 대한 보수가 포함되어야 함)
              </div>
              ${seizedCalculationHtml}
          </div>
      </div>

      <div class="sub-section">
          <div class="sub-title">나. 재산 : [ 해당 있음 □ / 해당 없음 ■ ]</div>
          <table class="income-table">
              <thead>
                  <tr>
                      <th>변제에 제공할 처분대상 재산</th>
                      <th>변제기한</th>
                      <th>변제투입예정액</th>
                      <th>회생위원보수</th>
                      <th>실제<br>변제투입예정액</th>
                  </tr>
              </thead>
              <tbody>
                  <tr>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                  </tr>
              </tbody>
          </table>
      </div>
      


      <div class="section-title">3. 개인회생재단채권에 대한 변제 [ 해당 있음 ${hasEstateClaims ? '■' : '□'} / 해당 없음 ${!hasEstateClaims ? '■' : '□'} ]</div>

      <div class="sub-section">
          <div class="sub-title">가. 회생위원의 보수 및 비용 [ 해당 있음 ${hasTrusteeFee ? '■' : '□'} / 해당 없음 ${!hasTrusteeFee ? '■' : '□'} ]</div>
          <div class="check-item">
              ${hasPreConfirmationFee ? '■' : '□'} 인가결정 이전 업무에 대한 보수로 변제계획 인가 후 [ ${hasPreConfirmationFee ? formatCurrency(preConfirmationFee) : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'} ]원을 지급
          </div>
          <div class="check-item">
              ${hasPostConfirmationFee ? '■' : '□'} 인가결정 이후 업무에 대한 보수로 변제계획 인가 후 [ 채무자가 인가된 변제 계획에 따라 임치한 금원의 ${hasPostConfirmationFee ? postConfirmationRate : ''}% ]를 지급
          </div>
      </div>

      <div class="sub-section">
          <div class="sub-title">나. 기타 개인회생재단채권 [ 해당 있음 ${hasOtherClaims ? '■' : '□'} / 해당 없음 ${!hasOtherClaims ? '■' : '□'} ]</div>
          ${hasOtherClaims ? `<div class="check-item" style="margin-left: 10px;">- 기타 재단채권액: ${formatCurrency(otherEstateClaims)}원</div>` : ''}
      </div>

      <h2>4. 일반의 우선권 있는 개인회생채권에 대한 변제 [ 해당있음 ${hasPreferential ? '■' : '□'} / 해당없음 ${!hasPreferential ? '■' : '□'} ]</h2>
      <div class="sub-section">
          <div class="sub-title">(1) 채권의 내용</div>
          <table class="income-table">
              <thead>
                  <tr>
                      <th style="width: 25%;">채권자</th>
                      <th style="width: 25%;">채권현재액</th>
                      <th>채권발생원인</th>
                  </tr>
              </thead>
              <tbody>
                  ${hasPreferential ? preferentialCreditors.map((c: any) => `
                  <tr>
                      <td class="center">${c.name}</td>
                      <td class="text-right">${formatCurrency(c.principal + (c.interest || 0))}원</td>
                      <td class="text-left">${c.reason}</td>
                  </tr>
                  `).join('') : `
                  <tr>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                      <td>&nbsp;</td>
                  </tr>
                  `}
              </tbody>
          </table>
          
          <div style="margin-top: 15px;">
              <div class="sub-title">(2) 변제방법</div>
              <div class="check-item" style="margin-left: 10px; line-height: 1.6;">
                  변제계획 인가일 직후 최초 도래하는 변제기일에 원리금 전액을 우선하여 변제한다. 남은 채권이 있을 경우에는 일반 개인회생채권의 매 변제기일에 우선하여 변제한다.
              </div>
          </div>
      </div>

      <h2>5. 별제권부채권 및 이에 준하는 채권의 처리 [ 해당있음 ${hasSecuredCreditors ? '■' : '□'} / 해당없음 ${!hasSecuredCreditors ? '■' : '□'} ]</h2>
      
      <div class="sub-section">
          <div class="sub-title">가. 채권의 내용</div>
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
                ${hasSecuredCreditors ? securedRows : `
                <tr>
                    <td colspan="6" class="center" style="padding: 20px; color: #666;">해당 사항 없음</td>
                </tr>
                `}
            </tbody>
          </table>
      </div>

      <div class="sub-section">
          <div class="sub-title">나. 변제방법</div>
          <div class="check-item" style="margin-left: 10px; margin-bottom: 8px; line-height: 1.5;">
              (1) 위 각 채권에 대하여 별제권 행사 등으로도 변제가 예상되는 채권액(③)은 별제권 행사등에 의한 방법으로 변제하고 이 변제계획상의 가용소득이나 재산처분에 의한 변제대상에서 제외한다.
          </div>
          <div class="check-item" style="margin-left: 10px; margin-bottom: 8px; line-height: 1.5;">
              (2) 위 (1)항 기재 각 채권 중 별제권 행사 등으로도 변제받을 수 없을 채권액(④)은 미확정채권으로 보아 유보하였다가 아래 7항 기재와 같은 방법으로 변제한다.
          </div>
          <div class="check-item" style="margin-left: 10px; margin-bottom: 8px; line-height: 1.5;">
              (3) 별제권 행사 등으로도 변제받을 수 없을 채권액이 위 가의 ④항 기재 금액을 초과하는 것으로 확정된 경우에는, 채권자가 그 초과부분을 변제계획안의 변경 절차를 통하여 변제받을 수 있다.
          </div>
      </div>

      <h2>6. 일반 개인회생채권에 대한 변제</h2>
      
      <div class="sub-section">
          <div class="sub-title">가. 가용소득에 의한 변제</div>
          
          <div class="info-box">
              <div class="sub-title">(1) 월 변제예정(유보)액 및 총 변제예정(유보)액의 산정</div>
              <div style="line-height: 1.8; margin-bottom: 10px;">
                  각 일반 개인회생채권의 [ 원금 ]의 액수를 기준으로 월 평균가용소득에서 회생위원보수를 차감한 월 실제 가용소득을 안분하여 산출한 금액을 각 일반 개인회생채권자에게 변제한다. 이를 기초로 산정한 월 변제예정(유보)액은 제1회부터 제${repaymentCount}회까지 월 [ ${formatCurrency(monthlyActualAvailableIncome)} ]원으로 하고 총 변제예정액은 [ ${formatCurrency(totalActualAvailableIncome)} ]원이다.<br>
                  구체적 산정 내역은 별지 개인회생채권 변제예정액 표 참조.
              </div>
          </div>

          <div class="info-box">
              <div class="sub-title">(2) 변제방법</div>
              <div style="margin-bottom: 10px;">위 (1)항의 변제예정(유보)액은 다음과 같이 분할하여 변제한다.</div>
              
              <div style="margin-bottom: 10px;">
                  <div>(가) 기간 및 횟수</div>
                  <div style="margin-left: 10px; margin-top: 5px;">
                       ${formattedStart}부터 ${formattedEnd}까지 [ ${repaymentPeriodMonths} ]개월간
                  </div>
              </div>

              <div>
                  <div>(나) 변제월 및 변제일</div>
                  <div style="margin-left: 10px; margin-top: 5px;">
                      <div style="margin-bottom: 8px;">
                          ① ${formattedStart}부터 변제계획인가일 직전 [ ${new Date(startYMD).getDate()} ]일까지 기간
                      </div>
                      <div class="check-item">
                          ■ 변제계획인가일 직후 최초 도래하는 월의 [ ${new Date(startYMD).getDate()} ]일에 위 기간 동안의 변제분을 개인회생절차개시후 변제계획 인가 전에 적립된 가용소득으로 일시에 조기 변제
                      </div>
                      <div class="check-item">
                          □ 기타 : [ ]
                      </div>

                      <div style="margin-top: 15px; margin-bottom: 8px;">
                          ② 변제계획인가일 직후 최초 도래하는 월의 [ ${new Date(startYMD).getDate()} ]일부터 ${formattedEnd}까지 기간
                      </div>
                      <div class="check-item">
                          ■ 매월마다 [ ${new Date(startYMD).getDate()} ]일에 변제
                      </div>
                      <div class="check-item">
                          □ 매 [ ]개월마다 [ ]일에 각 변제
                      </div>
                      <div class="check-item">
                          □ 기타 : [ ]
                      </div>
                  </div>
              </div>
          </div>
      </div>

      <div class="sub-section">
          <div class="sub-title">나. 재산의 처분에 의한 변제 [ 해당있음 □ / 해당없음 ■ ]</div>
      </div>

      <h2>7. 미확정 개인회생채권에 대한 조치 [ 해당있음 ${hasSecuredCreditors ? '■' : '□'} / 해당없음 ${hasSecuredCreditors ? '□' : '■'} ]</h2>
      ${hasSecuredCreditors ? `
      <div class="sub-section">
          <div class="sub-title">가. 변제금액의 유보</div>
          <div class="info-box">
              (1) 미확정 개인회생채권에 대하여는 변제를 유보하고, 별제 개인회생채권 변제예정액표에 기재한 금액을 당해 채권이 확정될 때까지 유보하여 둔다.<br>
              (2) 채무자는 위와 같이 유보한 금액도, 즉시 지급되는 다른 채권에 대한 변제금과 마찬가지로 아래 8항 기재 계좌에 입금한다.
          </div>

          <div class="sub-title">나. 미확정 개인회생채권에 대한 변제</div>
          <div class="info-box">
              <div style="font-weight: bold; margin-bottom: 5px;">(1) 미확정 개인회생채권이 전부 그대로 확정된 경우</div>
              <div style="padding-left: 10px; margin-bottom: 10px;">
                  미확정 개인회생채권의 전액에 관하여 채권의 존재가 확정된 경우에는, 그 확정 직후 유보비율을 변제비율로 적용하여 변제를 개시하고 매월의 변제기에 그 해당금액을 변제하되, 이미 분할 변제기가 도래한 부분 즉 그 동안의 유보액에 대하여 곧바로 일시 변제한다.
              </div>

              <div style="font-weight: bold; margin-bottom: 5px;">(2) 미확정 개인회생채권이 전부 또는 일부 부존재 하는 것으로 확정된 경우</div>
              <div style="padding-left: 10px; margin-bottom: 10px;">
                  미확정 개인회생채권이 전부 또는 일부 부존재하는 것으로 확정된 경우에는, 그 확정 직후, 존재하는 것으로 확정된 [ 원금 ]의 인용 비율에 위 가항에 의하여 지급을 유보한 금액을 곱하여 산출된 금액을 당해 개인회생채권자에게 일시에 변제한다. 유보금액 중, 미확정 개인회생채권의 일부가 존재하지 않는 것으로 됨에 따라 그 개인회생채권자에게 변제할 필요가 없게 된 나머지 유보금액은, 그 채권액 확정 직후 전체 일반 개인회생채권자들에게 각 [ 원금 ]의 액수를 기준으로 안분하여 변제한다. 향후의 매월 입금액을 분배하는 기준이 될 변제비율은 위 확정 원금들 사이의 비율에 따라 새로 계산하여 정하는데, 미확정 개인회생채권의 일부가 존재하지 않는 것으로 확정됨에 따라 향후 당해 개인회생채권자를 위한 유보가 불필요하게 된 변제기 미도래분에 대한 변제 유보예정액은, 향후 변제기 도래시 전체 일반 개인회생채권자들에게 그 각 [ 원금 ]의 액수를 기준으로 안분되도록 한다.
              </div>

              <div style="font-weight: bold; margin-bottom: 5px;">(3) 변제기간 종료시까지 미확정 개인회생채권이 미확정상태로 남는 경우</div>
              <div style="padding-left: 10px; margin-bottom: 10px;">
                  변제기간 종료시까지 미확정 개인회생채권이 미확정상태로 남는 경우에는 최종변제기에 유보한 금액 전부를 일반개인회생채권자들에게 각 [ 원금 ]의 액수를 기준으로 안분하여 변제한다.
              </div>

              <div style="font-weight: bold; margin-bottom: 5px;">(4) 임대차보증금반환채권</div>
              <div style="padding-left: 10px;">
                  임대차보증금반환액수가 확정되지 않은 임대차보증금 반환채권은 미확정채권으로 보아 위 가, 나항에 따라 변제하되 그 액수가 확정되고 임차인이 임차목적물을 명도함과 동시에 변제한다.
              </div>
          </div>
      </div>
      ` : ''}

      <h2>8. 변제금원의 회생위원에 대한 임치 및 지급</h2>
      <div class="info-box">
          채무자는 위 [ 3, 6 ]항에 의하여 개인회생채권자들에게 변제하여야 할 금액을 개시결정시 통지되는 개인회생위원의 예금계좌 [                        ]에 순차 임치하고, 개인회생채권자는 법원에 예금계좌를 신고하여 회생위원으로부터 변제액을 송금받는 방법으로 지급받는다. 회생위원은 계좌번호를 신고하지 않은 개인회생채권자에 대하여는 변제액을 적립하였다가 이를 연 1회 개인회생사건이 계속되어 있는 지방법원에 공탁하여 지급할 수 있다.
      </div>

      <h2>9. 면책의 범위 및 효력발생시기</h2>
      <div class="info-box">
          채무자가 개인회생채권에 대하여 이 변제계획에 따라 변제를 완료하고 면책신청을 하여 면책결정이 확정되었을 경우에는, 이 변제계획에 따라 변제한 것을 제외하고 개인회생채권자에 대한 채무에 관하여 그 책임이 면제된다. 단, 채무자 회생 및 파산에 관한 법률 제625조 제2항 단서 각호 소정의 채무에 관하여는 그러하지 아니하다.
      </div>

      <h2>10. 기타사항</h2>
      <div style="margin-bottom: 20px;">
          [ 해당있음 □ / 해당없음 ■ ]
      </div>

      <div style="page-break-before: always; margin-top: 50px;"></div>

      <h1 style="text-decoration: none;">개인회생채권 변제예정액표</h1>

      <h2 style="margin-top: 0;">1. 기초사항</h2>
      <table class="income-table">
          <thead>
              <tr>
                  <th>① 월 평균<br>수입</th>
                  <th>② 월 평균<br>생계비</th>
                  <th>③ 월 평균<br>가용소득<br>(① - ②)</th>
                  <th>④ 월<br>회생위원<br>보수</th>
                  <th>⑤ 월 실제<br>가용소득<br>(③ - ④)</th>
                  <th>⑥ 변제 횟수<br>(월 단위로<br>환산)</th>
                  <th>⑦ 총 실제<br>가용소득<br>(⑤ x ⑥)</th>
              </tr>
          </thead>
          <tbody>
              <tr>
                  <td>${formatCurrency(monthlyAverageIncome)}</td>
                  <td>${formatCurrency(monthlyAverageLivingCost)}</td>
                  <td>${formatCurrency(monthlyAverageAvailableIncome)}</td>
                  <td>${formatCurrency(monthlyTrusteeFee)}</td>
                  <td>${formatCurrency(monthlyActualAvailableIncome)}</td>
                  <td>${repaymentCount}</td>
                  <td>${formatCurrency(totalActualAvailableIncome)}</td>
              </tr>
          </tbody>
      </table>
      ${seizedCalculationHtml}

      <h2>2. 채권자별 변제예정액의 산정내역 및 변제율</h2>
      <div style="margin-left: 10px; margin-bottom: 20px;">
          <div>가. 가용소득에 의한 변제내역 : 별표(1)과 같음</div>
          <div style="margin-top: 5px;">나. 변제율 : 원금의 [ ${repaymentRate} ]% 상당액</div>
          <div style="margin-top: 5px; font-size: 12px; color: #666;">
            (산출근거: 총 변제예정액 ${formatCurrency(totalRepaymentAmount)}원 / 총 원금 ${formatCurrency(totalDebt)}원 × 100)
          </div>
      </div>

      <h2>3. 청산가치와의 비교</h2>
      <div class="calculation-container">
          <div class="top-tables">
              <table style="width: 45%;">
                  <tr>
                      <td class="bg-gray" style="width: 40%; text-align: center; white-space: nowrap;">청산가치(원)</td>
                      <td class="text-right">${formatCurrency(liquidationValue)}</td>
                  </tr>
              </table>

              <table style="width: 50%;">
                  <tr>
                      <td class="bg-gray" style="text-align: center;">가용소득에 의한 총<br>변제예정(유보)액</td>
                      <td class="text-right">${formatCurrency(totalRepaymentAmount)}</td>
                  </tr>
                  <tr>
                      <td class="bg-gray" style="text-align: center;">현재가치</td>
                      <td class="text-right">${formatCurrency(calculatedPresentValue)}</td>
                  </tr>
              </table>
          </div>

          <div class="sub-title">○ 총 변제예정(유보)액의 현재가치 산정근거</div>
          <table class="basis-table" style="width: 50%;">
              <colgroup>
                  <col style="width: 10%;">
                  <col style="width: 40%;">
                  <col style="width: 15%;">
                  <col style="width: 35%;">
              </colgroup>
              <tbody>
                  <tr>
                      <td>1</td>
                      <td>적립기간(월)</td>
                      <td>${repaymentCount - inputPeriodMonths}</td>
                      <td class="text-right">${formatCurrency(savingAmountA)}</td>
                  </tr>
                  <tr>
                      <td>2</td>
                      <td>변제투입기간(월)</td>
                      <td>${inputPeriodMonths}</td>
                      <td class="text-right">${formatCurrency(inputAmountB)}</td>
                  </tr>
              </tbody>
              <tfoot>
                  <tr class="bg-gray" style="font-weight: bold;">
                      <td colspan="2">합 계</td>
                      <td>${repaymentCount}</td>
                      <td class="text-right">${formatCurrency(calculatedPresentValue)}</td>
                  </tr>
              </tfoot>
          </table>
      </div>

      <div style="page-break-before: always;"></div>
      <h2>별표(1) 가용소득에 의한 변제내역</h2>
      ${generateRepaymentPlanTables(creditors, schedule, monthlyActualAvailableIncome, repaymentCount, hasSeizedReserves ? Number(seizedReservesAmount) : 0)}
      
      <div style="margin-top: 40px; font-size: 12px; color: #666;">
        <p>※ 위 변제예정액은 예상 금액이며, 실제 변제액은 법원의 결정에 따라 달라질 수 있습니다.</p>
      </div>
    </div>
  `;
}

