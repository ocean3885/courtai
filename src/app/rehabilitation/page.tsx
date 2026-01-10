'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';

export default function RehabilitationPage() {
  const [creditorFile, setCreditorFile] = useState<File | null>(null);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [creditorTxtFile, setCreditorTxtFile] = useState<File | null>(null);
  const [planTxtFile, setPlanTxtFile] = useState<File | null>(null);
  const [parsingDone, setParsingDone] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [creditorPrompt, setCreditorPrompt] = useState('');
  const [planPrompt, setPlanPrompt] = useState('');
  const [isEditingCreditorPrompt, setIsEditingCreditorPrompt] = useState(false);
  const [isEditingPlanPrompt, setIsEditingPlanPrompt] = useState(false);
  // Using Record<string, any> to allow any structure while satisfying TypeScript
  const [result, setResult] = useState<Record<string, any> | null>(null);

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

    setAnalyzing(true);
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
      setAnalyzing(false);
    }
  };

  const handleStructuring = async () => {
    setAnalyzing(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('creditorPrompt', creditorPrompt);
      formData.append('planPrompt', planPrompt);
      formData.append('mode', 'structure');
      
      if (creditorTxtFile) formData.append('creditorTxt', creditorTxtFile);
      if (planTxtFile) formData.append('planTxt', planTxtFile);

      const response = await fetch('/api/rehabilitation/process', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json();
      if (json.success) {
        setResult(json.data);
      } else {
        throw new Error(json.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 에러가 발생했습니다.';
      alert('구조화 중 에러 발생: ' + errorMessage);
    } finally {
      setAnalyzing(false);
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
              <span className="mr-2">1️⃣</span> PDF 텍스트 추출 (Upstage)
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

            <button
              onClick={handleParsing}
              disabled={analyzing || !creditorFile || !planFile}
              className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 disabled:bg-gray-400 shadow-lg shadow-blue-100"
            >
              {analyzing && !parsingDone ? '파싱 중...' : 'PDF 파싱 시작'}
            </button>

            {parsingDone && (
              <p className="text-center text-sm font-medium text-green-600 animate-pulse bg-green-50 py-2 rounded-lg">
                ✅ 텍스트 분석이 완료되었습니다. 이제 데이터 구조화를 진행하세요.
              </p>
            )}
          </div>

          <div className={`bg-white p-6 rounded-2xl border border-green-100 shadow-sm space-y-6 transition-opacity duration-300 ${!parsingDone && !creditorTxtFile && !planTxtFile ? 'opacity-80' : 'opacity-100'}`}>
            <h3 className="font-bold text-gray-900 text-xl flex items-center">
              <span className="mr-2">2️⃣</span> 데이터 구조화 (OpenAI)
            </h3>
              
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
                    className={`w-full h-24 p-2 border rounded-lg text-[12px] outline-none transition-all ${isEditingCreditorPrompt ? 'border-green-500 bg-white ring-2 ring-green-100' : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
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
                    className={`w-full h-24 p-2 border rounded-lg text-[12px] outline-none transition-all ${isEditingPlanPrompt ? 'border-green-500 bg-white ring-2 ring-green-100' : 'border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed'}`}
                    placeholder="변제계획안 LLM 프롬프트..."
                    value={planPrompt}
                    onChange={(e) => setPlanPrompt(e.target.value)}
                    readOnly={!isEditingPlanPrompt}
                  />
                </div>
              </div>

              <button
                onClick={handleStructuring}
                disabled={analyzing || (!parsingDone && !creditorTxtFile && !planTxtFile)}
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:bg-gray-300 transition-colors"
              >
                {analyzing ? (parsingDone ? '변환 중...' : '처리 중...') : 'OpenAI 데이터 구조화'}
              </button>
              {result && (
                <p className="text-center text-sm font-medium text-green-600">
                  ✅ 데이터 변환 및 검증이 완료되었습니다.
                </p>
              )}
            </div>
          </div>

        {/* 결과 섹션 */}
        {result && !analyzing && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* 요약 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">추출된 채권자 수</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.structuredCreditors?.length || 0}명
                </p>
              </div>
              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-500 mb-1">채권 총액 (추출 데이터 기준)</p>
                <p className="text-2xl font-bold text-gray-900">
                  {result.structuredCreditors?.reduce((acc: number, curr: any) => acc + (curr.total || 0), 0).toLocaleString()}원
                </p>
              </div>
            </div>

            {/* JSON 데이터 원본 */}
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="mr-2">📊</span> 구조화 결과 (JSON)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">채권자목록</p>
                  <pre className="bg-gray-900 text-green-400 p-4 rounded-xl overflow-auto text-[10px] h-64 font-mono leading-relaxed">
                    {JSON.stringify(result.structuredCreditors, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2">변제계획안</p>
                  <pre className="bg-gray-900 text-blue-400 p-4 rounded-xl overflow-auto text-[10px] h-64 font-mono leading-relaxed">
                    {JSON.stringify(result.structuredPlan, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {analyzing && !parsingDone && (
          <div className="py-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-100">
            <div className="w-12 h-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">Upstage Layout Analysis 진행 중...</p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
