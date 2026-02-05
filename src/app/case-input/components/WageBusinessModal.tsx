import React, { useState, useEffect } from 'react';
import { formatCurrency, parseCurrency } from '../utils';

interface WageBusinessModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        wageName: string;
        wageAmount: number;
        businessName: string;
        businessAmount: number;
    }) => void;
    initialData?: {
        wageName: string;
        wageAmount: number;
        businessName: string;
        businessAmount: number;
    };
}

export function WageBusinessModal({ isOpen, onClose, onConfirm, initialData }: WageBusinessModalProps) {
    const [wageName, setWageName] = useState('');
    const [wageAmount, setWageAmount] = useState(0);
    const [businessName, setBusinessName] = useState('');
    const [businessAmount, setBusinessAmount] = useState(0);

    useEffect(() => {
        if (isOpen && initialData) {
            setWageName(initialData.wageName);
            setWageAmount(initialData.wageAmount);
            setBusinessName(initialData.businessName);
            setBusinessAmount(initialData.businessAmount);
        } else if (isOpen) {
            // Reset fields when opening fresh
            setWageName('');
            setWageAmount(0);
            setBusinessName('');
            setBusinessAmount(0);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!wageName.trim() || !businessName.trim()) {
            alert('업체명을 모두 입력해주세요.');
            return;
        }
        onConfirm({
            wageName,
            wageAmount,
            businessName,
            businessAmount
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-gray-900">소득 상세 입력 (급여 + 영업)</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* 급여 소득 섹션 */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            근무(급여) 소득
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">근무업체명</label>
                                <input
                                    type="text"
                                    value={wageName}
                                    onChange={(e) => setWageName(e.target.value)}
                                    placeholder="예: 삼성전자"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">월평균 수입</label>
                                <input
                                    type="text"
                                    value={formatCurrency(wageAmount)}
                                    onChange={(e) => setWageAmount(parseCurrency(e.target.value))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-blue-500 focus:outline-none text-sm text-right"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 영업 소득 섹션 */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <h4 className="text-sm font-bold text-green-800 mb-3 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            운영(영업) 소득
                        </h4>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">운영업체명</label>
                                <input
                                    type="text"
                                    value={businessName}
                                    onChange={(e) => setBusinessName(e.target.value)}
                                    placeholder="예: 스타벅스"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-green-500 focus:outline-none text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">월평균 수입</label>
                                <input
                                    type="text"
                                    value={formatCurrency(businessAmount)}
                                    onChange={(e) => setBusinessAmount(parseCurrency(e.target.value))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-gray-300 rounded focus:border-green-500 focus:outline-none text-sm text-right"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 합계 */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                        <span className="text-sm font-bold text-gray-700">총 월평균 수입</span>
                        <span className="text-lg font-bold text-blue-600">{formatCurrency(wageAmount + businessAmount)}원</span>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        취소
                    </button>
                    <button
                        onClick={handleConfirm}
                        className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
