import React from 'react';
import { formatCurrency, parseCurrency } from '../utils';
import { RepaymentPlan } from '../types';
import { WageBusinessModal } from './WageBusinessModal';

interface PlanInfoFormProps {
    repaymentPlan: RepaymentPlan;
    onChange: (plan: RepaymentPlan) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    isLoaded: boolean;
}

export function PlanInfoForm({
    repaymentPlan,
    onChange,
    onGenerate,
    isGenerating,
    isLoaded
}: PlanInfoFormProps) {
    // Validation for "wageAndBusiness" type
    const isWageAndBusiness = repaymentPlan.incomeType === 'wageAndBusiness';
    const isCompanyNameValid = !isWageAndBusiness || (repaymentPlan.companyName && repaymentPlan.companyName.includes(','));
    const [isWageModalOpen, setIsWageModalOpen] = React.useState(false);

    const handleWageModalConfirm = (data: { wageName: string; wageAmount: number; businessName: string; businessAmount: number }) => {
        onChange({
            ...repaymentPlan,
            companyName: `${data.wageName}, ${data.businessName}`, // 쉼표로 구분하여 저장
            monthlyAverageIncome: data.wageAmount + data.businessAmount,
            monthlyIncomeDetails: JSON.stringify({
                wage: { name: data.wageName, amount: data.wageAmount },
                business: { name: data.businessName, amount: data.businessAmount }
            })
        });
        setIsWageModalOpen(false);
    };

    // Parse initial data for modal if exists
    const getModalInitialData = () => {
        if (repaymentPlan.monthlyIncomeDetails && repaymentPlan.monthlyIncomeDetails.startsWith('{')) {
            try {
                const details = JSON.parse(repaymentPlan.monthlyIncomeDetails);
                return {
                    wageName: details.wage?.name || '',
                    wageAmount: details.wage?.amount || 0,
                    businessName: details.business?.name || '',
                    businessAmount: details.business?.amount || 0
                };
            } catch (e) {
                return undefined;
            }
        }
        return undefined;
    };

    const handleGenerate = () => {
        if (!isCompanyNameValid) {
            // Validation is displayed on screen, but doubly ensure we don't proceed
            return;
        }
        onGenerate();
    };

    return (
        <div className="bg-white border-2 border-gray-400 p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900">변제계획</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                {/* Row 1 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">변제시작일</label>
                    <input type="date" max="9999-12-31" value={repaymentPlan.repaymentPeriod.startDate} onChange={(e) => onChange({ ...repaymentPlan, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, startDate: e.target.value } })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">변제종료일</label>
                    <input type="date" max="9999-12-31" value={repaymentPlan.repaymentPeriod.endDate} onChange={(e) => onChange({ ...repaymentPlan, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, endDate: e.target.value } })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">변제기간(개월) ⑧</label>
                    <input type="number" value={repaymentPlan.repaymentPeriod.months} onChange={(e) => onChange({ ...repaymentPlan, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, months: parseInt(e.target.value) || 0 } })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">수입형태</label>
                    <select value={repaymentPlan.incomeType} onChange={(e) => onChange({ ...repaymentPlan, incomeType: e.target.value as 'wage' | 'business' | 'wageAndBusiness' })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none h-[34px]">
                        <option value="wage">급여소득자</option>
                        <option value="business">영업소득자</option>
                        <option value="wageAndBusiness">급여및운영</option>
                    </select>
                </div>

                {/* Row 2 - 근무(운영)업체명, 청산가치, 압류적립금, 압류적립액 */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">근무(운영)업체명</label>
                    <input
                        type="text"
                        value={repaymentPlan.companyName || ''}
                        onChange={(e) => !isWageAndBusiness && onChange({ ...repaymentPlan, companyName: e.target.value })}
                        onClick={() => isWageAndBusiness && setIsWageModalOpen(true)}
                        readOnly={isWageAndBusiness}
                        placeholder={isWageAndBusiness ? "클릭하여 업체명 입력" : "업체명을 입력하세요"}
                        className={`w-full px-2 py-1 border text-base focus:outline-none ${isWageAndBusiness ? 'cursor-pointer bg-gray-50' : ''
                            } ${!isCompanyNameValid ? 'border-red-500 focus:border-red-500 bg-red-50' : 'border-gray-400 focus:border-gray-600'
                            }`}
                    />
                    {!isCompanyNameValid && (
                        <p className="text-red-500 text-xs mt-1">
                            * 상세 입력이 필요합니다. 입력창을 클릭하세요.
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">청산가치</label>
                    <input type="text" value={formatCurrency(repaymentPlan.liquidationValue || 0)} onChange={(e) => onChange({ ...repaymentPlan, liquidationValue: parseCurrency(e.target.value) })} placeholder="청산가치를 입력하세요" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">압류적립금</label>
                    <select
                        value={repaymentPlan.seizedReservesStatus || 'no'}
                        onChange={(e) => onChange({
                            ...repaymentPlan,
                            seizedReservesStatus: e.target.value as 'yes' | 'no',
                            seizedReservesAmount: e.target.value === 'no' ? 0 : repaymentPlan.seizedReservesAmount
                        })}
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none h-[34px]"
                    >
                        <option value="no">없음</option>
                        <option value="yes">있음</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">압류적립액</label>
                    <input
                        type="text"
                        value={formatCurrency(repaymentPlan.seizedReservesAmount || 0)}
                        onChange={(e) => onChange({ ...repaymentPlan, seizedReservesAmount: parseCurrency(e.target.value) })}
                        placeholder="압류적립액을 입력하세요"
                        disabled={(repaymentPlan.seizedReservesStatus || 'no') !== 'yes'}
                        className={`w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none ${(repaymentPlan.seizedReservesStatus || 'no') !== 'yes' ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                    />
                </div>

                {/* Row 3 - 4 items */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">피부양자수</label>
                    <input type="number" value={repaymentPlan.dependentsCount} onChange={(e) => onChange({ ...repaymentPlan, dependentsCount: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">기준중위소득</label>
                    <input type="text" value={formatCurrency(repaymentPlan.standardMedianIncome)} onChange={(e) => onChange({ ...repaymentPlan, standardMedianIncome: parseCurrency(e.target.value) })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">회생위원보수(인가전)</label>
                    <input type="text" value={formatCurrency(repaymentPlan.trusteeFee.preConfirmation)} onChange={(e) => onChange({ ...repaymentPlan, trusteeFee: { ...repaymentPlan.trusteeFee, preConfirmation: parseCurrency(e.target.value) } })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">회생위원보수(인가후) ④</label>
                    <div className="relative">
                        <input type="number" step="0.1" value={repaymentPlan.trusteeFee.postConfirmationRate} onChange={(e) => onChange({ ...repaymentPlan, trusteeFee: { ...repaymentPlan.trusteeFee, postConfirmationRate: parseFloat(e.target.value) } })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none pr-6" />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-gray-500">%</span>
                    </div>
                </div>

                {/* Row 3 - 4 items */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        월평균수입 ①
                    </label>
                    <input
                        type="text"
                        value={formatCurrency(repaymentPlan.monthlyAverageIncome)}
                        onChange={(e) => {
                            if (!isWageAndBusiness) {
                                onChange({
                                    ...repaymentPlan,
                                    monthlyAverageIncome: parseCurrency(e.target.value),
                                    monthlyIncomeDetails: undefined
                                });
                            }
                        }}
                        onClick={() => isWageAndBusiness && setIsWageModalOpen(true)}
                        readOnly={isWageAndBusiness}
                        placeholder={isWageAndBusiness ? "클릭하여 소득 입력" : "0"}
                        className={`w-full px-2 py-1 border border-gray-400 text-base focus:outline-none ${isWageAndBusiness ? 'cursor-pointer bg-gray-50' : ''
                            }`}
                    />
                    {isWageAndBusiness && (
                        <p className="text-xs text-blue-600 mt-1 cursor-pointer hover:underline" onClick={() => setIsWageModalOpen(true)}>
                            * 클릭하여 상세 소득을 입력/수정하세요
                        </p>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">월평균생계비 ②</label>
                    <input type="text" value={formatCurrency(repaymentPlan.monthlyAverageLivingCost)} onChange={(e) => onChange({ ...repaymentPlan, monthlyAverageLivingCost: parseCurrency(e.target.value) })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">월평균가용소득 ③ (①-②)</label>
                    <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyAverageAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">월회생위원보수 ⑤ (③×④)</label>
                    <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyTrusteeFee)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                </div>

                {/* Row 4 - 4 items */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">기타재단채권 ⑥</label>
                    <input type="text" value={formatCurrency(repaymentPlan.otherEstateClaims)} onChange={(e) => onChange({ ...repaymentPlan, otherEstateClaims: parseCurrency(e.target.value) })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">월실제가용소득 ⑦ (③-⑤-⑥)</label>
                    <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyActualAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">총실제가용소득 ⑨ (⑦×⑧)</label>
                    <input type="text" readOnly value={formatCurrency(repaymentPlan.totalActualAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">작성일</label>
                    <input type="date" value={repaymentPlan.createDate} onChange={(e) => onChange({ ...repaymentPlan, createDate: e.target.value })} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                </div>
            </div>

            {/* 문서 생성 버튼 */}
            <div className="mt-8 pt-6 border-t-2 border-gray-300 flex flex-col items-center">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isCompanyNameValid}
                    className={`px-8 py-4 text-lg font-bold rounded-lg transition-all flex items-center justify-center gap-3 ${(isGenerating || !isCompanyNameValid)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl active:scale-[0.98]'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            생성 중...
                        </>
                    ) : (
                        <>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            채권자목록 및 변제계획안 생성
                        </>
                    )}
                </button>
                <p className="text-sm text-gray-500 text-center mt-3">
                    💡 저장된 데이터를 기반으로 법원 제출용 문서를 생성합니다
                </p>
            </div>
            {/* Wage Modal */}
            <WageBusinessModal
                isOpen={isWageModalOpen}
                onClose={() => setIsWageModalOpen(false)}
                onConfirm={handleWageModalConfirm}
                initialData={getModalInitialData()}
            />
        </div>
    );
}
