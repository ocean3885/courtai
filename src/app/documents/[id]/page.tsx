'use client';

import React, { useCallback, useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DocumentViewer } from '@/components/ui/DocumentViewer';
import { MainLayout } from '@/components/layout';
import { escapeHTML } from '@/lib/html';

interface DocumentDetail {
    id: number;
    creditor_id: number;
    title: string;
    html_preview: string;
    created_at: string;
    snapshot_data?: import("@/lib/document-service").DocumentData;
    repayment_plan_html: string;
    is_legacy?: boolean;
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

    const fetchDocument = useCallback(async () => {
        try {
            const res = await fetch(`/api/documents/${documentId}`);
            if (res.ok) {
                const data = await res.json();
                setDocument(data);
                setRepaymentPlanHtml(data.repayment_plan_html);
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
    }, [documentId, router]);

    useEffect(() => {
        if (documentId) {
            setRepaymentPlanHtml('');
            setIsLoading(true);
            void fetchDocument();
        }
    }, [documentId, fetchDocument]);

    const handlePrint = () => {
        // activeTab에 따라 대상 결정
        let targetSelector = '';
        let titleName = '';

        if (activeTab === 'repayment-plan') {
            if (!repaymentPlanHtml) {
                alert('변제계획안이 아직 생성되지 않았습니다.');
                return;
            }
            targetSelector = '#repayment-plan-content';
            titleName = '변제계획안';
        } else if (activeTab === 'creditor-list') {
            targetSelector = '#creditor-list-content';
            titleName = '채권자목록';
            // 미리보기 HTML이 있는지 확인
            if (!document?.html_preview) {
                alert('문서 내용을 찾을 수 없습니다.');
                return;
            }
        } else {
            alert('인쇄할 수 없는 탭입니다.');
            return;
        }

        // 화면에 렌더링된 요소에서 HTML 가져오기 (스타일 적용된 상태)
        // 만약 렌더링되지 않았으면 저장된 원본 사용
        const targetElement = window.document.querySelector(targetSelector);
        const contentHtml = targetElement ? targetElement.innerHTML : (activeTab === 'creditor-list' ? document?.html_preview || '' : repaymentPlanHtml);

        // 날짜 및 채무자명 포맷팅
        const today = new Date();
        const dateStr = today.getFullYear() + String(today.getMonth() + 1).padStart(2, '0') + String(today.getDate()).padStart(2, '0');
        const debtorName = document?.snapshot_data?.debtorInfo?.name || '채무자';
        const finalFileName = `${titleName}_${debtorName}_${dateStr}`;


        const printWindow = window.open('', '_blank');
        if (printWindow) {
            // 현재 페이지의 스타일(Tailwind 등)을 모두 복사하여 인쇄 창에 적용
            const styles = Array.from(window.document.querySelectorAll('style, link[rel="stylesheet"]'))
                .map(node => node.outerHTML)
                .join('');

            printWindow.document.write(`
                <!DOCTYPE html>
                <html lang="ko">
                <head>
                    <meta charset="UTF-8">
                    <title>${escapeHTML(finalFileName)}</title>
                    ${styles}
                    <style>
                        body { margin: 0; padding: 20px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        /* 인쇄 시 불필요한 스크롤바 숨김, 여백 설정 */
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
                            @page { margin: 10mm; }
                        }
                    </style>
                </head>
                <body>
                    ${contentHtml}
                    <script>
                        // 이미지나 폰트 로딩 대기 후 인쇄
                        window.onload = () => {
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        };
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
            // printWindow.focus(); // 일부 브라우저 보안 정책상 필요할 수 있음
        }
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
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h1 className="min-w-0 break-words text-xl font-bold text-gray-900 sm:text-2xl">{document.title}</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            생성일: {new Date(document.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        </p>
                    </div>
                    <div className="flex w-full flex-wrap items-start gap-3 sm:w-auto sm:shrink-0">
                        <button
                            onClick={() => router.push('/case-list')}
                            className="min-h-11 shrink-0 whitespace-nowrap px-4 bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            목록으로
                        </button>
                        <div className="flex flex-col items-end">
                            <button
                                onClick={handlePrint}
                                className="min-h-11 shrink-0 whitespace-nowrap px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                                title="인쇄 창에서 'PDF로 저장'을 선택할 수 있습니다."
                            >
                                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                인쇄 / PDF 저장
                            </button>
                            <span className="text-xs text-gray-500 mt-1">(*인쇄 창에서 PDF 저장 가능)</span>
                        </div>
                    </div>
                </div>

                {document.is_legacy && <p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-900">이전 형식의 문서입니다. 저장된 입력값에 현재 계산식을 적용해 표시합니다. 확정본이 필요하면 사건에서 새 문서를 생성해주세요.</p>}
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
                {activeTab !== 'changes' ? (
                    <DocumentViewer>
                        <div id={activeTab === 'creditor-list' ? 'creditor-list-content' : 'repayment-plan-content'} dangerouslySetInnerHTML={{
                            __html: activeTab === 'creditor-list' ? document.html_preview : repaymentPlanHtml
                        }} />
                    </DocumentViewer>
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
        </MainLayout>
    );
}
