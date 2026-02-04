'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { MainLayout } from '@/components/layout';

interface DocumentDetail {
    id: number;
    creditor_id: number;
    title: string;
    html_preview: string;
    created_at: string;
    snapshot_data?: any;
    changes?: string;
}

type TabType = 'creditor-list' | 'repayment-plan' | 'changes';

const FIELD_NAME_MAP: Record<string, string> = {
    // Repayment Plan
    'repaymentPlan.monthlyAverageIncome': '월 평균 수입',
    'repaymentPlan.monthlyAverageLivingCost': '월 평균 생계비',
    'repaymentPlan.monthlyAverageAvailableIncome': '월 평균 가용소득',
    'repaymentPlan.monthlyTrusteeFee': '월 회생위원 보수',
    'repaymentPlan.otherEstateClaims': '기타 재단채권',
    'repaymentPlan.monthlyActualAvailableIncome': '월 실제 가용소득',
    'repaymentPlan.repaymentCount': '변제 횟수',
    'repaymentPlan.totalActualAvailableIncome': '총 실제 변제예정액',
    'repaymentPlan.liquidationValue': '청산가치',
    'repaymentPlan.seizedReservesAmount': '압류적립금',
    'repaymentPlan.companyName': '근무처',
    'repaymentPlan.incomeType': '소득유형',
    'repaymentPlan.dependentsCount': '부양가족 수',
    'repaymentPlan.adjustedLivingCost': '조정 생계비',
    'repaymentPlan.trusteeFee.preConfirmation': '회생위원 보수(인가전)',
    'repaymentPlan.trusteeFee.postConfirmationRate': '회생위원 보수율',
    'repaymentPlan.repaymentPeriod.months': '변제 기간(월)',

    // Creditor
    'name': '채권자명',
    'principal': '원금',
    'interest': '이자',
    'interestRate': '이율',
    'baseDate': '산정기준일',
    'reason': '채권발생원인',
    'isSecured': '별제권 여부',
    'isSubrogated': '대위변제 여부',
    'isPreferential': '우선변제 여부',
    'address': '주소',
    'phone': '전화번호',
    'fax': '팩스',
    'number': '채권번호',

    // Subrogated/Secured details
    'subrogationData.name': '대위변제자명',
    'subrogationData.principal': '대위변제 원금',
    'securedData.currentAmount': '채권현재액',
    'securedData.maxAmount': '채권최고액',
    'securedData.expectedRepaymentAmount': '별제권행사 변제예상액',
    'securedData.securedRehabilitationAmount': '담보부회생채권액',
    'securedData.unrepayableAmount': '별제권행사 변제불능액',
    'securedData.collateralObject': '담보목적물',
    'securedData.securedRightDetails': '별제권 내용',
    'securedData.expectedLiquidationValue': '환가예상액',
};

