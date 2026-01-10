'use client';

import React, { useState, useEffect, use } from 'react';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCalculator } from '@/hooks/rehabilitation/useCalculator';
import SmartCalculator from '@/components/rehabilitation/SmartCalculator';

interface ResultDetail {
    id: number;
    title: string;
    creditor_data: string;
    plan_data: string;
    memo: string;
    created_at: string;
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<ResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [memo, setMemo] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastClickedCell, setLastClickedCell] = useState<{ id: string, section: string, row: number, col: number } | null>(null);

    // 계산기 전용 훅 사용
    const calc = useCalculator();

    useEffect(() => {
        fetchDetail();
    }, [id]);

    const fetchDetail = async () => {
        try {
            const res = await fetch(`/api/rehabilitation/results/${id}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data);
                setMemo(json.data.memo || '');
            } else {
                alert('데이터를 불러오지 못했습니다.');
                router.push('/rehabilitation/results');
            }
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCellClick = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        const cell = target.closest('td, th');
        if (!cell || !cell.id) return;

        // Shift-클릭 시 브라우저 기본 텍스트 선택(푸른 하이라이트) 방지
        if (e.shiftKey) {
            e.preventDefault();
            window.getSelection()?.removeAllRanges();
        }

        // ID에서 섹션과 좌표 추출 (예: cell-plan-2-3)
        const idParts = cell.id.split('-');
        if (idParts.length < 4) return;
        const section = idParts[1];
        const row = parseInt(idParts[2]);
        const col = parseInt(idParts[3]);

        const extractValue = (el: Element) => {
            const clean = (el.textContent || '').replace(/[^0-9.-]/g, '');
            const val = parseFloat(clean);
            return isNaN(val) ? null : { value: val, text: el.textContent || '' };
        };

        const currentVal = extractValue(cell);
        if (!currentVal) return;

        // Shift-클릭 범위 선택 로직 (2D 범위)
        if (e.shiftKey && lastClickedCell && lastClickedCell.section === section) {
            const rowStart = Math.min(lastClickedCell.row, row);
            const rowEnd = Math.max(lastClickedCell.row, row);
            const colStart = Math.min(lastClickedCell.col, col);
            const colEnd = Math.max(lastClickedCell.col, col);

            const itemsToBatch: { id: string, value: number, text: string }[] = [];

            for (let r = rowStart; r <= rowEnd; r++) {
                for (let c = colStart; c <= colEnd; c++) {
                    const targetId = `cell-${section}-${r}-${c}`;
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) {
                        const valObj = extractValue(targetEl);
                        if (valObj) {
                            itemsToBatch.push({ id: targetId, ...valObj });
                        }
                    }
                }
            }

            if (itemsToBatch.length > 0) {
                calc.addCellItems(itemsToBatch, true);
            }
        } else {
            // 단일 클릭
            calc.addCellItem(cell.id, currentVal.value, currentVal.text);
        }

        setLastClickedCell({ id: cell.id, section, row, col });
    };

    const renderData = (content: string, sectionKey: string) => {
        if (!content) return null;

        let target = content.trim();

        // 마크다운 코드 블록 제거
        if (target.startsWith('```')) {
            target = target.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
        }

        // HTML인 경우 동적 ID 주입 (Row/Col 기반 2D 인덱싱)
        if (target.startsWith('<')) {
            let rowIndex = 0;
            const processedHtml = target.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi, (trMatch: string, trAttrs: string, trContent: string) => {
                let colIndex = 0;
                const newContent = trContent.replace(/<(td|th)([^>]*)>/gi, (tdMatch: string, tagName: string, tdAttrs: string) => {
                    if (tdAttrs.includes('id=')) return tdMatch;
                    return `<${tagName}${tdAttrs} id="cell-${sectionKey}-${rowIndex}-${colIndex++}">`;
                });
                rowIndex++;
                return `<tr${trAttrs}>${newContent}</tr>`;
            });

            return (
                <div className="relative overflow-hidden rounded-2xl" onClick={handleCellClick}>
                    <style jsx global>{`
                        .structured-content table {
                            width: 100%;
                            border-collapse: separate;
                            border-spacing: 0;
                            margin: 1.5rem 0;
                            border: 1px solid #e5e7eb;
                            border-radius: 12px;
                            overflow: hidden;
                        }
                        .structured-content th {
                            background-color: #f8fafc;
                            color: #1e293b;
                            font-weight: 700;
                            text-align: left;
                            padding: 12px 16px;
                            border-bottom: 2px solid #e2e8f0;
                            font-size: 0.85rem;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            cursor: pointer;
                        }
                        .structured-content td {
                            padding: 12px 16px;
                            border-bottom: 1px solid #f1f5f9;
                            color: #334155;
                            font-size: 0.9rem;
                            vertical-align: top;
                            cursor: pointer;
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: none;
                        }
                        .structured-content td:hover {
                            background-color: #f8fafc;
                        }
                        .structured-content tr:last-child td {
                            border-bottom: none;
                        }
                        .structured-content tr:nth-child(even) {
                            background-color: #fcfcfd;
                        }
                        /* 선택된 셀 스타일 */
                        ${calc.calcItems.filter(i => i.type === 'cell').map(c => `
                            .structured-content [id="${c.id}"] {
                                background-color: #dbeafe !important;
                                box-shadow: inset 0 0 0 2px #3b82f6 !important;
                                color: #1e40af !important;
                                position: relative;
                                z-index: 10;
                                font-weight: 700;
                            }
                        `).join('\n')}
                        
                        .structured-content h1, .structured-content h2, .structured-content h3 {
                            color: #0f172a;
                            font-weight: 800;
                            letter-spacing: -0.02em;
                            margin-top: 2.5rem;
                            margin-bottom: 1rem;
                            display: flex;
                            align-items: center;
                        }
                        .structured-content h1 {
                            font-size: 2rem;
                            border-bottom: 3px solid #3b82f6;
                            padding-bottom: 0.75rem;
                            margin-top: 3.5rem;
                        }
                        .structured-content h2 {
                            font-size: 1.5rem;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 0.5rem;
                        }
                        .structured-content h3 {
                            font-size: 1.25rem;
                            padding-left: 1rem;
                            border-left: 4px solid #10b981;
                        }
                        .structured-content p {
                            margin: 1rem 0;
                            line-height: 1.7;
                            color: #475569;
                        }
                    `}</style>
                    <div
                        className="structured-content prose prose-slate max-w-none prose-img:rounded-3xl prose-a:text-blue-600 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:p-4 prose-blockquote:rounded-xl"
                        dangerouslySetInnerHTML={{ __html: processedHtml }}
                    />
                </div>
            );
        }

        return (
            <pre className="bg-gray-900 text-green-400 p-8 rounded-3xl text-[12px] font-mono leading-relaxed h-[600px] overflow-auto custom-scrollbar border border-gray-800 shadow-2xl">
                {target.startsWith('[') || target.startsWith('{')
                    ? JSON.stringify(JSON.parse(target), null, 2)
                    : target}
            </pre>
        );
    };

    const handleUpdateMemo = async () => {
        setIsSaving(true);
        try {
            const res = await fetch(`/api/rehabilitation/results/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memo })
            });
            const json = await res.json();
            if (json.success) {
                setIsEditing(false);
                if (data) setData({ ...data, memo });
            }
        } catch (err) {
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return (
        <MainLayout>
            <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-500 font-medium animate-pulse">분석 결과를 불러오는 중입니다...</p>
            </div>
        </MainLayout>
    );

    if (!data) return null;

    return (
        <MainLayout>
            <SmartCalculator {...calc} />

            <div className="max-w-6xl mx-auto space-y-10 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-4">
                        <Link href="/rehabilitation/results" className="inline-flex items-center text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-all group">
                            <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span> 목차로 돌아가기
                        </Link>
                        <div>
                            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{data.title}</h1>
                            <p className="text-slate-500 font-medium mt-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                                {new Date(data.created_at).toLocaleString('ko-KR', { dateStyle: 'long', timeStyle: 'short' })} 분석됨
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-12">
                    {/* 1. 변제 계획안 섹션 */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-blue-600 rounded-2xl shadow-lg shadow-blue-200">
                                <span className="text-white text-xl">📊</span>
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-900">변제 계획안 상세 분석</h4>
                                <p className="text-slate-500 text-sm font-medium">제출된 변제계획안의 주요 항목 및 일정 분석 결과입니다.</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-slate-100 shadow-xl shadow-slate-200/50 min-h-[400px]">
                            {renderData(data.plan_data, 'plan')}
                        </div>
                    </section>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

                    {/* 2. 채권자 목록 섹션 */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-emerald-600 rounded-2xl shadow-lg shadow-emerald-200">
                                <span className="text-white text-xl">👥</span>
                            </div>
                            <div>
                                <h4 className="text-2xl font-black text-slate-900">채권자 목록 구조화 데이터</h4>
                                <p className="text-slate-500 text-sm font-medium">채권자별 권리 관계 및 확정/미확정 채권 내역입니다.</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-[2rem] p-8 md:p-12 border border-slate-100 shadow-xl shadow-slate-200/50 min-h-[400px]">
                            {renderData(data.creditor_data, 'creditor')}
                        </div>
                    </section>

                    <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

                    {/* 3. 섹터 최하단: 사건 메모 */}
                    <section className="space-y-6">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-slate-800 rounded-2xl shadow-lg shadow-slate-200">
                                    <span className="text-white text-xl">📌</span>
                                </div>
                                <div>
                                    <h4 className="text-2xl font-black text-slate-900">사건 메모 및 특이사항</h4>
                                    <p className="text-slate-500 text-sm font-medium">사건 처리에 필요한 부가적인 정보와 특이사항을 기록합니다.</p>
                                </div>
                            </div>
                            <button
                                onClick={() => isEditing ? handleUpdateMemo() : setIsEditing(true)}
                                className={`px-6 py-3 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm ${isEditing ? 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        저장 중...
                                    </>
                                ) : (
                                    <>
                                        <span>{isEditing ? '💾 메모 저장하기' : '✏️ 메모 수정하기'}</span>
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="bg-white rounded-[2rem] p-8 md:p-10 border border-slate-100 shadow-xl shadow-slate-200/50">
                            {isEditing ? (
                                <textarea
                                    className="w-full p-6 border border-blue-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[200px] transition-all bg-slate-50 leading-relaxed text-slate-700"
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="분석 과정에서 발견된 특이사항이나 진행 메모를 입력하세요."
                                />
                            ) : (
                                <div className="space-y-4">
                                    {data.memo ? (
                                        <p className="text-slate-600 text-sm whitespace-pre-wrap leading-relaxed">
                                            {data.memo}
                                        </p>
                                    ) : (
                                        <div className="py-10 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200">
                                            <p className="text-slate-400 font-medium">아직 등록된 메모가 없습니다.</p>
                                            <button
                                                onClick={() => setIsEditing(true)}
                                                className="text-blue-600 font-bold text-sm hover:underline"
                                            >
                                                + 새로운 메모 작성하기
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </MainLayout>
    );
}
