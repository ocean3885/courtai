import { formatCurrency } from '@/app/case-input/utils';
import { generateRepaymentScheduleWithSeizedReserves } from './repayment-plan-seized-service';

export interface RepaymentPlanData {
  debtorInfo: any;
  creditors: any[];
  repaymentPlan: any;
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
  monthlyActualAvailableIncome: number
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
  
  const title = startRound === endRound 
    ? `제 ${startRound} 회차 변제예정액`
    : `제 ${startRound} 회차 ~ 제 ${endRound} 회차 변제예정액`;

  return `
    <div style="font-weight: bold; margin-bottom: 5px; margin-top: 20px;">
      ${title}
    </div>
    <table class="repayment-plan">
      <thead>
        <tr>
          <th rowspan="2" style="width: 8%;">채권<br>번호</th>
          <th rowspan="2" style="width: 17%;">채권자</th>
          <th colspan="2" style="width: 25%;">(D)개인회생채권액</th>
          <th colspan="2" style="width: 25%;">(E)월변제예정(유보)액</th>
          <th colspan="2" style="width: 25%;">(F)총변제예정(유보)액</th>
        </tr>
        <tr>
          <th>확정<br>채권액</th>
          <th>미확정<br>채권액</th>
          <th>확정<br>채권액</th>
          <th>미확정<br>채권액</th>
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
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? '0' : formatCurrency(Math.floor(c.monthlyPayment))}</td>
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? formatCurrency(Math.floor(c.monthlyPayment)) : '0'}</td>
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? '0' : formatCurrency(c.totalPayment)}</td>
            <td class="text-right" style="white-space: nowrap;">${c.isUnconfirmed ? formatCurrency(c.totalPayment) : '0'}</td>
          </tr>
        `).join('')}
        <tr style="font-weight: bold; background-color: #f3f4f6;">
          <th colspan="2">합계</th>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumConfirmedDebt)}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumUnconfirmedDebt)}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumConfirmedMonthlyPayment))}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumUnconfirmedMonthlyPayment))}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumConfirmedTotalPayment)}</td>
          <td class="text-right" style="white-space: nowrap;">${formatCurrency(sumUnconfirmedTotalPayment)}</td>
        </tr>
        <tr style="font-weight: bold; background-color: #e5e7eb;">
          <th colspan="2">총계</th>
          <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(sumTotalDebt)}</td>
          <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(Math.floor(sumMonthlyPayment))}</td>
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
  const { debtorInfo, creditors: inputCreditors, repaymentPlan } = data;

  // 대위변제자(구상권자)를 포함한 전체 채권자 목록 생성
  const creditors: any[] = [];
  inputCreditors.forEach((c: any) => {
    creditors.push(c);
    
    // 대위변제자 정보가 있는 경우 별도의 채권자로 추가
    if (c.isSubrogated && c.subrogationData) {
      const sub = c.subrogationData;
      // 손해금(damages)이 있는 경우 원금에 포함(제외 요청으로 수정: 원금만 포함)
      const principal = Number(sub.principal) || 0;
      // const damages = Number(sub.damages) || 0;
      
      creditors.push({
        id: sub.id,
        number: sub.number,
        name: sub.name,
        principal: principal, // damages 제외
        interest: Number(sub.interest) || 0,
        isSecured: false, // 대위변제 채권은 일반적으로 일반회생채권
        isPreferential: false,
        securedData: null
      });
    }
  });

  // 총 채권액 계산 (원금만 포함)
  let totalDebt = 0;
  creditors.forEach((c: any) => {
    const principal = Number(c.principal) || 0;
    // const interest = Number(c.interest) || 0;
    totalDebt += principal; // 이자 제외
  });

  const repaymentPeriodMonths = repaymentPlan?.repaymentPeriod?.months || 36;
  const monthlyPayment = repaymentPlan?.monthlyActualAvailableIncome || 0;
  const totalRepaymentAmount = monthlyPayment * repaymentPeriodMonths;
  const repaymentRate = totalDebt > 0 ? ((totalRepaymentAmount / totalDebt) * 100).toFixed(2) : '0.00';

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
            width: 99% !important;
            margin: 0 auto !important;
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
      </style>
      
      <h1>변제계획안</h1>

      <div style="margin-bottom: 20px; font-size: 14px;">
         <b>성명:</b> ${debtorInfo.name} <span style="margin: 0 10px;">|</span>
         <b>생년월일:</b> ${debtorInfo.birthDate}
      </div>

      <h2>1. 채무자의 가용소득</h2>
      <table class="income-table">
        <tr>
          <th>①월평균<br>수입</th>
          <th>②월평균<br>생계비</th>
          <th>③월평균가용소득</th>
          <th>④월회생위원<br>보수</th>
          <th>⑤기타재단채권<br>(양육비등)</th>
        </tr>
        <tr>
          <td>${formatCurrency(monthlyAverageIncome)}</td>
          <td>${formatCurrency(monthlyAverageLivingCost)}</td>
          <td>${formatCurrency(monthlyAverageAvailableIncome)}</td>
          <td>${formatCurrency(monthlyTrusteeFee)}</td>
          <td>${formatCurrency(otherEstateClaims)}</td>
        </tr>
      </table>
      <table class="income-table" style="border-top: none;">
        <tr>
          <th class="wide-cell">⑥월실제가용소득<br>( ③ - ④ - ⑤ )</th>
          <th class="wide-cell">⑦변제횟수<br>(월단위로 환산)</th>
          <th class="wide-cell">⑧총실제가용소득<br>( ⑥ x ⑦ )</th>
        </tr>
        <tr>
          <td>${formatCurrency(monthlyActualAvailableIncome)}</td>
          <td>${repaymentCount}회</td>
          <td>${formatCurrency(totalActualAvailableIncome)}</td>
        </tr>
      </table>
      ${seizedCalculationHtml}

      <h2>2. 별제권부채권 및 이에 준하는 채권의 처리 [${hasSecuredCreditors ? '해당있음' : '해당없음'}]</h2>
      ${hasSecuredCreditors ? `
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
      ` : '<p style="margin: 10px 0; color: #666;">별제권부 채권이 없습니다.</p>'}

      <h2>3. 개인회생채권 변제예정액표</h2>
      ${generateRepaymentPlanTables(creditors, schedule, monthlyActualAvailableIncome, repaymentCount, hasSeizedReserves ? Number(seizedReservesAmount) : 0)}

      <h2>4. 가용소득에 의한 총변제예정액 산정내역</h2>
      <div style="text-align: right; font-size: 13px; margin-bottom: 5px;">(단위 : 원)</div>
      <table>
        <thead>
          <tr>
            <th rowspan="2" style="width: 8%; word-break: break-word;">채권번호</th>
            <th rowspan="2" style="width: 17%; word-break: break-word;">채권자</th>
            <th colspan="2">채권액</th>
            <th colspan="2">총변제예정액</th>
          </tr>
          <tr>
            <th style="white-space: nowrap;">확정채권액</th>
            <th style="white-space: nowrap;">미확정채권액</th>
            <th style="white-space: nowrap;">확정채권액</th>
            <th style="white-space: nowrap;">미확정채권액</th>
          </tr>
        </thead>
        <tbody>
          ${creditorTotals.map(ct => {
            const creditor = creditors.find(c => c.id === ct.creditorId);
            const isSecured = creditor?.isSecured || false;
            // ct.totalDebt는 이미 generateRepaymentSchedule에서 계산됨
            // 별제권부 채권: unrepayableAmount
            // 일반 채권: principal + interest
            const debtAmount = ct.totalDebt;
            
            return `
            <tr>
              <td class="center">${ct.creditorNumber}</td>
              <td class="center">${ct.creditorName}</td>
              <td class="text-right" style="white-space: nowrap;">${isSecured ? '0' : formatCurrency(debtAmount)}</td>
              <td class="text-right" style="white-space: nowrap;">${isSecured ? formatCurrency(debtAmount) : '0'}</td>
              <td class="text-right" style="white-space: nowrap;">${isSecured ? '0' : formatCurrency(ct.totalPayment)}</td>
              <td class="text-right" style="white-space: nowrap;">${isSecured ? formatCurrency(ct.totalPayment) : '0'}</td>
            </tr>
          `;
          }).join('')}
          <tr style="font-weight: bold; background-color: #f3f4f6;">
            <td colspan="2" class="center">합계</td>
            <td class="text-right" style="white-space: nowrap;">${formatCurrency(section4SumConfirmedDebt)}</td>
            <td class="text-right" style="white-space: nowrap;">${formatCurrency(section4SumUnconfirmedDebt)}</td>
            <td class="text-right" style="white-space: nowrap;">${formatCurrency(section4SumConfirmedPayment)}</td>
            <td class="text-right" style="white-space: nowrap;">${formatCurrency(section4SumUnconfirmedPayment)}</td>
          </tr>
          <tr style="font-weight: bold; background-color: #e5e7eb;">
            <td colspan="2" class="center">총합계</td>
            <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(section4GrandTotalDebt)}</td>
            <td colspan="2" class="text-right" style="white-space: nowrap;">${formatCurrency(section4GrandTotalPayment)}</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 40px; font-size: 12px; color: #666;">
        <p>※ 위 변제예정액은 예상 금액이며, 실제 변제액은 법원의 결정에 따라 달라질 수 있습니다.</p>
      </div>
    </div>
  `;
}

