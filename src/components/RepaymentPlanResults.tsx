import React from 'react';

interface Creditor {
    id: string;
    name: string;
    amount: number;
    priority: boolean;
    isSubrogated?: boolean;
    subrogatedName?: string;
    subrogatedAmount?: number;
}

interface RepaymentPlanResultsProps {
    plan: any[];
    creditors: Creditor[]; // Flattened list expected
    monthlyAvailable: number;
    months: number;
}

export function RepaymentPlanResults({ plan, creditors, monthlyAvailable, months }: RepaymentPlanResultsProps) {
    // 1. 유효 채권자 필터링 (금액 > 0)
    const activeCreditors = creditors.filter(c => c.amount > 0);
    const priorityCreditors = activeCreditors.filter(c => c.priority);
    const hasPriority = priorityCreditors.length > 0;

    // 테이블 렌더링 헬퍼
    const renderTable = (data: any[], title: string, showTotal: boolean = true) => {
        if (data.length === 0) return null;
        const startMonth = data[0]['회차'];
        const endMonth = data[data.length - 1]['회차'];
        const periodLabel = startMonth === endMonth ? `${startMonth}회차` : `${startMonth}~${endMonth}회차`;
        const periodMonths = endMonth - startMonth + 1;

        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">
                    {title} ({periodLabel}, {periodMonths}개월)
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
                            {activeCreditors.map((c, index) => {
                                // 해당 구간의 첫 달 데이터를 기준으로 월변제액 표시 (동일 패턴 가정)
                                // *주의*: transition 구간 등에서 변동이 있을 수 있으나, '표' 단위로 쪼개진 이상
                                // 해당 구간 내에서는 동일하다고 가정하거나, 첫 달 기준으로 보여줌.
                                // 요구사항에 '안분 배당'이라고 했으므로 구간 내에서는 일정할 것임.
                                const monthlyPayment = data[0][c.id] || 0;
                                const totalPayment = monthlyPayment * periodMonths;

                                // 만약 이 구간에서 아예 변제액이 없는 일반채권자라면? 0원으로 표시됨.
                                // 3단계 분리 시 우선변제 기간에는 일반 채권자 0원 맞음.

                                // Sub-row 스타일 처리 (대위변제자)
                                // id가 '-sub'로 끝나면 서브로우로 간주 (page.tsx 로직 참조)
                                const isSubRow = c.id.endsWith('-sub');

                                return (
                                    <tr key={c.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isSubRow ? 'bg-blue-50/30' : ''}`}>
                                        <td className={`px-4 py-3 text-gray-900 font-medium border-b border-gray-200 ${isSubRow ? 'pl-8 text-blue-700' : ''}`}>
                                            {isSubRow && <span className="mr-1">↳</span>}
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
                        {showTotal && (
                            <tfoot>
                                <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                                    <td className="px-4 py-3 text-gray-900">합계</td>
                                    <td className="px-4 py-3 text-gray-900 text-right">
                                        {activeCreditors.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 text-right bg-blue-100">
                                        {activeCreditors.reduce((sum, c) => sum + (data[0][c.id] || 0), 0).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-gray-900 text-right bg-green-100">
                                        {activeCreditors.reduce((sum, c) => sum + (data[0][c.id] || 0) * periodMonths, 0).toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        );
    };

    // 총 변제예정액표 렌더링
    const renderSummaryTable = () => {
        // 각 채권자별 전체 변제액 계산
        const totalPaymentByCreditor: { [key: string]: number } = {};
        activeCreditors.forEach(c => {
            totalPaymentByCreditor[c.id] = plan.reduce(
                (sum, month) => sum + (month[c.id] || 0),
                0
            );
        });

        const totalPaymentAmount = activeCreditors.reduce(
            (sum, c) => sum + totalPaymentByCreditor[c.id],
            0
        );

        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-base font-semibold text-gray-900 mb-4">총 변제예정액표</h3>
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
                            {activeCreditors.map((c, index) => {
                                const isSubRow = c.id.endsWith('-sub');
                                const totalPayment = totalPaymentByCreditor[c.id];
                                const paymentRate = (totalPayment / c.amount) * 100;

                                return (
                                    <tr key={c.id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${isSubRow ? 'bg-blue-50/30' : ''}`}>
                                        <td className={`px-4 py-3 text-gray-900 font-medium border-b border-gray-200 ${isSubRow ? 'pl-8 text-blue-700' : ''}`}>
                                            {isSubRow && <span className="mr-1">↳</span>}
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
                                    {activeCreditors.reduce((sum, c) => sum + c.amount, 0).toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-purple-100">
                                    {totalPaymentAmount.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-gray-900 text-right bg-orange-100">-</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        );
    };

    // --- 메인 렌더링 로직 ---

    if (!hasPriority) {
        // 1. 우선변제권자가 없는 경우: 하나의 표
        return (
            <div className="space-y-6">
                {renderTable(plan, '전체 변제 계획')}
                {renderSummaryTable()}
            </div>
        );
    }

    // 2. 우선변제권자가 있는 경우: 3단계 분리
    // 단계 식별 로직:
    // Phase 1: 우선변제권자(Priority)가 돈을 받고 있는 기간. (일반채권자는 0원)
    // Phase 2: 우선변제권자가 끝나는 달 (우선 + 일반 섞임) -> 사실상 P가 받는 마지막 달.
    // Phase 3: P가 다 받고 나서, 일반(G)만 받는 기간.

    // 이를 찾기 위해 plan을 순회하며 "우선변제권자에게 지급된 총액"이 0이 되는 지점을 찾는다? 
    // 아니면, "일반채권자에게 지급된 금액"이 처음 발생하는 지점을 찾는다?

    // Transition Index 찾기: 일반채권자가 처음으로 돈을 받는 달의 인덱스.
    // 이 달이 바로 혼합(Transition) 달이거나, 혹은 P가 딱 떨어져서 끝나고 G가 시작하는 달일 수 있음.
    // 정확히는 "P에게 지급된 금액 > 0 AND G에게 지급된 금액 > 0" 인 달이 Transition (Phase 2).
    // "P > 0 AND G == 0" 인 달이 Phase 1.
    // "P == 0 AND G > 0" 인 달이 Phase 3.

    // 더 안전한 방법: 각 달의 속성을 분류.
    const phase1Rows: any[] = [];
    const phase2Rows: any[] = [];
    const phase3Rows: any[] = [];

    plan.forEach(monthData => {
        // 이 달에 우선변제권자가 단 1원이라도 가져갔는가?
        const pPayment = priorityCreditors.reduce((sum, c) => sum + (monthData[c.id] || 0), 0);
        // 이 달에 일반채권자가 단 1원이라도 가져갔는가?
        // activeCreditors 중 P가 아닌 애들
        const gPayment = activeCreditors
            .filter(c => !c.priority)
            .reduce((sum, c) => sum + (monthData[c.id] || 0), 0);

        if (pPayment > 0 && gPayment === 0) {
            phase1Rows.push(monthData);
        } else if (pPayment > 0 && gPayment > 0) {
            phase2Rows.push(monthData);
        } else {
            // pPayment === 0 (혹은 둘다 0인 경우..는 없어야겠지만 있다면 여기로)
            phase3Rows.push(monthData);
        }
    });

    return (
        <div className="space-y-6">
            {phase1Rows.length > 0 && renderTable(phase1Rows, '1단계: 우선변제권자 안분 배당')}
            {phase2Rows.length > 0 && renderTable(phase2Rows, '2단계: 우선변제 충당 완료 및 일반변제 개시')}
            {phase3Rows.length > 0 && renderTable(phase3Rows, '3단계: 일반변제권자 안분 배당')}
            {renderSummaryTable()}
        </div>
    );
}
