'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';

interface CaseDocument {
    id: number;
    title: string;
    created_at: string;
}

interface CreditorCase {
    id: number;
    title: string;
    created_at: string;
    updated_at: string;
    documents: CaseDocument[];
}

export default function CaseListPage() {
    const router = useRouter();
    const [cases, setCases] = useState<CreditorCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        try {
            const res = await fetch('/api/creditors');
            if (res.ok) {
                const data = await res.json();
                setCases(data);
            }
        } catch (error) {
            console.error('Failed to fetch cases:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까? 연결된 모든 문서도 함께 삭제됩니다.')) return;

        try {
            const res = await fetch(`/api/creditors/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchCases();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to delete case:', error);
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const handleDeleteDocument = async (docId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('이 문서를 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
            if (res.ok) {
                fetchCases();
            } else {
                alert('문서 삭제에 실패했습니다.');
            }
        } catch (error) {
            console.error('Failed to delete document:', error);
            alert('문서 삭제 중 오류가 발생했습니다.');
        }
    };

    // 페이지네이션 계산
    const totalPages = Math.ceil(cases.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentCases = cases.slice(startIndex, endIndex);

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
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">내 사건 목록</h1>
                        <p className="text-gray-600 mt-2">저장된 사건 정보를 확인하고 수정하세요</p>
                    </div>
                    <button
                        onClick={() => router.push('/case-input')}
                        className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        새 사건 추가
                    </button>
                </div>

                {cases.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-lg">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">저장된 사건이 없습니다</h3>
                        <p className="mt-1 text-sm text-gray-500">새 사건을 추가하여 시작하세요</p>
                        <div className="mt-6">
                            <button
                                onClick={() => router.push('/case-input')}
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                            >
                                새 사건 추가
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="space-y-4">
                            {currentCases.map((caseItem) => {
                                const hasDocuments = caseItem.documents && caseItem.documents.length > 0;

                                return (
                                    <div key={caseItem.id} className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
                                        {/* 사건 헤더 */}
                                        <div className="px-4 py-4 bg-blue-50 border-b border-blue-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center flex-1 min-w-0">
                                                    <svg className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-base font-bold text-gray-900 truncate">
                                                                {caseItem.title}
                                                            </p>
                                                            {hasDocuments && (
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                                                                    문서 {caseItem.documents.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                                                            <span>생성: {new Date(caseItem.created_at + (caseItem.created_at.includes('Z') ? '' : 'Z')).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                            <span>수정: {new Date(caseItem.updated_at + (caseItem.updated_at.includes('Z') ? '' : 'Z')).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="ml-4 flex items-center gap-2 flex-shrink-0">
                                                    <button
                                                        onClick={() => router.push(`/case-input?id=${caseItem.id}`)}
                                                        className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(caseItem.id, e)}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="삭제"
                                                    >
                                                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 문서 목록 */}
                                        {hasDocuments && (
                                            <div className="px-4 py-3">
                                                <h4 className="text-sm font-medium text-gray-700 mb-2">생성된 문서</h4>
                                                <div className="space-y-2">
                                                    {caseItem.documents.map((doc) => (
                                                        <div
                                                            key={doc.id}
                                                            className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-gray-900 truncate">{doc.title}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {new Date(doc.created_at + (doc.created_at.includes('Z') ? '' : 'Z')).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={() => router.push(`/documents/${doc.id}`)}
                                                                    className="px-3 py-1 text-xs bg-green-600 text-white hover:bg-green-700 rounded transition-colors flex-shrink-0"
                                                                >
                                                                    보기
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                                                                    className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                                                                    title="삭제"
                                                                >
                                                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* 페이지네이션 */}
                        {totalPages > 1 && (
                            <div className="mt-6 flex justify-center items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className={`px-3 py-1 rounded ${currentPage === 1
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    이전
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-3 py-1 rounded ${page === currentPage
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className={`px-3 py-1 rounded ${currentPage === totalPages
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    다음
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </MainLayout>
    );
}
