import React from 'react';
import { formatCurrency, parseCurrency } from '../utils';
import { RepaymentPlan } from '../types';
import { WageBusinessModal } from './WageBusinessModal';

interface PlanInfoFormProps {
    repaymentPlan: RepaymentPlan;
    onChange: (plan: RepaymentPlan) => void;
    onGenerate: () => void;
    isGenerating: boolean;
    canGenerate?: boolean;
}

interface FieldProps {
    label: string;
    children: React.ReactNode;
    note?: string;
    className?: string;
}

function Field({ label, children, note, className = '' }: FieldProps) {
    const id = React.useId();
    function connect(nodes: React.ReactNode): React.ReactNode {
        return React.Children.map(nodes, child => {
            if (!React.isValidElement<{ id?: string; children?: React.ReactNode }>(child)) return child;
            if (['input', 'select', 'textarea'].includes(String(child.type))) return React.cloneElement(child, { id });
            return child.props.children ? React.cloneElement(child, { children: connect(child.props.children) }) : child;
        });
    }
    return (
        <div className={className}>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
            {connect(children)}
            {note && <p className="mt-1.5 text-xs leading-5 text-blue-600">{note}</p>}
        </div>
    );
}

function Section({
    title,
    children
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-gray-300 bg-white p-4">
            <h3 className="mb-4 text-base font-bold text-gray-900">{title}</h3>
            {children}
        </section>
    );
}

function ResultBox({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
            <p className="text-sm font-medium text-blue-900">{label}</p>
            <p className="mt-2 text-xl font-bold text-blue-700">{formatCurrency(value)}원</p>
        </div>
    );
}