export default function DocumentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const documentId = params.id as string;
    const [document, setDocument] = useState<DocumentDetail | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('creditor-list');
    const [repaymentPlanHtml, setRepaymentPlanHtml] = useState<string>('');

    useEffect(() => {
        if (documentId) {
            fetchDocument();
        }
    }, [documentId]);

    useEffect(() => {
        if (document && activeTab === 'repayment-plan' && !repaymentPlanHtml) {
            generateRepaymentPlan();
        }
    }, [activeTab, document]);

    const fetchDocument = async () => {
        try {
            const res = await fetch(`/api/documents/${documentId}`);
            if (res.ok) {
                const data = await res.json();
                setDocument(data);
            } else {
                alert('문서를 불러올 수 없습니다.');
                router.push('/case-list');
            }
        } catch (error) {
            console.error('Failed to fetch document:', error);
            alert('문서를 불러오는 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    const generateRepaymentPlan = async () => {
        if (!document?.snapshot_data) return;

        try {
            // 동적 import로 클라이언트에서 서비스 로드
            const { generateRepaymentPlanHTML } = await import('@/lib/repayment-plan-service');
            
            // 기준 중위소득 최신 데이터 가져오기
            let snapshotData = { ...document.snapshot_data };
            
            if (snapshotData.repaymentPlan) {
                try {
                     const startStr = snapshotData.repaymentPlan.repaymentPeriod?.start;
                     const year = startStr ? new Date(startStr).getFullYear() : new Date().getFullYear();
                     const size = (snapshotData.repaymentPlan.dependentsCount || 0) + 1;

                     const res = await fetch(`/api/median-income?year=${year}&size=${size}`);
                     if (res.ok) {
                         const data = await res.json();
                         if (data.amount > 0) {
                             // snapshotData는 깊은 복사가 아닐 수 있으므로 주의 필요하지만, 
                             // 보통 1단계 depth copy로 repaymentPlan 객체를 교체하는 것이 안전함
                             snapshotData = {
                                ...snapshotData,
                                repaymentPlan: {
                                    ...snapshotData.repaymentPlan,
                                    standardMedianIncome: data.amount
                                }
                             };
                         }
                     }
                } catch (err) {
                    console.error('Failed to update standard median income:', err);
                }
            }

            const creationDate = document.created_at
                ? new Date(document.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
                : undefined;

            const html = generateRepaymentPlanHTML({
                ...snapshotData,
                creationDate
            });
            setRepaymentPlanHtml(html);
        } catch (error) {
            console.error('Failed to generate repayment plan:', error);
            alert('변제계획안 생성 중 오류가 발생했습니다.');
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow && document) {
            const contentToPrint = activeTab === 'creditor-list'
                ? document.html_preview
                : repaymentPlanHtml;

            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>${document.title} - ${activeTab === 'creditor-list' ? '채권자목록' : '변제계획안'}</title>
                </head>
                <body>
                    ${contentToPrint}
                </body>
                </html>
            `);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => {
                printWindow.print();
            }, 500);
        }
    };

    const handleDownloadPDF = () => {
        alert('PDF 다운로드 기능은 준비 중입니다. 현재는 인쇄 기능을 이용해주세요.');
    };

    const formatChangeLog = (log: string) => {
        if (!log) return '';
        let formatted = log;
        Object.entries(FIELD_NAME_MAP).forEach(([key, label]) => {
            // "key 수정" or "key: value" pattern replacement
            // Use global regex to replace all occurrences
            // Escape dots in key for regex
            const escapedKey = key.replace(/\./g, '\\.');

            // Regex to match the key when it's just the key name (e.g. in "key modified")
            // or followed by colon/value
            const regex = new RegExp(escapedKey, 'g');
            formatted = formatted.replace(regex, label);
        });
        return formatted;
    };

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </MainLayout>
        );
    }

    if (!document) {
        return (
            <MainLayout>
                <div className="text-center py-20">
                    <p className="text-gray-600">문서를 찾을 수 없습니다.</p>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout wide>
            <div className="max-w-full mx-auto px-4 py-8">
                {/* 헤더 */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            생성일: {new Date(document.created_at + (document.created_at.includes('Z') ? '' : 'Z')).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => router.push('/case-list')}
                            className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            목록으로
                        </button>
                        <button
                            onClick={handlePrint}
                            className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            인쇄
                        </button>
                        <button
                            onClick={handleDownloadPDF}
                            className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            PDF 다운로드
                        </button>
                    </div>
                </div>

                {/* 탭 메뉴 */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('creditor-list')}
                                className={`
                                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${activeTab === 'creditor-list'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                채권자목록
                            </button>
                            <button
                                onClick={() => setActiveTab('repayment-plan')}
                                className={`
                                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${activeTab === 'repayment-plan'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                변제계획안
                            </button>
                            <button
                                onClick={() => setActiveTab('changes')}
                                className={`
                                    py-4 px-1 border-b-2 font-medium text-sm transition-colors
                                    ${activeTab === 'changes'
                                        ? 'border-blue-500 text-blue-600'
                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                    }
                                `}
                            >
                                변경사항
                            </button>
                        </nav>
                    </div>
                </div>

                {/* 문서 미리보기 */}
                <div className="bg-gray-100 border border-gray-200 rounded-xl shadow-inner overflow-auto flex justify-center py-12">
                    {activeTab === 'creditor-list' ? (
                        <div dangerouslySetInnerHTML={{ __html: document.html_preview }} />
                    ) : activeTab === 'repayment-plan' ? (
                        <>
                            {repaymentPlanHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: repaymentPlanHtml }} />
                            ) : (
                                <div className="flex justify-center items-center py-20">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-white rounded-lg shadow-sm p-8 max-w-4xl w-full">
                            <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-3">📝 변경 이력</h2>
                            {document.changes ? (
                                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-mono bg-gray-50 p-6 rounded-lg border border-gray-200 leading-relaxed">
                                    {formatChangeLog(document.changes)}
                                </pre>
                            ) : (
                                <p className="text-gray-500 text-center py-8">변경 이력이 없습니다.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
