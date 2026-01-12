import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// 관리자 권한 확인
async function checkAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    return false;
  }

  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded.role === 'ADMIN';
  } catch (error) {
    return false;
  }
}

interface Creditor {
  id: string; // 고유 식별자 추가
  name: string;
  amount: number;
  priority: boolean;
  isSubrogated?: boolean;
  subrogatedName?: string;
  subrogatedAmount?: number;
}

// 변제계획 생성 함수
function createRepaymentPlan(creditors: Creditor[], monthlyAvailable: number, months: number) {
  const plan: any[] = [];

  // 채권자별 미변제 잔액 추적 (ID 기반)
  const balances: { [key: string]: number } = {};
  creditors.forEach(c => {
    balances[c.id] = c.amount;
  });

  for (let month = 1; month <= months; month++) {
    const monthData: { [key: string]: any } = { "회차": month };
    let remainingBudget = monthlyAvailable;

    // 1. 우선변제채권 처리
    const priorityCreditors = creditors.filter(c => c.priority && balances[c.id] > 0);
    if (priorityCreditors.length > 0) {
      const totalPriorityBalance = priorityCreditors.reduce((sum, c) => sum + balances[c.id], 0);
      const payAmount = Math.min(remainingBudget, totalPriorityBalance);

      // 1차 배분 (내림)
      let currentDistributed = 0;
      const shares: { [key: string]: number } = {};

      priorityCreditors.forEach(c => {
        const shareRatio = balances[c.id] / totalPriorityBalance;
        const rawPayment = payAmount * shareRatio;
        const payment = Math.floor(rawPayment);
        shares[c.id] = payment;
        currentDistributed += payment;
      });

      // 잔여금 배분 (오차 보정: 가용액보다 적지 않도록)
      let remainder = payAmount - currentDistributed;

      // 잔여금을 채권액 비율이 높은 순서대로 1원씩 배분 (또는 단순 순차 배분)
      // 여기서는 간단히 앞에서부터 배분
      let idx = 0;
      while (remainder > 0 && idx < priorityCreditors.length) {
        shares[priorityCreditors[idx].id]++;
        remainder--;
        idx++;
        // 한 바퀴 돌았는데도 남으면 다시 처음부터 (실제로는 거의 발생 안함)
        if (idx >= priorityCreditors.length && remainder > 0) idx = 0;
      }

      // 최종 반영
      priorityCreditors.forEach(c => {
        const payment = shares[c.id];
        balances[c.id] -= payment;
        monthData[c.id] = payment;
      });

      remainingBudget -= payAmount;
    }

    // 2. 일반변제채권 처리
    const generalCreditors = creditors.filter(c => !c.priority && balances[c.id] > 0);
    if (remainingBudget > 0 && generalCreditors.length > 0) {
      const totalGeneralBalance = generalCreditors.reduce((sum, c) => sum + balances[c.id], 0);

      // 1차 배분 (내림)
      let currentDistributed = 0;
      const shares: { [key: string]: number } = {};

      generalCreditors.forEach(c => {
        const shareRatio = balances[c.id] / totalGeneralBalance;
        const rawPayment = remainingBudget * shareRatio;
        const payment = Math.floor(rawPayment);
        shares[c.id] = payment;
        currentDistributed += payment;
      });

      // 잔여금 배분 (무조건 월 가용액 채우기)
      let remainder = remainingBudget - currentDistributed;

      let idx = 0;
      while (remainder > 0 && idx < generalCreditors.length) {
        shares[generalCreditors[idx].id]++;
        remainder--;
        idx++;
        if (idx >= generalCreditors.length && remainder > 0) idx = 0;
      }

      // 최종 반영
      generalCreditors.forEach(c => {
        const payment = shares[c.id];
        balances[c.id] -= payment;
        monthData[c.id] = payment;
      });
    }

    // 3. 미배정된 채권자는 0원 처리
    creditors.forEach(c => {
      if (!(c.id in monthData)) {
        monthData[c.id] = 0;
      }
    });

    plan.push(monthData);

    // 모든 채권 상환 완료 시 조기 종료
    const remainingTotal = Object.values(balances).reduce((sum: number, val: any) => sum + val, 0);
    if (remainingTotal <= 0) {
      break;
    }
  }

  return plan;
}

export async function POST(request: NextRequest) {
  try {
    // 관리자 권한 확인
    const isAdmin = await checkAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { creditors, monthlyAvailable, months } = await request.json();

    // 필수 필드 검증
    if (!creditors || !Array.isArray(creditors) || creditors.length === 0) {
      return NextResponse.json(
        { error: '채권자 정보가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!monthlyAvailable || monthlyAvailable <= 0) {
      return NextResponse.json(
        { error: '월별 가용액은 0보다 커야 합니다.' },
        { status: 400 }
      );
    }

    if (!months || months <= 0) {
      return NextResponse.json(
        { error: '개월수는 0보다 커야 합니다.' },
        { status: 400 }
      );
    }

    // 채권자 정보 검증
    for (const creditor of creditors) {
      if (!creditor.name || creditor.amount === undefined) {
        return NextResponse.json(
          { error: '채권자 이름과 금액이 필요합니다.' },
          { status: 400 }
        );
      }
      if (creditor.amount <= 0) {
        return NextResponse.json(
          { error: '채권자 금액은 0보다 커야 합니다.' },
          { status: 400 }
        );
      }
    }

    // 변제계획 생성
    const plan = createRepaymentPlan(creditors, monthlyAvailable, months);

    // 통계 정보
    const totalAmount = creditors.reduce((sum, c) => sum + c.amount, 0);
    const totalPayment = plan.reduce((sum, month) => {
      let monthTotal = 0;
      creditors.forEach(c => {
        monthTotal += month[c.id] || 0;
      });
      return sum + monthTotal;
    }, 0);

    return NextResponse.json({
      success: true,
      plan,
      statistics: {
        totalCreditors: creditors.length,
        totalAmount,
        monthlyAvailable,
        planMonths: plan.length,
        totalPayment: Math.round(totalPayment),
        differenceAmount: Math.round(totalAmount - totalPayment),
      },
    });
  } catch (error: any) {
    console.error('Repayment plan creation error:', error);
    return NextResponse.json(
      { error: '변제계획 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
