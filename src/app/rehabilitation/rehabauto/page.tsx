'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import Link from 'next/link';

export default function RehabAutoPage() {
    const router = useRouter();

    // File states
    const [creditorFile, setCreditorFile] = useState<File | null>(null);
    const [planFile, setPlanFile] = useState<File | null>(null);

    // Progress states
    const [status, setStatus] = useState<'idle' | 'validating' | 'parsing' | 'structuring' | 'saving' | 'done' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    // Prompts (need to load)
    const [creditorPrompt, setCreditorPrompt] = useState('');
    const [planPrompt, setPlanPrompt] = useState('');

    useEffect(() => {
        const loadPrompts = async () => {
            try {
                const res = await fetch('/api/rehabilitation/prompts');
                const json = await res.json();
                if (json.success) {
                    setCreditorPrompt(json.data.creditorPrompt);
                    setPlanPrompt(json.data.planPrompt);
                }
            } catch (err) {
                console.error('Failed to load prompts:', err);
            }
        };
        loadPrompts();
    }, []);

    // File Validation (Same as rehabilitation page)
    const validateFiles = async () => {
        if (!creditorFile || !planFile) {
            setValidationError(null);
            return;
        }

        setStatus('validating');
        setValidationError(null);

        try {
            const formData = new FormData();
            formData.append('creditor', creditorFile);
            formData.append('plan', planFile);

            const res = await fetch('/api/rehabilitation/validate', {
                method: 'POST',
                body: formData,
            });
            const json = await res.json();

            if (json.success) {
                const data = json.data;
                let err = data.globalError;
                if (!err && data.creditor.error) err = data.creditor.error;
                if (!err && data.plan.error) err = data.plan.error;

                setValidationError(err || null);
            }
        } catch (err) {
            console.error('Validation failed:', err);
        } finally {
            setStatus('idle');
        }
    };

    useEffect(() => {
        validateFiles();
    }, [creditorFile, planFile]);

    const handleStartAnalysis = async () => {
        if (!creditorFile || !planFile) {
            alert('두 파일을 모두 선택해주세요.');
            return;
        }
        if (validationError) {
            alert(validationError);
            return;
        }

        setStatus('parsing');
        setErrorMessage(null);

        try {
            // 1. PDF Parsing
            const parseFormData = new FormData();
            parseFormData.append('creditorFile', creditorFile);
            parseFormData.append('planFile', planFile);
            parseFormData.append('mode', 'parse');

            const parseRes = await fetch('/api/rehabilitation/process', {
                method: 'POST',
                body: parseFormData,
            });
            const parseJson = await parseRes.json();
            if (!parseJson.success) throw new Error(parseJson.error || 'PDF 파싱 실패');

            // 2. LLM Structuring (Gemini 2.0 Flash fixed)
            setStatus('structuring');
            const structFormData = new FormData();
            structFormData.append('creditorPrompt', creditorPrompt);
            structFormData.append('planPrompt', planPrompt);
            structFormData.append('mode', 'structure');
            structFormData.append('modelType', 'gemini');
            structFormData.append('modelVersion', 'gemini-2.0-flash-exp');

            const structRes = await fetch('/api/rehabilitation/process', {
                method: 'POST',
                body: structFormData,
            });
            const structJson = await structRes.json();
            if (!structJson.success) throw new Error(structJson.error || '데이터 구조화 실패');

            // 3. Save to DB
            setStatus('saving');
            const resultData = structJson.data;

            const extractCaseNumber = (file: File | null) => {
                if (!file) return null;
                const match = file.name.replace(/\s/g, '').match(/20[0-2][0-9]개회[0-9]+/);
                return match ? match[0] : null;
            };

            const caseNumber = extractCaseNumber(creditorFile) || extractCaseNumber(planFile) || `미분류_${new Date().toLocaleDateString()}`;

            const saveRes = await fetch('/api/rehabilitation/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: caseNumber,
                    creditor_data: typeof resultData.structuredCreditors === 'string' ? resultData.structuredCreditors : JSON.stringify(resultData.structuredCreditors),
                    plan_data: typeof resultData.structuredPlan === 'string' ? resultData.structuredPlan : JSON.stringify(resultData.structuredPlan),
                    memo: ''
                })
            });

            const saveJson = await saveRes.json();
            if (saveJson.success) {
                setStatus('done');
                router.push(`/rehabilitation/results/${saveJson.id}`);
            } else {
                throw new Error(saveJson.error || '저장 실패');
            }

        } catch (err: any) {
            console.error('Analysis failed:', err);
            setErrorMessage(err.message || '분석 중 오류가 발생했습니다.');
            setStatus('error');
        }
    };

    return (
        <MainLayout>
            <div className="max-w-3xl mx-auto py-10 space-y-12">
                <div className="text-center space-y-6">
                    <h1 className="text-6xl font-bold text-slate-900 tracking-tight">원클릭 서류 변환</h1>
                    <p className="text-xl text-slate-600 font-medium max-w-lg mx-auto leading-relaxed">
                        파일을 올리고 버튼 하나로 변환부터 저장까지 완료하세요.
                    </p>
                    <div className="bg-amber-50 border border-amber-100 py-3 px-6 rounded-2xl inline-block">
                        <p className="text-amber-800 text-sm font-semibold flex items-center gap-2">
                            <span>💡</span> 반드시 <span className="text-amber-900 font-bold underline underline-offset-4 decoration-amber-300">동일한 사건</span>의 채권자 목록과 변제계획안 파일을 함께 첨부해 주세요.
                        </p>
                    </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-slate-200/50 space-y-10 relative overflow-hidden">
                    {/* Background Detail */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50 rounded-full -mr-32 -mt-32 opacity-50 blur-3xl pointer-events-none"></div>

                    <div className="relative">
                        <label className={`block group cursor-pointer ${status !== 'idle' ? 'pointer-events-none grayscale' : ''}`}>
                            <div className={`min-h-[300px] rounded-3xl border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center p-10 gap-6 ${creditorFile && planFile ? 'bg-blue-50/30 border-blue-200' : 'bg-slate-50 border-slate-300 hover:border-blue-400 hover:bg-white'
                                }`}>
                                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-4xl transition-transform duration-500 group-hover:scale-110 ${creditorFile && planFile ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'bg-white text-slate-400 shadow-sm'
                                    }`}>
                                    {creditorFile && planFile ? '✨' : '📂'}
                                </div>
                                <div className="text-center space-y-2">
                                    <p className="text-xl font-bold text-slate-700">
                                        {creditorFile && planFile ? '서류 준비 완료' : 'PDF 서류를 여기에 끌어다 놓으세요'}
                                    </p>
                                    <p className="text-sm text-slate-400 font-medium">최대 2개의 파일을 한번에 선택할 수 있습니다</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-4">
                                    <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${creditorFile ? 'bg-white border-blue-100 shadow-sm' : 'bg-slate-100/50 border-slate-200 text-slate-400'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${creditorFile ? 'bg-blue-50 text-blue-600' : 'bg-slate-200'}`}>📄</div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[10px] font-black uppercase tracking-wider opacity-50">채권자 목록</p>
                                            <p className="text-sm font-bold truncate">{creditorFile ? creditorFile.name : '미선택'}</p>
                                        </div>
                                    </div>
                                    <div className={`p-4 rounded-2xl border flex items-center gap-3 transition-all ${planFile ? 'bg-white border-emerald-100 shadow-sm' : 'bg-slate-100/50 border-slate-200 text-slate-400'}`}>
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${planFile ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-200'}`}>📊</div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <p className="text-[10px] font-black uppercase tracking-wider opacity-50">변제계획안</p>
                                            <p className="text-sm font-bold truncate">{planFile ? planFile.name : '미선택'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <span className="px-6 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-full hover:bg-black transition-colors">
                                        파일 선택하기
                                    </span>
                                </div>
                            </div>
                            <input
                                type="file"
                                className="hidden"
                                accept=".pdf"
                                multiple
                                onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    let cred: File | null = null;
                                    let plan: File | null = null;

                                    files.forEach(file => {
                                        const name = file.name;
                                        if (name.includes('채권') || name.includes('목록')) cred = file;
                                        else if (name.includes('계획') || name.includes('계계')) plan = file;
                                    });

                                    // If not identified by name, just assign by order if 2 files
                                    if (files.length === 2 && (!cred || !plan)) {
                                        cred = files[0];
                                        plan = files[1];
                                    }

                                    setCreditorFile(cred);
                                    setPlanFile(plan);
                                }}
                            />
                        </label>
                        {(creditorFile || planFile) && (
                            <button
                                onClick={() => { setCreditorFile(null); setPlanFile(null); }}
                                className="absolute -top-3 -right-3 w-10 h-10 bg-white border border-slate-100 shadow-xl rounded-full flex items-center justify-center text-sm hover:text-rose-500 transition-colors z-10"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {validationError && (
                        <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl flex items-start gap-4 animate-in slide-in-from-top-2 duration-300">
                            <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center text-xl shadow-sm border border-rose-100">⚠️</div>
                            <div className="flex-1">
                                <p className="text-rose-900 font-bold text-sm leading-relaxed whitespace-pre-wrap">{validationError}</p>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleStartAnalysis}
                        disabled={status !== 'idle' || !creditorFile || !planFile || !!validationError}
                        className={`w-full py-5 rounded-2xl font-bold text-xl transition-all duration-300 active:scale-[0.98] flex items-center justify-center gap-4 ${status !== 'idle' || !creditorFile || !planFile || !!validationError
                            ? 'bg-slate-200 text-slate-500 cursor-not-allowed border-2 border-slate-300/50'
                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-200 border-2 border-blue-400/50'
                            }`}
                    >
                        {status === 'idle' ? (
                            <>
                                <span>🚀 변환 시작하기</span>
                            </>
                        ) : (
                            <div className="flex items-center gap-4">
                                <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                                <span>
                                    {status === 'validating' && '파일 검사 중...'}
                                    {status === 'parsing' && '데이터 추출 중...'}
                                    {status === 'structuring' && 'AI 변환 진행 중...'}
                                    {status === 'saving' && '데이터베이스 저장 중...'}
                                </span>
                            </div>
                        )}
                    </button>

                    {errorMessage && (
                        <p className="text-center text-rose-500 font-bold text-sm bg-rose-50 py-3 rounded-2xl border border-rose-100 mx-auto max-w-sm">
                            ❌ {errorMessage}
                        </p>
                    )}

                    {status !== 'idle' && (
                        <div className="pt-2">
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full bg-blue-600 transition-all duration-1000 ${status === 'parsing' ? 'w-1/4' :
                                    status === 'structuring' ? 'w-2/3' :
                                        status === 'saving' ? 'w-[90%]' : 'w-0'
                                    }`}></div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <Link href="/rehabilitation/results" className="text-slate-400 font-bold text-sm hover:text-slate-600 transition-colors inline-flex items-center gap-2">
                        <span>📂 내 사건목록</span>
                        <span className="opacity-50">→</span>
                    </Link>
                </div>
            </div>
        </MainLayout>
    );
}
