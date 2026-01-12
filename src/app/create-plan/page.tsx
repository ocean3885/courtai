'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { useRouter } from 'next/navigation';

interface Creditor {
  id: string;
  name: string;
  amount: number;
  priority: boolean;
}

interface PlanResult {
  success: boolean;
  plan: any[];
  statistics: {
    totalCreditors: number;
    totalAmount: number;
    monthlyAvailable: number;
    planMonths: number;
    totalPayment: number;
    differenceAmount: number;
  };
}

export default function CreatePlanPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [creditors, setCreditors] = useState<Creditor[]>([
    { id: '1', name: 'A은행(우선)', amount: 5000000, priority: true },
    { id: '2', name: 'B카드(일반)', amount: 10000000, priority: false },
    { id: '3', name: 'C대부(일반)', amount: 15000000, priority: false },
  ]);
  const [monthlyAvailable, setMonthlyAvailable] = useState(2000000);
  const [months, setMonths] = useState(36);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (!data.user || data.user.role !== 'ADMIN') {
          router.push('/');
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        router.push('/');
      }
    };

    checkAdmin();
  }, [router]);

  if (isAdmin === null) {
    return <MainLayout><div className="p-8">로딩 중...</div></MainLayout>;
  }

  if (!isAdmin) {
    return <MainLayout><div className="p-8">접근 권한이 없습니다.</div></MainLayout>;
  }

  const handleAddCreditor = () => {
    setCreditors([
      ...creditors,
      {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        priority: false,
      },
    ]);
  };

  const handleRemoveCreditor = (id: string) => {
    setCreditors(creditors.filter(c => c.id !== id));
  };

  const handleUpdateCreditor = (id: string, field: string, value: any) => {
    setCreditors(
      creditors.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };

  const handleCreatePlan = async () => {
    // 검증
    if (creditors.length === 0) {
      setError('최소 1명 이상의 채권자를 추가해주세요.');
      return;
    }

    const invalidCreditor = creditors.find(c => !c.name.trim() || c.amount <= 0);
    if (invalidCreditor) {
      setError('모든 채권자의 이름과 금액을 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditors: creditors.map(c => ({
            name: c.name,
            amount: c.amount,
            priority: c.priority,
          })),
          monthlyAvailable,
          months,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '변제계획 생성 실패');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || '변제계획 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(value);
  };

  // 변제 패턴을 비교하여 동일한 구간을 묶는 함수
  const groupPlanByPattern = (plan: any[], creditorNames: string[]) => {
    if (plan.length === 0) return [];

    const groups: any[] = [];
    let currentGroup = {
      startMonth: 1,
      endMonth: 1,
      pattern: null as any,
    };

    for (let i = 0; i < plan.length; i++) {
      const currentMonth = plan[i];
      const pattern = creditorNames.map(name => currentMonth[name] || 0);
      const patternStr = JSON.stringify(pattern);
      const currentPatternStr = currentGroup.pattern ? JSON.stringify(currentGroup.pattern) : null;

      if (currentPatternStr === patternStr) {
        // 같은 패턴이면 그룹 확장
        currentGroup.endMonth = currentMonth.회차;
      } else {
        // 다른 패턴이면 그룹 저장 후 새 그룹 시작
        if (currentGroup.pattern !== null) {
          groups.push({
            ...currentGroup,
            data: plan[i - 1],
          });
        }
        currentGroup = {
          startMonth: currentMonth.회차,
          endMonth: currentMonth.회차,
          pattern,
        };
      }
    }

    // 마지막 그룹 저장
    if (currentGroup.pattern !== null) {
      groups.push({
        ...currentGroup,
        data: plan[plan.length - 1],
      });
    }

    return groups;
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">변제계획 생성</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 입력 영역 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 계획 설정 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">계획 설정</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    월별 가용액 (원)
                  </label>
                  <input
                    type="number"
                    value={monthlyAvailable}
                    onChange={(e) => setMonthlyAvailable(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(monthlyAvailable)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계획 기간 (개월)
                  </label>
                  <input
                    type="number"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* 채권자 정보 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">채권자 정보</h2>
              
              <div className="space-y-3 mb-4">
                {creditors.map((creditor, index) => (
                  <div key={creditor.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-700">채권자 {index + 1}</span>
                      {creditors.length > 1 && (
                        <button
                          onClick={() => handleRemoveCreditor(creditor.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="채권자명"
                      value={creditor.name}
                      onChange={(e) => handleUpdateCreditor(creditor.id, 'name', e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded mb-2"
                    />

                    <input
                      type="number"
                      placeholder="금액"
                      value={creditor.amount}
                      onChange={(e) => handleUpdateCreditor(creditor.id, 'amount', parseInt(e.target.value) || 0)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded mb-2"
                    />

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={creditor.priority}
                        onChange={(e) => handleUpdateCreditor(creditor.id, 'priority', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-700">우선변제채권</span>
                    </label>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddCreditor}
                className="w-full py-2 px-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium text-sm"
              >
                + 채권자 추가
              </button>
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* 생성 버튼 */}
            <button
              onClick={handleCreatePlan}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '계획 생성 중...' : '변제계획 생성'}
            </button>
          </div>

          {/* 결과 영역 */}
          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                {/* 통계 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">계획 통계</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">채권자 수</p>
                      <p className="text-xl font-bold text-blue-700">{result.statistics.totalCreditors}명</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">총 채무액</p>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(result.statistics.totalAmount)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">계획 기간</p>
                      <p className="text-xl font-bold text-blue-700">{result.statistics.planMonths}개월</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600">예상 상환액</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(result.statistics.totalPayment)}</p>
                    </div>
                  </div>
                  {result.statistics.differenceAmount > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs text-gray-600">미상환액</p>
                      <p className="text-lg font-bold text-yellow-700">{formatCurrency(result.statistics.differenceAmount)}</p>
                    </div>
                  )}
                </div>

                {/* 변제계획 테이블 (회차별 그룹) */}
                <div className="space-y-6">
                  {groupPlanByPattern(result.plan, creditors.map(c => c.name)).map((group, groupIndex) => {
                    const monthLabel =
                      group.startMonth === group.endMonth
                        ? `${group.startMonth}회차`
                        : `${group.startMonth}~${group.endMonth}회차`;
                    const monthCount = group.endMonth - group.startMonth + 1;

                    return (
                      <div key={groupIndex} className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-base font-semibold text-gray-900 mb-4">
                          {monthLabel} 변제 계획 <span className="text-blue-600">({monthCount}개월)</span>
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100 border-b-2 border-gray-300">
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">채권자명</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">채권액</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-blue-50">월변제액</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-green-50">회차변제총액</th>
                              </tr>
                            </thead>
                            <tbody>
                              {creditors.map((c, index) => {
                                const monthlyPayment = group.data[c.name] || 0;
                                const totalPayment = monthlyPayment * monthCount;
                                return (
                                  <tr key={c.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-gray-900 font-medium border-b border-gray-200">
                                      {c.name}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-200">
                                      {c.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-200 bg-blue-50">
                                      {monthlyPayment.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 font-semibold text-right border-b border-gray-200 bg-green-50">
                                      {totalPayment.toLocaleString()}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                                <td className="px-4 py-3 text-gray-900">소계</td>
                                <td className="px-4 py-3 text-gray-900 text-right">
                                  {creditors.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-blue-100">
                                  {creditors
                                    .reduce((sum, c) => sum + (group.data[c.name] || 0), 0)
                                    .toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-green-100">
                                  {creditors
                                    .reduce((sum, c) => sum + (group.data[c.name] || 0) * monthCount, 0)
                                    .toLocaleString()}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 전 회차 통합 변제계획표 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6 mt-8">
                  {(() => {
                    // 각 채권자별 전체 변제액 계산
                    const totalPaymentByCreditor: { [key: string]: number } = {};
                    creditors.forEach(c => {
                      totalPaymentByCreditor[c.name] = result.plan.reduce(
                        (sum, month) => sum + (month[c.name] || 0),
                        0
                      );
                    });

                    // 전체 변제율 계산
                    const totalPaymentAmount = creditors.reduce(
                      (sum, c) => sum + totalPaymentByCreditor[c.name],
                      0
                    );
                    const totalCreditorAmount = creditors.reduce((sum, c) => sum + c.amount, 0);
                    const overallPaymentRate = (totalPaymentAmount / totalCreditorAmount) * 100;

                    return (
                      <>
                        <h3 className="text-base font-semibold text-gray-900 mb-4">
                          전 회차 통합 변제계획 <span className="text-green-600">({overallPaymentRate.toFixed(2)}%)</span>
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead>
                              <tr className="bg-gray-100 border-b-2 border-gray-300">
                                <th className="px-4 py-3 text-left font-semibold text-gray-700">채권자명</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700">채권액</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-purple-50">변제총액</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 bg-orange-50">변제율</th>
                              </tr>
                            </thead>
                            <tbody>
                              {creditors.map((c, index) => {
                                const totalPayment = totalPaymentByCreditor[c.name];
                                const paymentRate = (totalPayment / c.amount) * 100;
                                return (
                                  <tr key={c.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                    <td className="px-4 py-3 text-gray-900 font-medium border-b border-gray-200">
                                      {c.name}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-200">
                                      {c.amount.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-200 bg-purple-50">
                                      {totalPayment.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-700 text-right border-b border-gray-200 bg-orange-50">
                                      {paymentRate.toFixed(2)}%
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                                <td className="px-4 py-3 text-gray-900">합계</td>
                                <td className="px-4 py-3 text-gray-900 text-right">
                                  {creditors.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-purple-100">
                                  {totalPaymentAmount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-orange-100">
                                  -
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {/* 다시 생성 버튼 */}
                <button
                  onClick={() => setResult(null)}
                  className="w-full py-2 px-4 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400"
                >
                  다시 계획 생성
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">채권자 정보를 입력하고 변제계획을 생성해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
