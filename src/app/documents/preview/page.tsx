'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';
import { enrichDocumentData, generateDocumentHTML } from '@/lib/document-service';
import { generateRepaymentPlanHTML } from '@/lib/repayment-plan-service';

export default function DocumentPreviewPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'creditor-list' | 'repayment-plan'>('creditor-list');
    const [creditorListHtml, setCreditorListHtml] = useState('');
    const [repaymentPlanHtml, setRepaymentPlanHtml] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const storedData = localStorage.getItem('temp_case_data');
                if (!storedData) {
                    alert('데이터가 없습니다. 다시 입력해주세요.');
                    router.push('/case-input');
                    return;
                }

                const rawData = JSON.parse(storedData);
                const { title, data } = rawData;

                // 1. 데이터 강화
                const enrichedData = enrichDocumentData(data);

                // 2. 채권자 목록 HTML 생성
                const html1 = generateDocumentHTML(title || '체험용 문서', enrichedData);
                setCreditorListHtml(html1);

                // 3. 변제계획안 HTML 생성
                // 기준 중위 소득 등은 이미 입력 단계에서 가져왔다고 가정하거나, 필요시 여기서 fetch 가능
                const creationDate = new Date().toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                const html2 = generateRepaymentPlanHTML({
                    debtorInfo: enrichedData.debtorInfo,
                    creditors: enrichedData.creditors,
                    repaymentPlan: enrichedData.repaymentPlan,
                    creationDate
                });
                setRepaymentPlanHtml(html2);

            } catch (error) {
                console.error('Preview generation error:', error);
                alert('문서 생성 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [router]);

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* 회원가입 유도 배너 */}
                <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-blue-100 rounded-xl p-6 mb-8 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm print:hidden">
                    <div className="flex items-center gap-4">
                        <div className="bg-white p-3 rounded-full shadow-sm text-blue-600">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">회원가입을 통해 체계적으로 나만의 사건들을 관리하세요</h3>
                            <p className="text-gray-600 text-sm mt-1">저장된 데이터를 언제든지 다시 불러오고 수정할 수 있습니다.</p>
                        </div>
                    </div>
                    <Link
                        href="/auth/signup"
                        className="flex-shrink-0 text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap hover:underline flex items-center gap-1 transition-colors"
                    >
                        회원가입하러 가기 &rarr;
                    </Link>
                </div>
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {localStorage.getItem('temp_case_data') ? JSON.parse(localStorage.getItem('temp_case_data')!).title : '문서 미리보기'}
                        <span className="text-sm font-normal text-gray-500 ml-2">(임시 미리보기 모드)</span>
                    </h1>
                    <div className="flex gap-2">
                        <button
                            onClick={() => router.push('/case-input?load_temp=true')}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            수정하기
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            인쇄하기
                        </button>
                    </div>
                </div>

                {/* 탭 네비게이션 */}
                <div className="flex border-b border-gray-200 mb-6">
                    <button
                        onClick={() => setActiveTab('creditor-list')}
                        className={`px-6 py-3 font-medium text-base transition-colors relative ${activeTab === 'creditor-list'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        채권자 목록
                        {activeTab === 'creditor-list' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('repayment-plan')}
                        className={`px-6 py-3 font-medium text-base transition-colors relative ${activeTab === 'repayment-plan'
                            ? 'text-blue-600'
                            : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        변제계획안
                        {activeTab === 'repayment-plan' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600"></div>
                        )}
                    </button>
                </div>

                {/* 문서 뷰어 */}
                <div className="bg-white shadow-lg rounded-xl overflow-hidden min-h-[800px] border border-gray-200">
                    <div className="p-8 md:p-12 overflow-x-auto print:p-0">
                        <div
                            className="document-preview prose max-w-none"
                            dangerouslySetInnerHTML={{
                                __html: activeTab === 'creditor-list' ? creditorListHtml : repaymentPlanHtml
                            }}
                        />
                    </div>
                </div>

                <style jsx global>{`
                    /* 문서 스타일 */
                    .document-preview table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 1rem;
                        font-size: 13px;
                    }
                    .document-preview th, .document-preview td {
                        border: 1px solid #444;
                        padding: 6px 8px;
                        line-height: 1.4;
                    }
                    .document-preview th {
                        background-color: #f3f4f6;
                        font-weight: bold;
                        text-align: center;
                    }
                    .document-preview h1 {
                        font-size: 24px;
                        font-weight: bold;
                        text-align: center;
                        margin-bottom: 30px;
                        margin-top: 20px;
                    }
                    .document-preview h2 {
                        font-size: 16px;
                        font-weight: bold;
                        margin-top: 24px;
                        margin-bottom: 12px;
                    }
                    .document-preview .text-right { text-align: right; }
                    .document-preview .text-center { text-align: center; }
                    .document-preview .center { text-align: center; }
                    .document-preview .left-align { text-align: left; }
                
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .document-preview, .document-preview * {
                            visibility: visible;
                        }
                        .document-preview {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 20px;
                        }
                    }
                `}</style>
            </div>
        </MainLayout>
    );
}
