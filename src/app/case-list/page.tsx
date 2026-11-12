'use client';

import React, { Suspense, useCallback, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function CaseListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const search = searchParams.get('q')?.trim().toLowerCase() || '';
    const [error, setError] = useState('');
    const [cases, setCases] = useState<CreditorCase[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const fetchCases = useCallback(async () => {
        setError('');
        try {
            const res = await fetch('/api/creditors');
            if (res.status === 401) { router.push('/auth/login'); return; }
            if (!res.ok) throw new Error('사건 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            if (res.ok) {
                const data = await res.json();
                setCases(data);
            }
        } catch (error) {
            setError(error instanceof Error ? error.message : '서버와 통신하지 못했습니다.');
        } finally {
            setIsLoading(false);
        }
    }, [router]);

    useEffect(() => { void fetchCases(); }, [fetchCases]);

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
    const filteredCases = cases.filter(item => item.title.toLowerCase().includes(search));
    const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
    const page = Math.min(currentPage, Math.max(1, totalPages));
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentCases = filteredCases.slice(startIndex, endIndex);

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
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">내 사건 목록</h1>
                        <p className="text-gray-600 mt-2">저장된 사건 정보를 확인하고 수정하세요</p>
                    </div>
                    <button
                        onClick={() => router.push('/case-input')}
                        className="min-h-11 shrink-0 whitespace-nowrap px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        새 사건 추가
                    </button>
                </div>

                <form action="/case-list" method="get" role="search" className="mb-6 flex gap-2">
                    <label htmlFor="case-list-query" className="sr-only">내 사건 검색</label>
                    <input id="case-list-query" name="q" type="search" defaultValue={searchParams.get('q') || ''} placeholder="사건 제목으로 검색" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-base focus:outline-2 focus:outline-blue-600" />
                    <button type="submit" className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-4 text-white">검색</button>
                </form>
                {error ? <div role="alert" className="rounded bg-red-50 p-5 text-red-700">{error}<button onClick={fetchCases} className="ml-4 underline">다시 시도</button></div> : filteredCases.length === 0 ? (
                    <div className="text-center py-20 bg-gray-50 rounded-lg">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h3 className="mt-2 text-sm font-medium text-gray-900">{search ? '검색 결과가 없습니다' : '저장된 사건이 없습니다'}</h3>
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
                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="flex items-center flex-1 min-w-0">
                                                    <svg className="h-6 w-6 text-blue-600 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                                                            <p className="text-base font-bold text-gray-900 break-words">
                                                                {caseItem.title}
                                                            </p>
                                                            {hasDocuments && (
                                                                <span className="inline-flex shrink-0 whitespace-nowrap items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-600 text-white">
                                                                    문서 {caseItem.documents.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                                                            <span>생성: {new Date(caseItem.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                            <span>수정: {new Date(caseItem.updated_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex shrink-0 items-center justify-end gap-2 sm:ml-4">
                                                    <button
                                                        onClick={() => router.push(`/case-input?id=${caseItem.id}`)}
                                                        className="min-h-11 whitespace-nowrap px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
                                                    >
                                                        수정
                                                    </button>
                                                    <button
                                                        onClick={(e) => handleDelete(caseItem.id, e)}
                                                        className="flex min-h-11 min-w-11 items-center justify-center p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
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
                                                            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between bg-gray-50 px-3 py-2 rounded border border-gray-200 hover:border-green-300 hover:bg-green-50 transition-colors"
                                                        >
                                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                <svg className="h-4 w-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                                </svg>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm text-gray-900 break-words">{doc.title}</p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {new Date(doc.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => router.push(`/documents/${doc.id}`)}
                                                                    className="min-h-11 min-w-11 whitespace-nowrap px-3 py-1 text-sm bg-green-600 text-white hover:bg-green-700 rounded transition-colors flex-shrink-0"
                                                                >
                                                                    보기
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleDeleteDocument(doc.id, e)}
                                                                    className="flex min-h-11 min-w-11 items-center justify-center p-1 text-red-600 hover:bg-red-50 rounded transition-colors flex-shrink-0"
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
                                    onClick={() => setCurrentPage(Math.max(1, page - 1))}
                                    disabled={page === 1}
                                    className={`min-h-11 min-w-11 px-3 py-1 rounded ${page === 1
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
                                        className={`min-h-11 min-w-11 px-3 py-1 rounded ${page === Math.min(currentPage, totalPages)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(Math.min(totalPages, page + 1))}
                                    disabled={page === totalPages}
                                    className={`min-h-11 min-w-11 px-3 py-1 rounded ${page === totalPages
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

export default function CaseListPage() {
  return <Suspense fallback={<p role="status">불러오는 중입니다.</p>}><CaseListContent /></Suspense>;
}
