'use client';

import React, { useState, useEffect, use } from 'react';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCalculator } from '@/hooks/rehabilitation/useCalculator';
import SmartCalculator from '@/components/rehabilitation/SmartCalculator';
import { useRef } from 'react';

interface ResultDetail {
    id: number;
    title: string;
    creditor_data: string;
    plan_data: string;
    memo: string;
    status: string;
    created_at: string;
}

export default function ResultDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [data, setData] = useState<ResultDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [memo, setMemo] = useState('');
    const [showMemoModal, setShowMemoModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [lastClickedCell, setLastClickedCell] = useState<{ id: string, section: string, row: number, col: number } | null>(null);
    const [forceOpenCalc, setForceOpenCalc] = useState<boolean | null>(null);
    const [isTableEditMode, setIsTableEditMode] = useState(false);

    const planContainerRef = useRef<HTMLDivElement>(null);
    const creditorContainerRef = useRef<HTMLDivElement>(null);

    const memoSectionRef = useRef<HTMLDivElement>(null);
    const memoTextareaRef = useRef<HTMLTextAreaElement>(null);

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
        if (isTableEditMode) return; // 편집 모드일 때는 계산기 클릭 방지

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
                setForceOpenCalc(null);
            }
        } else {
            // 단일 클릭
            calc.addCellItem(cell.id, currentVal.value, currentVal.text);
            setForceOpenCalc(null);
        }

        setLastClickedCell({ id: cell.id, section, row, col });
    };

    const handleUpdateTable = async () => {
        if (!planContainerRef.current || !creditorContainerRef.current) return;
        setIsSaving(true);
        try {
            // contentEditable 속성이나 불요한 클래스 제거 등 클린업은 필요 없음 (렌더링 시 다시 입히기 때문)
            // 다만 contentEditable="true" 문자열이 저장되지 않도록 HTML을 가져온 후 교체 가능
            const planHtml = planContainerRef.current.querySelector('.structured-content')?.innerHTML || '';
            const creditorHtml = creditorContainerRef.current.querySelector('.structured-content')?.innerHTML || '';

            // ID와 contentEditable 속성 제거 (순수 데이터만 저장)
            const clean = (html: string) => {
                return html
                    .replace(/\s+id="cell-[^"]*"/g, '')
                    .replace(/\s+contenteditable="[^"]*"/g, '')
                    .replace(/\s+class="[^"]*editable-cell[^"]*"/g, '');
            };

            if (!planHtml || !creditorHtml) {
                alert('데이터를 정상적으로 읽어오지 못했습니다. 편집 내용이 사라지는 것을 방지하기 위해 저장을 중단합니다.');
                return;
            }

            const res = await fetch(`/api/rehabilitation/results/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan_data: clean(planHtml),
                    creditor_data: clean(creditorHtml)
                }),
            });

            if (res.ok) {
                await fetchDetail(); // 최신 데이터로 리프레시
                setIsTableEditMode(false);
            } else {
                alert('저장에 실패했습니다.');
            }
        } catch (err) {
            console.error('Save error:', err);
        } finally {
            setIsSaving(false);
        }
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
                <div
                    ref={sectionKey === 'plan' ? planContainerRef : creditorContainerRef}
                    className={`relative overflow-hidden rounded-[2rem] transition-all ${isTableEditMode ? 'ring-4 ring-blue-500 ring-offset-8 bg-blue-50/10' : ''}`}
                    onClick={handleCellClick}
                >
                    <style jsx global>{`
                        .structured-content table {
                            width: 100%;
                            border-collapse: separate;
                            border-spacing: 0;
                            margin: 1.5rem 0;
                            border: 1px solid #e5e7eb;
                            border-radius: 12px;
                            overflow: hidden;
                            table-layout: fixed;
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
                            cursor: ${isTableEditMode ? 'text' : 'pointer'};
                            word-break: break-all;
                        }
                        .structured-content td {
                            padding: 12px 16px;
                            border-bottom: 1px solid #f1f5f9;
                            color: #334155;
                            font-size: 0.9rem;
                            vertical-align: top;
                            cursor: ${isTableEditMode ? 'text' : 'pointer'};
                            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                            user-select: ${isTableEditMode ? 'text' : 'none'};
                            word-break: break-all;
                        }
                        .structured-content td:hover {
                            background-color: ${isTableEditMode ? 'white' : '#f8fafc'};
                            box-shadow: ${isTableEditMode ? 'inset 0 0 0 2px #3b82f6' : 'none'};
                        }
                        
                        ${isTableEditMode ? `
                            .structured-content td, .structured-content th {
                                border-style: dashed !important;
                                border-color: #3b82f6 !important;
                            }
                            .structured-content td:focus, .structured-content th:focus {
                                outline: none !important;
                                background-color: white !important;
                                box-shadow: inset 0 0 0 3px #3b82f6 !important;
                                z-index: 20;
                                position: relative;
                            }
                        ` : ''}

                        .structured-content tr:last-child td {
                            border-bottom: none;
                        }
                        .structured-content tr:nth-child(even) {
                            background-color: #fcfcfd;
                        }
                        /* 선택된 셀 스타일 */
                        ${!isTableEditMode ? calc.calcItems.filter(i => i.type === 'cell').map(c => `
                            .structured-content [id="${c.id}"] {
                                background-color: #dbeafe !important;
                                box-shadow: inset 0 0 0 2px #3b82f6 !important;
                                color: #1e40af !important;
                                position: relative;
                                z-index: 10;
                                font-weight: 700;
                            }
                        `).join('\n') : ''}
                        
                        .structured-content h1, .structured-content h2, .structured-content h3 {
                            color: #0f172a;
                            font-weight: 800;
                            letter-spacing: -0.02em;
                            margin-top: 2.5rem;
                            margin-bottom: 1rem;
                        }
                    `}</style>
                    <div className="structured-content"
                        contentEditable={isTableEditMode}
                        suppressContentEditableWarning={true}
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
                setShowMemoModal(false);
                if (data) setData({ ...data, memo });
            }
        } catch (err) {
            alert('저장 실패');
        } finally {
            setIsSaving(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!data || data.status === newStatus) return;

        try {
            const res = await fetch(`/api/rehabilitation/results/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const json = await res.json();
            if (json.success) {
                setData({ ...data, status: newStatus });
            }
        } catch (err) {
            alert('상태 변경 실패');
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
            <SmartCalculator {...calc} forceShow={forceOpenCalc ?? undefined} onClose={() => setForceOpenCalc(false)} />

            <div className="max-w-6xl mx-auto space-y-10 pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                    <div className="space-y-4">
                        <Link href="/rehabilitation/results" className="inline-flex items-center text-sm font-semibold text-blue-600 bg-blue-50 px-4 py-2 rounded-full hover:bg-blue-100 transition-all group">
                            <span className="mr-2 transition-transform group-hover:-translate-x-1">←</span> 목차로 돌아가기
                        </Link>
                        <div>
                            <div className="flex items-center gap-4 mb-2">
                                <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{data.title}</h1>

                                {/* Status Toggle */}
                                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50 shadow-inner backdrop-blur-sm gap-1">
                                    {(['검토중', '검토완료', '보정'] as const).map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => handleStatusChange(s)}
                                            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300 active:scale-95 ${data.status === s
                                                ? s === '검토중'
                                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-200 ring-2 ring-white/20'
                                                    : s === '검토완료'
                                                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200 ring-2 ring-white/20'
                                                        : 'bg-rose-600 text-white shadow-md shadow-rose-200 ring-2 ring-white/20'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'
                                                }`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-slate-500 font-medium flex items-center gap-2">
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

                </div>

                {/* Floating Action Buttons */}
                <div className="fixed bottom-10 right-10 flex flex-col gap-4 z-[100]">
                    {!isTableEditMode ? (
                        <>
                            <button
                                onClick={() => {
                                    const isVisible = forceOpenCalc === true || (forceOpenCalc !== false && (calc.calcItems.length > 0 || calc.buffer || calc.savedResults.length > 0));
                                    if (isVisible) {
                                        setForceOpenCalc(false);
                                    } else {
                                        setForceOpenCalc(true);
                                    }
                                }}
                                className="w-16 h-16 bg-white border border-slate-100 shadow-2xl rounded-3xl flex items-center justify-center text-2xl hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all text-blue-600"
                                title={forceOpenCalc === true || (forceOpenCalc !== false && (calc.calcItems.length > 0 || calc.buffer || calc.savedResults.length > 0)) ? "계산기 닫기" : "계산기 열기"}
                            >
                                🔢
                            </button>
                            <button
                                onClick={() => setIsTableEditMode(true)}
                                className="w-16 h-16 bg-white border border-slate-100 shadow-2xl rounded-3xl flex items-center justify-center text-2xl hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all text-slate-600"
                                title="표 데이터 직접 수정"
                            >
                                🛠️
                            </button>
                            <button
                                onClick={() => setShowMemoModal(true)}
                                className="w-16 h-16 bg-blue-600 shadow-2xl shadow-blue-200 rounded-3xl flex items-center justify-center text-2xl hover:bg-blue-700 hover:scale-110 active:scale-95 transition-all text-white"
                                title="메모 작성하기"
                            >
                                ✏️
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in slide-in-from-bottom duration-300">
                            <div className="bg-blue-600 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm flex items-center gap-3">
                                <span className="animate-pulse">✍️</span> 편집 모드 활성화 중
                            </div>
                            <button
                                onClick={handleUpdateTable}
                                disabled={isSaving}
                                className="w-16 h-16 bg-emerald-600 shadow-2xl shadow-emerald-200 rounded-3xl flex items-center justify-center text-xl hover:bg-emerald-700 hover:scale-110 active:scale-95 transition-all text-white font-bold"
                                title="저장 및 종료"
                            >
                                {isSaving ? '...' : '💾'}
                            </button>
                            <button
                                onClick={() => setIsTableEditMode(false)}
                                className="w-16 h-16 bg-white border border-slate-100 shadow-2xl rounded-3xl flex items-center justify-center text-sm hover:bg-slate-50 hover:scale-110 active:scale-95 transition-all text-slate-400 font-bold"
                                title="취소"
                            >
                                ✕
                            </button>
                        </div>
                    )}
                </div>

                {/* Memo Side Panel */}
                {showMemoModal && (
                    <div className="fixed inset-0 z-[110] flex justify-end p-0 animate-in fade-in duration-300">
                        {/* Semi-transparent backdrop without blur */}
                        <div
                            className="absolute inset-0 bg-slate-900/5 cursor-pointer"
                            onClick={() => !isSaving && handleUpdateMemo()}
                        />
                        <div className="bg-white w-full max-w-[320px] h-full shadow-[-20px_0_50px_-12px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col animate-in slide-in-from-right duration-500 ease-out border-l border-slate-100">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-100">
                                        <span className="text-white text-lg">📝</span>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900 leading-tight">사건 메모</h3>
                                        <p className="text-slate-400 text-[9px] font-bold uppercase tracking-wider">Auto-save on close</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !isSaving && handleUpdateMemo()}
                                    className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-lg transition-all"
                                    title="저장 및 닫기"
                                >
                                    ✕
                                </button>
                            </div>
                            <div className="flex-1 p-6 overflow-hidden flex flex-col">
                                <textarea
                                    className="flex-1 w-full p-5 bg-slate-50/50 border border-slate-100 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-700 text-sm leading-relaxed custom-scrollbar resize-none"
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="내용을 입력하세요. 창을 닫으면 자동으로 저장됩니다."
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    );
}