const inputClass = 'h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function PlanInfoForm({
    repaymentPlan,
    onChange,
    onGenerate,
    isGenerating,
    canGenerate = true
}: PlanInfoFormProps) {
    const isWageAndBusiness = repaymentPlan.incomeType === 'wageAndBusiness';
    const isCompanyNameValid = !isWageAndBusiness || (repaymentPlan.companyName && repaymentPlan.companyName.includes(','));
    const [isWageModalOpen, setIsWageModalOpen] = React.useState(false);

    const handleWageModalConfirm = (data: { wageName: string; wageAmount: number; businessName: string; businessAmount: number }) => {
        onChange({
            ...repaymentPlan,
            companyName: `${data.wageName}, ${data.businessName}`,
            monthlyAverageIncome: data.wageAmount + data.businessAmount,
            monthlyIncomeDetails: JSON.stringify({
                wage: { name: data.wageName, amount: data.wageAmount },
                business: { name: data.businessName, amount: data.businessAmount }
            })
        });
        setIsWageModalOpen(false);
    };

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
            } catch {
                return undefined;
            }
        }
        return undefined;
    };

    const handleGenerate = () => {
        if (!isCompanyNameValid || !canGenerate) return;
        onGenerate();
    };

    return (
        <div className="space-y-5">
            <div className="rounded-lg border border-gray-300 bg-white p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">변제계획</h2>
                        <p className="mt-1 text-sm text-gray-500">기간, 소득, 공제 항목을 입력하면 하단 결과가 자동 계산됩니다.</p>
                    </div>
                    <Field label="작성일 *" className="w-full md:w-48">
                        <input
                            type="date"
                            value={repaymentPlan.createDate}
                            onChange={(e) => onChange({ ...repaymentPlan, createDate: e.target.value })}
                            className={inputClass}
                        />
                    </Field>
                </div>
            </div>

            <Section title="기본 설정">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="변제시작일 *">
                        <input
                            type="date"
                            max="9999-12-31"
                            value={repaymentPlan.repaymentPeriod.startDate}
                            onChange={(e) => onChange({ ...repaymentPlan, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, startDate: e.target.value } })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="변제종료일 *">
                        <input
                            type="date"
                            max="9999-12-31"
                            value={repaymentPlan.repaymentPeriod.endDate}
                            onChange={(e) => onChange({ ...repaymentPlan, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, endDate: e.target.value } })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="변제기간(개월) ⑧">
                        <input
                            type="number" min={1} max={120}
                            value={repaymentPlan.repaymentPeriod.months}
                            onChange={(e) => onChange({ ...repaymentPlan, repaymentCount: parseInt(e.target.value) || 0, repaymentPeriod: { ...repaymentPlan.repaymentPeriod, months: parseInt(e.target.value) || 0 } })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="수입형태">
                        <select
                            value={repaymentPlan.incomeType}
                            onChange={(e) => onChange({ ...repaymentPlan, incomeType: e.target.value as 'wage' | 'business' | 'wageAndBusiness' })}
                            className={inputClass}
                        >
                            <option value="wage">급여소득자</option>
                            <option value="business">영업소득자</option>
                            <option value="wageAndBusiness">급여및운영</option>
                        </select>
                    </Field>
                    <Field
                        label="근무(운영)업체명"
                        className="md:col-span-2"
                    >
                        <input
                            type="text"
                            value={repaymentPlan.companyName || ''}
                            onChange={(e) => !isWageAndBusiness && onChange({ ...repaymentPlan, companyName: e.target.value })}
                            onClick={() => isWageAndBusiness && setIsWageModalOpen(true)}
                            readOnly={isWageAndBusiness}
                            placeholder={isWageAndBusiness ? '클릭하여 업체명 입력' : '업체명을 입력하세요'}
                            className={`${inputClass} ${isWageAndBusiness ? 'cursor-pointer bg-gray-50' : ''} ${!isCompanyNameValid ? 'border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-100' : ''}`}
                        />
                        {!isCompanyNameValid && (
                            <p className="mt-1.5 text-xs text-red-500">상세 입력이 필요합니다. 입력창을 클릭하세요.</p>
                        )}
                    </Field>
                </div>
            </Section>

            <Section title="재산 및 특수 항목">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="청산가치">
                        <input
                            type="text"
                            value={formatCurrency(repaymentPlan.liquidationValue || 0)}
                            onChange={(e) => onChange({ ...repaymentPlan, liquidationValue: parseCurrency(e.target.value) })}
                            placeholder="청산가치를 입력하세요"
                            className={inputClass}
                        />
                    </Field>
                    <Field label="피부양자수">
                        <input
                            type="number"
                            value={repaymentPlan.dependentsCount}
                            onChange={(e) => onChange({ ...repaymentPlan, dependentsCount: parseInt(e.target.value) || 0 })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="기준중위소득" className="md:col-span-2 xl:col-span-1">
                        <input
                            type="text"
                            value={formatCurrency(repaymentPlan.standardMedianIncome)}
                            onChange={(e) => onChange({ ...repaymentPlan, standardMedianIncome: parseCurrency(e.target.value) })}
                            className={inputClass}
                        />
                    </Field>
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 md:col-span-2 xl:col-span-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <Field label="압류적립금">
                                <select
                                    value={repaymentPlan.seizedReservesStatus || 'no'}
                                    onChange={(e) => onChange({
                                        ...repaymentPlan,
                                        seizedReservesStatus: e.target.value as 'yes' | 'no',
                                        seizedReservesAmount: e.target.value === 'no' ? 0 : repaymentPlan.seizedReservesAmount
                                    })}
                                    className={inputClass}
                                >
                                    <option value="no">없음</option>
                                    <option value="yes">있음</option>
                                </select>
                            </Field>
                            <Field label="압류적립액">
                                <input
                                    type="text"
                                    value={formatCurrency(repaymentPlan.seizedReservesAmount || 0)}
                                    onChange={(e) => onChange({ ...repaymentPlan, seizedReservesAmount: parseCurrency(e.target.value) })}
                                    placeholder="압류적립액을 입력하세요"
                                    disabled={(repaymentPlan.seizedReservesStatus || 'no') !== 'yes'}
                                    className={`${inputClass} ${(repaymentPlan.seizedReservesStatus || 'no') !== 'yes' ? 'cursor-not-allowed bg-gray-100 text-gray-500' : ''}`}
                                />
                            </Field>
                        </div>
                    </div>
                </div>
            </Section>

            <Section title="소득 및 공제 입력">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field
                        label="월평균수입 ①"
                        note={isWageAndBusiness ? '클릭하여 상세 소득을 입력/수정하세요.' : undefined}
                    >
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
                            placeholder={isWageAndBusiness ? '클릭하여 소득 입력' : '0'}
                            className={`${inputClass} ${isWageAndBusiness ? 'cursor-pointer bg-gray-50' : ''}`}
                        />
                    </Field>
                    <Field label="월평균생계비 ②">
                        <input
                            type="text"
                            value={formatCurrency(repaymentPlan.monthlyAverageLivingCost)}
                            onChange={(e) => onChange({ ...repaymentPlan, monthlyAverageLivingCost: parseCurrency(e.target.value) })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="회생위원보수(인가전)">
                        <input
                            type="text"
                            value={formatCurrency(repaymentPlan.trusteeFee.preConfirmation)}
                            onChange={(e) => onChange({ ...repaymentPlan, trusteeFee: { ...repaymentPlan.trusteeFee, preConfirmation: parseCurrency(e.target.value) } })}
                            className={inputClass}
                        />
                    </Field>
                    <Field label="회생위원보수(인가후) ④">
                        <div className="relative">
                            <input
                                type="number"
                                step="0.1"
                                value={repaymentPlan.trusteeFee.postConfirmationRate}
                                onChange={(e) => onChange({ ...repaymentPlan, trusteeFee: { ...repaymentPlan.trusteeFee, postConfirmationRate: parseFloat(e.target.value) || 0 } })}
                                className={`${inputClass} pr-8`}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
                        </div>
                    </Field>
                    <Field label="기타재단채권 ⑥" className="md:col-span-2 xl:col-span-1">
                        <input
                            type="text"
                            value={formatCurrency(repaymentPlan.otherEstateClaims)}
                            onChange={(e) => onChange({ ...repaymentPlan, otherEstateClaims: parseCurrency(e.target.value) })}
                            className={inputClass}
                        />
                    </Field>
                </div>
            </Section>

            <section className="rounded-lg border border-blue-200 bg-white p-4">
                <h3 className="mb-4 text-base font-bold text-gray-900">계산 결과</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ResultBox label="월평균가용소득 ③ (①-②)" value={repaymentPlan.monthlyAverageAvailableIncome} />
                    <ResultBox label="월회생위원보수 ⑤ (③×④)" value={repaymentPlan.monthlyTrusteeFee} />
                    <ResultBox label="월실제가용소득 ⑦ (③-⑤-⑥)" value={repaymentPlan.monthlyActualAvailableIncome} />
                    <ResultBox label="총실제가용소득 ⑨ (⑦×⑧)" value={repaymentPlan.totalActualAvailableIncome} />
                </div>
            </section>

            <div className="sticky bottom-0 z-20 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-gray-600">{canGenerate ? '* 작성일, 변제 시작·종료일과 채권자명을 입력해주세요.' : '로그인 상태 확인 후 문서를 생성할 수 있습니다.'}</p>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !isCompanyNameValid || !canGenerate}
                    className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-5 text-sm font-bold transition md:w-auto ${(isGenerating || !isCompanyNameValid || !canGenerate)
                        ? 'cursor-not-allowed bg-gray-200 text-gray-400'
                        : 'bg-blue-700 text-white hover:bg-blue-800'
                        }`}
                >
                    {isGenerating ? (
                        <>
                            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            생성 중...
                        </>
                    ) : (
                        <>
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            문서 생성
                        </>
                    )}
                </button>
            </div>

            <WageBusinessModal
                isOpen={isWageModalOpen}
                onClose={() => setIsWageModalOpen(false)}
                onConfirm={handleWageModalConfirm}
                initialData={getModalInitialData()}
            />
        </div>
    );
}
