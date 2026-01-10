'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';

export default function RehabilitationPage() {
  const router = useRouter();
  const [creditorFile, setCreditorFile] = useState<File | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [creditorTxtFile, setCreditorTxtFile] = useState<File | null>(null);
  const [planTxtFile, setPlanTxtFile] = useState<File | null>(null);
  const [parsingDone, setParsingDone] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isStructuring, setIsStructuring] = useState(false);
  const [creditorPrompt, setCreditorPrompt] = useState('');
  const [planPrompt, setPlanPrompt] = useState('');
  const [isEditingCreditorPrompt, setIsEditingCreditorPrompt] = useState(false);
  const [isEditingPlanPrompt, setIsEditingPlanPrompt] = useState(false);
  // Using Record<string, any> to allow any structure while satisfying TypeScript
  const [result, setResult] = useState<Record<string, any> | null>(null);
  const [modelType, setModelType] = useState('gemini');
  const [modelVersion, setModelVersion] = useState('gemini-2.0-flash-exp');
  const [validationErrorStep1, setValidationErrorStep1] = useState<string | null>(null);
  const [validationErrorStep2, setValidationErrorStep2] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [memo, setMemo] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load prompts from local files via API
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

  const validateFiles = async (step: 1 | 2) => {
    const cred = step === 1 ? creditorFile : creditorTxtFile;
    const plan = step === 1 ? planFile : planTxtFile;
    const setError = step === 1 ? setValidationErrorStep1 : setValidationErrorStep2;

    if (!cred || !plan) {
      setError(null);
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('creditor', cred);
      formData.append('plan', plan);

      const res = await fetch('/api/rehabilitation/validate', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (json.success) {
        const data = json.data;
        let errorMessage = data.globalError;
        if (!errorMessage && data.creditor.error) errorMessage = data.creditor.error;
        if (!errorMessage && data.plan.error) errorMessage = data.plan.error;

        setError(errorMessage || null);
      }
    } catch (err) {
      console.error('Validation failed:', err);
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    validateFiles(1);
  }, [creditorFile, planFile]);

  useEffect(() => {
    validateFiles(2);
  }, [creditorTxtFile, planTxtFile]);

  const savePrompt = async (type: 'creditor' | 'plan', content: string) => {
    try {
      const res = await fetch('/api/rehabilitation/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content })
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다.';
      alert('프롬프트 저장 실패: ' + errorMessage);
    }
  };

  const handleParsing = async () => {
    if (!creditorFile || !planFile) {
      alert('채권자 목록과 변제계획표 PDF 파일을 모두 선택해 주세요.');
      return;
    }

    setIsParsing(true);
    setParsingDone(false);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('creditorFile', creditorFile);
      formData.append('planFile', planFile);
      formData.append('mode', 'parse');

      const response = await fetch('/api/rehabilitation/process', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        setParsingDone(true);
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다.';
      alert('파싱 중 에러 발생: ' + errorMessage);
    } finally {
      setIsParsing(false);
    }
  };

  const handleStructuring = async () => {
    setIsStructuring(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('creditorPrompt', creditorPrompt);
      formData.append('planPrompt', planPrompt);
      formData.append('mode', 'structure');
      formData.append('modelType', modelType);
      formData.append('modelVersion', modelVersion);

      if (creditorTxtFile) formData.append('creditorTxt', creditorTxtFile);
      if (planTxtFile) formData.append('planTxt', planTxtFile);

      const response = await fetch('/api/rehabilitation/process', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        setResult(json.data);
        // LLM 분석 완료 후 자동 저장 및 이동
        await handleAutoSave(json.data);
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다.';
      alert('구조화 중 에러 발생: ' + errorMessage);
    } finally {
      setIsStructuring(false);
    }
  };

  const handleAutoSave = async (resultData: any) => {
    setIsSaving(true);
    try {
      const extractCaseNumber = (file: File | null) => {
        if (!file) return null;
        const match = file.name.replace(/\s/g, '').match(/20[0-2][0-9]개회[0-9]+/);
        return match ? match[0] : null;
      };

      const caseNumber = extractCaseNumber(creditorFile) || extractCaseNumber(planFile) || extractCaseNumber(creditorTxtFile) || extractCaseNumber(planTxtFile) || `미분류_${new Date().toLocaleDateString()}`;

      const res = await fetch('/api/rehabilitation/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: caseNumber,
          creditor_data: typeof resultData.structuredCreditors === 'string' ? resultData.structuredCreditors : JSON.stringify(resultData.structuredCreditors),
          plan_data: typeof resultData.structuredPlan === 'string' ? resultData.structuredPlan : JSON.stringify(resultData.structuredPlan),
          memo: '' // 자동 저장 시 메모는 빈값
        })
      });

      const json = await res.json();
      if (json.success) {
        // 성공 시 상세 페이지로 즉시 이동
        router.push(`/rehabilitation/results/${json.id}`);
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
      alert('자동 저장 중 실패했습니다. 결과 목록에서 확인해 주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveResult = async () => {
    if (!result) return;

    setIsSaving(true);
    try {
      // 사건번호 추출 로직
      const extractCaseNumber = (file: File | null) => {
        if (!file) return null;
        const match = file.name.replace(/\s/g, '').match(/20[0-2][0-9]개회[0-9]+/);
        return match ? match[0] : null;
      };

      const caseNumber = extractCaseNumber(creditorFile) || extractCaseNumber(planFile) || extractCaseNumber(creditorTxtFile) || extractCaseNumber(planTxtFile) || `미분류_${new Date().toLocaleDateString()}`;

      const res = await fetch('/api/rehabilitation/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: caseNumber,
          creditor_data: typeof result.structuredCreditors === 'string' ? result.structuredCreditors : JSON.stringify(result.structuredCreditors),
          plan_data: typeof result.structuredPlan === 'string' ? result.structuredPlan : JSON.stringify(result.structuredPlan),
          memo
        })
      });

      const json = await res.json();
      if (json.success) {
        alert('분석 결과가 성공적으로 저장되었습니다.');
        setMemo('');
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      alert('저장 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">개인회생 서류 자동 분석</h1>
          <p className="text-gray-600 mt-2">
            AI를 통해 채권자목록과 변제계획안의 오류를 분석해 드립니다.
          </p>
        </div>

        {/* 추출 및 구조화 섹션 */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-6">
            <h3 className="font-bold text-gray-900 text-xl flex items-center">
              <span className="mr-2">1️⃣</span> PDF 텍스트 추출 (pdfplumber)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  채권자 목록 (PDF)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="text-2xl mb-2">📄</span>
                      <p className="text-xs md:text-sm text-gray-500 px-2 text-center">
                        {creditorFile ? creditorFile.name : '파일을 클릭하거나 드래그하세요'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => setCreditorFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  변제계획안 (PDF)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="text-2xl mb-2">📊</span>
                      <p className="text-xs md:text-sm text-gray-500 px-2 text-center">
                        {planFile ? planFile.name : '파일을 클릭하거나 드래그하세요'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => setPlanFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </div>

            {validationErrorStep1 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                <span className="mt-0.5">⚠️</span>
                <p>{validationErrorStep1}</p>
              </div>
            )}

            <button
              onClick={handleParsing}
              disabled={isParsing || isStructuring || !creditorFile || !planFile || !!validationErrorStep1 || isValidating}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-gray-400 shadow-lg shadow-blue-100 placeholder-m-8"
            >
              {isValidating ? '파일 검사 중...' : (isParsing ? '파싱 중...' : 'PDF 파싱 시작')}
            </button>

            {parsingDone && (
              <p className="text-center text-sm font-medium text-green-600 animate-pulse bg-green-50 py-2 rounded-lg">
                ✅ 텍스트 분석이 완료되었습니다. 이제 데이터 구조화를 진행하세요.
              </p>
            )}
          </div>

          <div className={`bg-white p-6 rounded-2xl border border-green-100 shadow-sm space-y-6 transition-opacity duration-300 ${!parsingDone && !creditorTxtFile && !planTxtFile ? 'opacity-80' : 'opacity-100'}`}>
            <h3 className="font-bold text-gray-900 text-xl flex items-center">
              <span className="mr-2">2️⃣</span> 데이터 구조화 (OpenAI / Gemini)
            </h3>

            <div className="flex gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Model Type</label>
                <select
                  value={modelType}
                  onChange={(e) => {
                    setModelType(e.target.value);
                    setModelVersion(e.target.value === 'openai' ? 'gpt-4o' : 'gemini-2.0-flash-exp');
                  }}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-semibold"
                >
                  <option value="openai">OpenAI</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Model Version</label>
                <select
                  value={modelVersion}
                  onChange={(e) => setModelVersion(e.target.value)}
                  className="w-full p-2 border border-gray-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 transition-all font-semibold"
                >
                  {modelType === 'openai' ? (
                    <>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                    </>
                  ) : (
                    <>
                      <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                      <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-green-50 p-4 rounded-xl border border-green-100">
              <div>
                <label className="block text-xs font-semibold text-green-800 mb-2">
                  채권자 목록 (TXT)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-green-200 border-dashed rounded-lg cursor-pointer bg-white hover:bg-green-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <span className="text-xl mb-1">📄</span>
                      <p className="text-[10px] text-gray-500 px-2 text-center">
                        {creditorTxtFile ? creditorTxtFile.name : '파일 선택'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt"
                      onChange={(e) => setCreditorTxtFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-green-800 mb-2">
                  변제계획안 (TXT)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-green-200 border-dashed rounded-lg cursor-pointer bg-white hover:bg-green-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-2 pb-2">
                      <span className="text-xl mb-1">📊</span>
                      <p className="text-[10px] text-gray-500 px-2 text-center">
                        {planTxtFile ? planTxtFile.name : '파일 선택'}
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt"
                      onChange={(e) => setPlanTxtFile(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">채권자목록 추출 프롬프트</label>
                  <button
                    onClick={() => {
                      if (isEditingCreditorPrompt) {
                        savePrompt('creditor', creditorPrompt);
                      }
                      setIsEditingCreditorPrompt(!isEditingCreditorPrompt);
                    }}
                    className={`text-[10px] px-2 py-1 rounded ${isEditingCreditorPrompt ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {isEditingCreditorPrompt ? '저장' : '수정'}
                  </button>
                </div>
                <textarea
                  className={`w-full p-2 border rounded-lg text-[12px] outline-none transition-all duration-300 ${isEditingCreditorPrompt ? 'min-h-[500px] border-green-500 bg-white ring-2 ring-green-100' : 'h-24 border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
                  placeholder="채권자목록 LLM 프롬프트..."
                  value={creditorPrompt}
                  onChange={(e) => setCreditorPrompt(e.target.value)}
                  readOnly={!isEditingCreditorPrompt}
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">변제계획안 추출 프롬프트</label>
                  <button
                    onClick={() => {
                      if (isEditingPlanPrompt) {
                        savePrompt('plan', planPrompt);
                      }
                      setIsEditingPlanPrompt(!isEditingPlanPrompt);
                    }}
                    className={`text-[10px] px-2 py-1 rounded ${isEditingPlanPrompt ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    {isEditingPlanPrompt ? '저장' : '수정'}
                  </button>
                </div>
                <textarea
                  className={`w-full p-2 border rounded-lg text-[12px] outline-none transition-all duration-300 ${isEditingPlanPrompt ? 'min-h-[500px] border-green-500 bg-white ring-2 ring-green-100' : 'h-24 border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
                  placeholder="변제계획안 LLM 프롬프트..."
                  value={planPrompt}
                  onChange={(e) => setPlanPrompt(e.target.value)}
                  readOnly={!isEditingPlanPrompt}
                />
              </div>
            </div>

            {validationErrorStep2 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-600 text-sm">
                <span className="mt-0.5">⚠️</span>
                <p>{validationErrorStep2}</p>
              </div>
            )}

            <button
              onClick={handleStructuring}
              disabled={isParsing || isStructuring || !(parsingDone || (creditorTxtFile && planTxtFile)) || !!validationErrorStep2 || isValidating}
              className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
            >
              {isValidating ? '파일 검사 중...' : (isStructuring ? '데이터 분석 중입니다...' : '데이터 구조화')}
            </button>
            {result && (
              <p className="text-center text-sm font-medium text-green-600">
                ✅ 데이터 변환 및 검증이 완료되었습니다.
              </p>
            )}
          </div>
        </div>

        {/* 결과 섹션 */}
        {result && !isStructuring && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 저장 및 메모 섹션 */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 mt-8 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📊</span>
                <h3 className="text-xl font-bold text-gray-900">분석 결과 처리</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">구조화된 데이터가 준비되었습니다. 아래 메모를 작성하여 저장할 수 있습니다.</p>

              <div className="pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">사건 메모 (선택사항)</label>
                  <textarea
                    className="w-full p-4 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all h-24"
                    placeholder="해당 사건에 대한 특이사항이나 메모를 입력하세요."
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSaveResult}
                  disabled={isSaving}
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '분석 결과 저장하기 (DB)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {isParsing && (
          <div className="py-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">Upstage Layout Analysis 진행 중...</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
