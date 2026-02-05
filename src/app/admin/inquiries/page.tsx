'use client';

import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout';

interface Inquiry {
    id: number;
    user_id: number | null;
    user_name: string | null;
    title: string;
    content: string;
    created_at: string;
}

export default function AdminInquiriesPage() {
    const [inquiries, setInquiries] = useState<Inquiry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        const fetchInquiries = async () => {
            try {
                const res = await fetch('/api/admin/inquiries');
                if (res.ok) {
                    const data = await res.json();
                    setInquiries(data);
                } else {
                    setError('문의 목록을 불러오는 중 오류가 발생했습니다.');
                }
            } catch (err) {
                setError('서버와 통신 중 오류가 발생했습니다.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInquiries();
    }, []);

    // 페이지네이션 계산
    const totalPages = Math.ceil(inquiries.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentInquiries = inquiries.slice(startIndex, startIndex + itemsPerPage);

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
        <MainLayout wide>
            <div className="max-w-7xl mx-auto px-4 py-8">
                <div className="mb-8 overflow-hidden rounded-2xl bg-white shadow-sm border border-gray-100">
                    <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">문의 확인</h1>
                            <p className="text-gray-500 text-sm mt-1">사용자들이 남긴 문의 사항을 확인하고 관리합니다.</p>
                        </div>
                        <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm font-bold">
                            총 {inquiries.length}건
                        </div>
                    </div>

                    {error && (
                        <div className="p-8 text-center text-red-500 font-medium">
                            {error}
                        </div>
                    )}

                    <div className="p-8">
                        {inquiries.length === 0 ? (
                            <div className="text-center py-20 text-gray-500">
                                접수된 문의가 없습니다.
                            </div>
                        ) : (
                            <>
                                <div className="space-y-6">
                                    {currentInquiries.map((inquiry) => (
                                        <div key={inquiry.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                                            <div className="p-6 border-b border-gray-100 bg-gray-50/30 flex justify-between items-start">
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-900">{inquiry.title}</h3>
                                                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                                                        <span className="font-medium text-blue-600">
                                                            {inquiry.user_name ? `${inquiry.user_name}님` : '비회원'}
                                                        </span>
                                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                                        <span>{new Date(inquiry.created_at + (inquiry.created_at.includes('Z') ? '' : 'Z')).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6 bg-white">
                                                <pre className="whitespace-pre-wrap font-sans text-gray-700 leading-relaxed text-sm">
                                                    {inquiry.content}
                                                </pre>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 페이지네이션 UI */}
                                {totalPages > 1 && (
                                    <div className="mt-10 flex justify-center items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setCurrentPage(prev => Math.max(1, prev - 1));
                                                window.scrollTo(0, 0);
                                            }}
                                            disabled={currentPage === 1}
                                            className={`px-4 py-2 rounded-xl transition-all ${currentPage === 1
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-blue-300'
                                                }`}
                                        >
                                            이전
                                        </button>

                                        <div className="flex gap-1">
                                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                                <button
                                                    key={page}
                                                    onClick={() => {
                                                        setCurrentPage(page);
                                                        window.scrollTo(0, 0);
                                                    }}
                                                    className={`w-10 h-10 rounded-xl font-bold transition-all ${page === currentPage
                                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                            : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            ))}
                                        </div>

                                        <button
                                            onClick={() => {
                                                setCurrentPage(prev => Math.min(totalPages, prev + 1));
                                                window.scrollTo(0, 0);
                                            }}
                                            disabled={currentPage === totalPages}
                                            className={`px-4 py-2 rounded-xl transition-all ${currentPage === totalPages
                                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-blue-300'
                                                }`}
                                        >
                                            다음
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    );
}
