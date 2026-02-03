import { RepaymentScheduleRow, CreditorTotal } from './repayment-plan-service';

/**
 * 압류적립금이 있는 경우의 변제예정액표 생성
 */
export function generateRepaymentScheduleWithSeizedReserves(
  creditors: any[],
  monthlyActualAvailableIncome: number,
  repaymentCount: number,
  seizedReservesAmount: number
): { schedule: RepaymentScheduleRow[]; creditorTotals: CreditorTotal[] } {
  
  console.log(`[RepaymentPlanSeized] Generating schedule with seized reserves: ${seizedReservesAmount}`);

  const schedule: RepaymentScheduleRow[] = [];
  const creditorTotals: { [id: string]: CreditorTotal } = {};
  
  // 총실제가용소득 계산 (월가용소득 * 변제회차)
  // 주의: 압류적립금은 총실제가용소득에 포함되지 않은 별도의 자원임
  // 하지만 사용자 요구사항은 "수정된월실제가용소득"을 구하기 위해 다음과 같이 계산함
  // 수정된총실제가용소득 = (월실제가용소득 * 변제회차) - 압류적립금 (???)
  // 사용자 요구사항 재확인:
  // "총실제가용소득(월실제가용소득*변제회차)에서 압류적립금을 뺀 금액인 수정된총실제가용소득을 구하고"
  // "수정된총실제가용소득을 (총 변제회차 - 1회차) 로 나누어 수정된월실제가용소득을 구해야합니다"
  
  const totalActualAvailableIncome = monthlyActualAvailableIncome * repaymentCount;
  // 압류적립금이 문자열로 넘어올 수 있으므로 확실히 변환
  const seizedAmount = Number(seizedReservesAmount) || 0;
  
  const adjustedTotalIncome = totalActualAvailableIncome - seizedAmount;
  
  // 1회차만 있거나 가용소득이 부족한 경우 방어 로직
  let adjustedMonthlyIncome = 0;
  if (repaymentCount > 1) {
    adjustedMonthlyIncome = Math.ceil(adjustedTotalIncome / (repaymentCount - 1));
  }
  
  if (adjustedMonthlyIncome < 0) adjustedMonthlyIncome = 0;

  console.log(`[RepaymentPlanSeized] Total=${totalActualAvailableIncome}, Seized=${seizedAmount}, AdjustedTotal=${adjustedTotalIncome}, AdjustedMonthly=${adjustedMonthlyIncome}`);

  // 채권자별 총 채권액 및 잔액 초기화
  const creditorBalances: { [id: string]: number } = {};
  creditors.forEach(c => {
    let repaymentTargetAmount = 0;
    
    // 별제권부 채권: 별제권행사등으로 변제받을 수 없는 채권액만 대상
    if (c.isSecured && c.securedData) {
      repaymentTargetAmount = Number(c.securedData.unrepayableAmount) || 0;
    } else {
      // 일반 채권: 원금만 대상
      repaymentTargetAmount = Number(c.principal) || 0;
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
  
  const preferentialCreditors = creditors.filter(c => c.isPreferential && creditorBalances[c.id] > 0);
  const regularCreditors = creditors.filter(c => !c.isPreferential && creditorBalances[c.id] > 0);
  const hasPreferential = preferentialCreditors.length > 0;

  // ===============================================
  // 1. 1회차 처리 (압류적립금 배당) - 공통 로직
  // ===============================================
  const round1Payments: { [id: string]: number } = {};
  let round1Remaining = seizedAmount;

  if (hasPreferential) {
    const totalPreferentialDebt = preferentialCreditors.reduce((sum, c) => sum + creditorBalances[c.id], 0);

    if (totalPreferentialDebt <= seizedAmount) {
      // Case A: 우선변제권자 채권액 <= 압류적립금
      // 우선변제권자 전액 배당
      preferentialCreditors.forEach(c => {
        const payment = creditorBalances[c.id];
        round1Payments[c.id] = payment;
        creditorBalances[c.id] = 0; 
        round1Remaining -= payment;
      });

      // 남은 금액 일반채권자 안분
      if (round1Remaining > 0 && regularCreditors.length > 0) {
        distributeProRata(regularCreditors, creditorBalances, round1Payments, round1Remaining);
        round1Remaining = 0; // 안분 후 소진됨으로 간주 (오차 제외)
      }
    } else {
      // Case B: 우선변제권자 채권액 > 압류적립금
      // 우선변제권자에게 압류적립금 안분
      distributeProRata(preferentialCreditors, creditorBalances, round1Payments, seizedAmount);
      round1Remaining = 0;
    }
  } else {
    // Case C: 우선변제권자 없음
    // 일반채권자에게 압류적립금 안분
    if (regularCreditors.length > 0) {
      distributeProRata(regularCreditors, creditorBalances, round1Payments, seizedAmount);
    }
  }

  // totals 업데이트
  Object.keys(round1Payments).forEach(cid => {
    creditorTotals[cid].totalPayment += round1Payments[cid];
  });
  
  schedule.push({
    round: 1,
    payments: round1Payments,
    total: seizedAmount 
  });

  // ===============================================
  // 2. 2회차 ~ 최종회차 처리 (수정된월실제가용소득 배당)
  // ===============================================
  let currentRound = 2;
  
  // Case 구분 로직 재확인
  // 이미 1회차 처리하면서 creditorBalances가 업데이트 되었음.
  // 남은 잔액을 기준으로 계속 배당하면 됨.

  while (currentRound <= repaymentCount) {
    const roundPayments: { [id: string]: number } = {};
    const monthlyIncome = adjustedMonthlyIncome;
    let roundRemaining = monthlyIncome;

    // 남은 우선변제권자 확인
    const activePreferential = preferentialCreditors.filter(c => creditorBalances[c.id] > 0);

    if (activePreferential.length > 0) {
      // 우선변제권자가 아직 남아있음 (Case B의 연장선)
      const totalPreferentialRemaining = activePreferential.reduce((sum, c) => sum + creditorBalances[c.id], 0);

      if (totalPreferentialRemaining <= monthlyIncome) {
         // 이번 회차에 우선변제권자 모두 변제 가능
         activePreferential.forEach(c => {
           const payment = creditorBalances[c.id];
           roundPayments[c.id] = payment;
           creditorBalances[c.id] = 0;
           roundRemaining -= payment;
         });
         
         // 남은 돈은 일반채권자에게
         const activeRegular = regularCreditors.filter(c => creditorBalances[c.id] > 0);
         if (roundRemaining > 0 && activeRegular.length > 0) {
            distributeProRata(activeRegular, creditorBalances, roundPayments, roundRemaining);
         }
      } else {
         // 이번 회차도 우선변제권자에게만 안분
         distributeProRata(activePreferential, creditorBalances, roundPayments, monthlyIncome);
      }

    } else {
      // 우선변제권자 없음 (Case A, C, 혹은 B에서 우선변제 종료 후)
      // 일반채권자에게 안분
      const activeRegular = regularCreditors.filter(c => creditorBalances[c.id] > 0);
      if (activeRegular.length > 0) {
        distributeProRata(activeRegular, creditorBalances, roundPayments, monthlyIncome);
      }
    }

    // totals 업데이트
    Object.keys(roundPayments).forEach(cid => {
      creditorTotals[cid].totalPayment += roundPayments[cid];
    });

    schedule.push({
      round: currentRound,
      payments: roundPayments,
      total: monthlyIncome
    });

    currentRound++;
  }

  // 변제율 최종 계산
  Object.values(creditorTotals).forEach(ct => {
    if (ct.totalDebt > 0) {
      ct.repaymentRate = (ct.totalPayment / ct.totalDebt) * 100;
    }
  });
  
  return {
    schedule,
    creditorTotals: Object.values(creditorTotals)
  };
}

/**
 * 금액을 채권액 비율대로 안분하여 payments 객체에 추가하고 balances를 차감하는 헬퍼 함수
 */
function distributeProRata(
  targets: any[], 
  balances: { [id: string]: number }, 
  payments: { [id: string]: number }, 
  totalAmountToDistribute: number
) {
    const totalBalance = targets.reduce((sum, c) => sum + balances[c.id], 0);
    if (totalBalance <= 0) return;

    let distributedSum = 0;

    targets.forEach((c, index) => {
        let payment = 0;
        // 마지막 사람은 남은 금액 전부 (단, 본인 잔액 한도 내)
        // 안분 시 마지막 사람 보정 로직은 여러 방식이 있으나, 통상적으로 잔액을 맞추는게 중요
        
        if (index === targets.length - 1) {
            payment = totalAmountToDistribute - distributedSum;
        } else {
            payment = Math.floor((balances[c.id] / totalBalance) * totalAmountToDistribute);
        }

        // 잔액보다 더 줄 수는 없음 (이 경우 로직이 조금 복잡해지는데, 
        // 여기서는 totalAmountToDistribute가 totalBalance보다 작거나 같다는 가정하에 진행되거나,
        // 혹은 마지막 회차 처리가 아니면 그럴 일이 거의 없음.
        // 하지만 안전을 위해 체크)
        if (payment > balances[c.id]) {
            payment = balances[c.id];
        }

        // 0보다 작은지 체크
        if (payment < 0) payment = 0;

        payments[c.id] = (payments[c.id] || 0) + payment;
        balances[c.id] -= payment;
        distributedSum += payment;
    });
}
