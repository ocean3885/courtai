'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';

interface ResultItem {
    id: number;
    title: string;
    memo: string;
    created_at: string;
    updated_at: string;
}

export default function ResultsListPage() {
    const [results, setResults] = useState<ResultItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchResults();
    }, []);

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

    return (
        <MainLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">내 분석 결과 리스트</h1>
                        <p className="text-gray-600 mt-2">저장된 사건 분석 결과물을 관리하세요.</p>
                    </div>
                    <Link
                        href="/rehabilitation"
                        className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all text-sm shadow-sm"
                    >
                        새 분석 시작하기
                    </Link>
                </div>

                {loading ? (
                    <div className="py-20 flex justify-center">
                        <div className="w-10 h-10 border-4 border-blue-50 border-t-blue-600 rounded-full animate-spin"></div>
                    </div>
                ) : results.length === 0 ? (
                    <div className="py-20 text-center bg-white rounded-3xl border border-gray-100 shadow-sm">
                        <span className="text-4xl mb-4 block">📁</span>
                        <p className="text-gray-500 font-medium">저장된 결과가 없습니다.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {results.map((item) => (
                            <Link
                                key={item.id}
                                href={`/rehabilitation/results/${item.id}`}
                                className="group p-6 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all flex justify-between items-center"
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-bold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
                                            {item.title}
                                        </h3>
                                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                                            {new Date(item.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-1">{item.memo || '첨부된 메모가 없습니다.'}</p>
                                </div>
                                <button
                                    onClick={(e) => handleDelete(item.id, e)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                >
                                    <span className="text-xl">🗑️</span>
                                </button>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
