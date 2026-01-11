import React from 'react';
import { CalcItem, OpType, SavedResult } from '../../hooks/rehabilitation/useCalculator';

interface SmartCalculatorProps {
    calcItems: CalcItem[];
    buffer: string;
    nextOp: OpType;
    savedResults: SavedResult[];
    setNextOp: (op: OpType) => void;
    removeItem: (id: string) => void;
    clearAll: () => void;
    fullReset: () => void;
    saveResult: () => void;
    reuseResult: (val: number) => void;
    result: number;
    forceShow?: boolean;
    onClose?: () => void;
}

const SmartCalculator: React.FC<SmartCalculatorProps> = ({
    calcItems,
    buffer,
    nextOp,
    savedResults,
    setNextOp,
    removeItem,
    clearAll,
    fullReset,
    saveResult,
    reuseResult,
    result,
    forceShow,
    onClose
}) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const [showGuide, setShowGuide] = React.useState(false);

    React.useEffect(() => {
        if (forceShow === true) {
            setIsVisible(true);
        } else if (forceShow === false) {
            setIsVisible(false);
        } else if (calcItems.length > 0 || buffer || savedResults.length > 0) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [calcItems.length, buffer, savedResults.length, forceShow]);

    if (!isVisible) return null;

    const handleClose = () => {
        clearAll();
        setIsVisible(false);
        if (onClose) onClose();
    };

    const opSigns: Record<OpType, string> = {
        add: '+',
        sub: '-',
        mul: '×',
        div: '÷'
    };

    const itemCount = calcItems.length;
    const isCompact = itemCount > 6;
    const isSuperCompact = itemCount > 12;

    const chipPadding = isSuperCompact ? 'px-3 py-1.5' : isCompact ? 'px-4 py-2' : 'px-5 py-3';
    const chipFontSize = isSuperCompact ? 'text-[13px]' : isCompact ? 'text-[14px]' : 'text-base';
    const chipGap = isSuperCompact ? 'gap-1.5' : 'gap-2';
    const containerGap = isSuperCompact ? 'gap-2' : isCompact ? 'gap-2.5' : 'gap-3';
    const opSize = isSuperCompact ? 'text-[10px]' : 'text-xs';

    return (
        <div className="fixed left-8 top-1/2 -translate-y-1/2 w-[28rem] z-50 animate-in slide-in-from-left duration-300">
            <div className="bg-white/95 backdrop-blur-2xl border border-blue-100 shadow-2xl rounded-[3.5rem] overflow-hidden flex flex-col max-h-[85vh] relative">

                {/* Close Button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-200/50 text-slate-500 hover:bg-red-500 hover:text-white flex items-center justify-center text-lg transition-all z-[70] font-black"
                    title="계산기 끄기"
                >
                    ✕
                </button>

                {/* Guide Overlay */}
                {showGuide && (
                    <div className="absolute inset-0 z-[60] bg-slate-900/95 backdrop-blur-md p-8 text-white animate-in fade-in zoom-in-95 duration-200 flex flex-col">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm">💡</span>
                                계산기 사용법
                            </h3>
                            <button
                                onClick={() => setShowGuide(false)}
                                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-xl transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-auto space-y-6 pr-2 custom-scrollbar-light text-slate-300">
                            <section>
                                <h4 className="text-blue-400 font-black text-sm mb-2 uppercase tracking-widest">Basic Input</h4>
                                <ul className="space-y-2 text-[13px] leading-relaxed">
                                    <li>• <strong className="text-white">클릭 입력</strong>: 테이블의 숫자 셀을 클릭하면 즉시 추가됩니다.</li>
                                    <li>• <strong className="text-white">키보드 입력</strong>: 숫자 패드로 직접 입력하고 <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white">Enter</kbd>로 확정하세요.</li>
                                    <li>• <strong className="text-white">자동 합산</strong>: 연산자 선택 없이 연속 클릭 시 '더하기'가 자동 적용됩니다.</li>
                                </ul>
                            </section>

                            <section>
                                <h4 className="text-emerald-400 font-black text-sm mb-2 uppercase tracking-widest">Range Selection</h4>
                                <p className="text-[13px] leading-relaxed mb-1">
                                    • <strong className="text-white">Shift + 클릭</strong>: 첫 셀 선택 후 끝 셀을 시프트 클릭하면 사이의 <span className="text-emerald-400">직사각형 영역</span>이 한 번에 합산됩니다.
                                </p>
                            </section>

                            <section>
                                <h4 className="text-amber-400 font-black text-sm mb-2 uppercase tracking-widest">History Management</h4>
                                <ul className="space-y-2 text-[13px] leading-relaxed">
                                    <li>• <strong className="text-white">결과 저장</strong>: 현재 연산 결과를 상단 히스토리에 최대 5개까지 보관합니다.</li>
                                    <li>• <strong className="text-white">값 재사용</strong>: 히스토리에 있는 값을 클릭하면 현재 계산에 즉시 투입됩니다.</li>
                                </ul>
                            </section>

                            <section>
                                <h4 className="text-pink-400 font-black text-sm mb-2 uppercase tracking-widest">Shortcuts</h4>
                                <div className="grid grid-cols-2 gap-2 text-[12px]">
                                    <div className="bg-white/5 p-2 rounded-xl"><span className="text-white font-black">+ - * /</span> 연산자 변경</div>
                                    <div className="bg-white/5 p-2 rounded-xl"><span className="text-white font-black">Esc</span> 작업 초기화</div>
                                    <div className="bg-white/5 p-2 rounded-xl"><span className="text-white font-black">BS</span> 숫자 지우기</div>
                                    <div className="bg-white/5 p-2 rounded-xl"><span className="text-white font-black">💾</span> 결과 저장</div>
                                </div>
                            </section>
                        </div>

                        <button
                            onClick={() => setShowGuide(false)}
                            className="mt-6 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-sm transition-all shadow-lg shadow-blue-500/20"
                        >
                            확인 완료
                        </button>
                    </div>
                )}

                {/* Saved Results History (Top Dock) */}
                <div className="p-5 bg-slate-50 border-b border-slate-100 min-h-[80px] flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-2 px-3 pr-10">
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">History</span>
                            <button
                                onClick={() => setShowGuide(true)}
                                className="text-[9px] font-black bg-blue-50 text-blue-500 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-all flex items-center gap-1"
                            >
                                <span className="text-[11px]">❓</span> 사용설명서
                            </button>
                        </div>
                        <button
                            onClick={fullReset}
                            className="text-[10px] font-black text-red-500/70 hover:text-red-600 transition-all bg-red-50 px-2.5 py-1 rounded-lg"
                        >
                            저장초기화 ↺
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 px-1">
                        {savedResults.length === 0 && (
                            <span className="text-[10px] font-bold text-slate-300 italic px-2">No history</span>
                        )}
                        {savedResults.map((res) => (
                            <button
                                key={res.id}
                                onClick={() => reuseResult(res.value)}
                                className="px-4 py-2 bg-white border-2 border-slate-100 rounded-xl text-sm font-black text-slate-700 hover:border-blue-400 hover:text-blue-600 hover:shadow-sm transition-all active:scale-95"
                            >
                                {res.value.toLocaleString()}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Display Area */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 text-white relative overflow-hidden">
                    <div className="absolute top-6 left-8 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-[9px] font-black tracking-widest opacity-40 uppercase tracking-[0.2em]">Tape Dynamic</span>
                    </div>

                    <div className="mt-6 space-y-1 text-right">
                        <div className="text-5xl font-black tabular-nums tracking-tighter transition-all">
                            {result.toLocaleString()}
                        </div>
                        {buffer && (
                            <div className="text-xl font-black text-blue-400 animate-pulse flex items-center justify-end gap-2.5 mt-1.5">
                                <span className="text-[10px] opacity-60 font-black px-1.5 py-0.5 bg-blue-500/20 rounded-md">{opSigns[nextOp]}</span>
                                {buffer}
                                <span className="w-1.5 h-5 bg-blue-400 animate-caret"></span>
                            </div>
                        )}
                        {!buffer && (
                            <div className="text-[9px] font-black text-slate-500 uppercase flex items-center justify-end gap-2 pt-1.5">
                                <span className="opacity-30">Pending</span>
                                <span className="px-2 py-0.5 bg-slate-700/80 rounded-lg text-slate-200 border border-slate-600/50 shadow-inner font-black">{opSigns[nextOp]}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tape Section (Optimized Flow) */}
                <div className="flex-1 overflow-auto p-6 md:p-8 custom-scrollbar bg-slate-50/10 min-h-[150px]">
                    <div className={`flex flex-wrap ${containerGap} items-center content-start`}>
                        {calcItems.map((item, idx) => (
                            <React.Fragment key={item.id}>
                                {idx > 0 && (
                                    <span className={`${opSize} font-black text-slate-300 mx-0.5`}>{opSigns[item.op]}</span>
                                )}
                                <div className="group relative">
                                    <div className={`${chipPadding} ${chipFontSize} ${chipGap} rounded-[1.25rem] font-black border-2 transition-all flex items-center ${item.type === 'cell' ? 'bg-blue-50/50 border-blue-100/50 text-blue-700' : item.type === 'history' ? 'bg-emerald-50/50 border-emerald-100/50 text-emerald-700' : 'bg-white border-slate-200 text-slate-700 shadow-sm'}`}>
                                        {item.text}
                                        <button
                                            onClick={() => removeItem(item.id)}
                                            className="w-5 h-5 rounded-full bg-slate-200/50 text-slate-400 hover:bg-red-500 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-all font-black"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}
                        {calcItems.length === 0 && !buffer && (
                            <div className="w-full py-8 text-center space-y-3">
                                <p className="text-slate-400 text-xs font-bold leading-relaxed opacity-60">
                                    Ready to Calculate
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Quick Controls */}
                <div className="px-8 py-4 border-t border-slate-100 bg-white grid grid-cols-4 gap-4">
                    {(['add', 'sub', 'mul', 'div'] as OpType[]).map(op => (
                        <button
                            key={op}
                            onClick={() => setNextOp(op)}
                            className={`h-11 flex items-center justify-center rounded-2xl text-xl font-black transition-all ${nextOp === op ? 'bg-blue-600 text-white shadow-xl shadow-blue-200' : 'bg-slate-100/70 text-slate-400 hover:bg-slate-200 hover:text-slate-600'}`}
                        >
                            {opSigns[op]}
                        </button>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-6 bg-slate-50/30 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <button
                        onClick={clearAll}
                        className="py-3 px-4 bg-white border-2 border-slate-200 text-slate-600 rounded-[1.5rem] text-base font-black hover:bg-slate-100 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                    >
                        초기화
                    </button>
                    <button
                        onClick={saveResult}
                        className="py-3 px-4 bg-blue-600 text-white rounded-[1.5rem] text-base font-black hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                        결과 저장
                    </button>
                </div>
            </div>
            <style jsx>{`
                @keyframes caret {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0; }
                }
                .animate-caret {
                    animation: caret 1s infinite;
                }
                .custom-scrollbar-light::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar-light::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar-light::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                }
            `}</style>
        </div>
    );
};

export default SmartCalculator;
