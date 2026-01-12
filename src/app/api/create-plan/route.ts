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
  name: string;
  amount: number;
  priority: boolean;
}

// 변제계획 생성 함수
function createRepaymentPlan(creditors: Creditor[], monthlyAvailable: number, months: number) {
  const plan: any[] = [];
  
  // 채권자별 미변제 잔액 추적
  const balances: { [key: string]: number } = {};
  creditors.forEach(c => {
    balances[c.name] = c.amount;
  });

  for (let month = 1; month <= months; month++) {
    const monthData: { [key: string]: any } = { "회차": month };
    let remainingBudget = monthlyAvailable;

    // 1. 우선변제채권 처리
    const priorityCreditors = creditors.filter(c => c.priority && balances[c.name] > 0);
    if (priorityCreditors.length > 0) {
      const totalPriorityBalance = priorityCreditors.reduce((sum, c) => sum + balances[c.name], 0);
      const payAmount = Math.min(remainingBudget, totalPriorityBalance);

      priorityCreditors.forEach(c => {
        const shareRatio = balances[c.name] / totalPriorityBalance;
        const payment = payAmount * shareRatio;
        balances[c.name] -= payment;
        monthData[c.name] = Math.round(payment);
      });

      remainingBudget -= payAmount;
    }

    // 2. 일반변제채권 처리
    const generalCreditors = creditors.filter(c => !c.priority && balances[c.name] > 0);
    if (remainingBudget > 0 && generalCreditors.length > 0) {
      const totalGeneralBalance = generalCreditors.reduce((sum, c) => sum + balances[c.name], 0);

      generalCreditors.forEach(c => {
        const shareRatio = balances[c.name] / totalGeneralBalance;
        const payment = remainingBudget * shareRatio;
        balances[c.name] -= payment;
        monthData[c.name] = Math.round(payment);
      });
    }

    // 3. 미배정된 채권자는 0원 처리
    creditors.forEach(c => {
      if (!(c.name in monthData)) {
        monthData[c.name] = 0;
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
        monthTotal += month[c.name] || 0;
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
