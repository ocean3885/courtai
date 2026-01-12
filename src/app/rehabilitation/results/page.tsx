'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';

interface ResultItem {
    id: number;
    title: string;
    memo: string;
    status: string;
    created_at: string;
    updated_at: string;
}

export default function ResultsListPage() {
    const router = useRouter();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [results, setResults] = useState<ResultItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check if user is logged in
        const checkAuth = async () => {
            try {
                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.user) {
                        setIsAuthorized(true);
                    } else {
                        router.push('/auth/login');
                    }
                } else {
                    router.push('/auth/login');
                }
            } catch (err) {
                console.error('Auth check failed:', err);
                router.push('/auth/login');
            } finally {
                setIsLoading(false);
            }
        };

        checkAuth();
    }, [router]);

    useEffect(() => {
        if (!isAuthorized || isLoading) return;
        fetchResults();
    }, [isAuthorized, isLoading]);

    const fetchResults = async () => {
        try {
            const res = await fetch('/api/rehabilitation/results');
            const json = await res.json();
            if (json.success) {
                setResults(json.data);
            }
        } catch (err) {
            console.error('Failed to fetch results:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까?')) return;

        try {
            const res = await fetch(`/api/rehabilitation/results/${id}`, {
                method: 'DELETE'
            });
            const json = await res.json();
            if (json.success) {
                setResults(results.filter(r => r.id !== id));
            } else {
                alert('삭제 실패: ' + json.error);
            }
        } catch (err) {
            alert('삭제 중 오류가 발생했습니다.');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case '검토완료':
                return <span className="px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold">검토완료</span>;
            case '보정':
                return <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded-lg text-xs font-bold">보정</span>;
            default:
                return <span className="px-3 py-1 bg-amber-50 text-amber-600 border border-amber-100 rounded-lg text-xs font-bold">검토중</span>;
        }
    };

    if (isLoading || !isAuthorized) {
        return null;
    }

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl border border-slate-100 shadow-sm gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-2xl shadow-inner">
                            📁
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">내 사건 목록</h1>
                            <p className="text-slate-400 font-medium text-xs mt-0.5">Your Rehabilitation Case History</p>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[60px_1fr_120px_140px_80px] bg-slate-50 border-b border-slate-100 px-6 py-4 text-sm font-bold text-slate-500 text-center">
                        <div>번호</div>
                        <div className="text-left px-4">사건번호</div>
                        <div>검토상태</div>
                        <div>작성일</div>
                        <div>관리</div>
                    </div>

                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center space-y-4">
                            <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                            <p className="text-slate-400 font-bold text-sm animate-pulse">리스트를 불러오는 중...</p>
                        </div>
                    ) : results.length === 0 ? (
                        <div className="py-20 text-center">
                            <p className="text-slate-400 font-bold text-lg">저장된 결과가 없습니다.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {results.map((item, index) => (
                                <Link
                                    key={item.id}
                                    href={`/rehabilitation/results/${item.id}`}
                                    className="group grid grid-cols-[60px_1fr_120px_140px_80px] items-center px-6 py-3 hover:bg-slate-50 transition-all cursor-pointer"
                                >
                                    <div className="text-sm font-medium text-slate-400 text-center">
                                        {results.length - index}
                                    </div>
                                    <div className="px-4 overflow-hidden">
                                        <div className="font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                                            {item.title}
                                        </div>
                                        {item.memo && (
                                            <div className="text-xs text-slate-400 truncate mt-0.5">
                                                {item.memo}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-center">
                                        {getStatusBadge(item.status)}
                                    </div>
                                    <div className="text-sm font-medium text-slate-500 text-center">
                                        {new Date(item.created_at).toLocaleDateString('ko-KR', {
                                            year: 'numeric',
                                            month: '2-digit',
                                            day: '2-digit'
                                        })}
                                    </div>
                                    <div className="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleDelete(item.id, e)}
                                            className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 transition-all flex items-center justify-center"
                                            title="삭제"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    );
}
