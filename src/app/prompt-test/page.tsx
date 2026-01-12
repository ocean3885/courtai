'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MainLayout } from '@/components/layout';
import { useRouter } from 'next/navigation';

interface Result {
  id: string;
  model: string;
  prompt: string;
  input: string;
  output: string;
  timestamp: string;
  executionTime: number;
}

interface SavedPrompt {
  id: number;
  name: string;
  prompt: string;
  model: string;
  category?: string;
  is_favorite: number;
  created_at: string;
  updated_at: string;
}

export default function PromptTestPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [selectedModel, setSelectedModel] = useState<'gemini' | 'openai'>('gemini');
  const [prompt, setPrompt] = useState('');
  const [promptName, setPromptName] = useState('');
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPromptManager, setShowPromptManager] = useState(false);
  const [selectedPromptToUpdate, setSelectedPromptToUpdate] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsEndRef = useRef<HTMLDivElement>(null);

  // 함수 정의들 (useEffect 이전)
  const loadRecentPrompt = async () => {
    try {
      const res = await fetch('/api/prompts/recent');
      const data = await res.json();
      if (res.ok && data.prompt) {
        setPrompt(data.prompt.prompt);
        setSelectedModel(data.prompt.model as 'gemini' | 'openai');
      }
    } catch (error) {
      console.error('Failed to load recent prompt:', error);
    }
  };

  const loadSavedPrompts = async () => {
    try {
      const res = await fetch('/api/prompts');
      const data = await res.json();
      if (res.ok) {
        setSavedPrompts(data.prompts || []);
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  };

  // 관리자 권한 확인
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        
        if (!data.user || data.user.role !== 'ADMIN') {
          router.push('/');
          return;
        }
        
        setIsAdmin(true);
        // 프롬프트 목록 로드
        await loadSavedPrompts();
        // 최근 프롬프트 로드
        await loadRecentPrompt();
      } catch (error) {
        router.push('/');
      }
    };

    checkAdmin();
  }, [router]);

  if (isAdmin === null) {
    return <MainLayout><div className="p-8">로딩 중...</div></MainLayout>;
  }

  if (!isAdmin) {
    return <MainLayout><div className="p-8">접근 권한이 없습니다.</div></MainLayout>;
  }

  const handleSavePrompt = async () => {
    if (!promptName.trim() || !prompt.trim()) {
      setError('프롬프트 이름과 내용을 입력해주세요.');
      return;
    }

    try {
      if (selectedPromptToUpdate) {
        // 기존 프롬프트 덮어씌우기
        const res = await fetch(`/api/prompts/${selectedPromptToUpdate}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: promptName,
            prompt,
            model: selectedModel,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '프롬프트 업데이트 실패');
        }
      } else {
        // 새로운 프롬프트 저장
        const res = await fetch('/api/prompts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: promptName,
            prompt,
            model: selectedModel,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '프롬프트 저장 실패');
        }
      }

      setPromptName('');
      setSelectedPromptToUpdate(null);
      setShowSaveDialog(false);
      await loadSavedPrompts();
    } catch (err: any) {
      setError(err.message || '프롬프트 저장 중 오류가 발생했습니다.');
    }
  };

  const handleLoadPrompt = (savedPrompt: SavedPrompt) => {
    setPrompt(savedPrompt.prompt);
    setSelectedModel(savedPrompt.model as 'gemini' | 'openai');
    setShowPromptManager(false);
  };

  const handleDeletePrompt = async (id: number) => {
    if (!confirm('이 프롬프트를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/prompts/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '프롬프트 삭제 실패');
      }

      await loadSavedPrompts();
    } catch (err: any) {
      setError(err.message || '프롬프트 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleUpdatePromptFavorite = async (id: number, isFavorite: number) => {
    try {
      const res = await fetch(`/api/prompts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorite: isFavorite ? 0 : 1 }),
      });

      if (res.ok) {
        await loadSavedPrompts();
      }
    } catch (error) {
      console.error('Failed to update favorite:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const scrollToResults = () => {
    setTimeout(() => {
      resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleExecute = async () => {
    if (!prompt.trim() || !inputText.trim()) {
      setError('프롬프트와 입력 텍스트를 모두 입력해주세요.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      
      const res = await fetch('/api/prompt-test/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt,
          inputText,
        }),
      });

      const endTime = performance.now();
      const executionTime = Math.round(endTime - startTime);

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || '요청 실행 중 오류가 발생했습니다.');
      }

      const newResult: Result = {
        id: Date.now().toString(),
        model: selectedModel,
        prompt,
        input: inputText.substring(0, 100) + (inputText.length > 100 ? '...' : ''),
        output: data.result,
        timestamp: new Date().toLocaleString('ko-KR'),
        executionTime,
      };

      setResults([newResult, ...results]);
      scrollToResults();
    } catch (err: any) {
      setError(err.message || '요청 실행 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 text-gray-900">프롬프트 테스트</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 입력 영역 */}
          <div className="space-y-6">
            {/* 모델 선택 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                모델 선택
              </label>
              <div className="flex gap-4">
                {(['gemini', 'openai'] as const).map((model) => (
                  <label key={model} className="flex items-center">
                    <input
                      type="radio"
                      name="model"
                      value={model}
                      checked={selectedModel === model}
                      onChange={(e) => setSelectedModel(e.target.value as 'gemini' | 'openai')}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {model === 'gemini' ? 'Gemini' : 'OpenAI (GPT-4o)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 파일 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                TXT 파일 첨부
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <p className="text-xs text-gray-500 mt-1">
                또는 아래에 직접 텍스트를 입력해주세요.
              </p>
            </div>

            {/* 입력 텍스트 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                입력 텍스트
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="TXT 파일을 업로드하거나 텍스트를 입력해주세요."
                className="w-full h-40 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                입력된 문자: {inputText.length}
              </p>
            </div>

            {/* 프롬프트 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  프롬프트 (수정 가능)
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowPromptManager(!showPromptManager)}
                    className="text-xs px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                  >
                    📋 불러오기
                  </button>
                  <button
                    onClick={() => setShowSaveDialog(!showSaveDialog)}
                    className="text-xs px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded"
                  >
                    💾 저장
                  </button>
                </div>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="LLM에 보낼 프롬프트를 작성해주세요."
                className="w-full h-40 p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                프롬프트 길이: {prompt.length}
              </p>
            </div>

            {/* 프롬프트 저장 다이얼로그 */}
            {showSaveDialog && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    프롬프트 이름
                  </label>
                  <input
                    type="text"
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    placeholder="저장할 프롬프트 이름을 입력해주세요."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    기존 프롬프트 선택 (선택사항)
                  </label>
                  <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg bg-white">
                    {savedPrompts.length === 0 ? (
                      <p className="text-xs text-gray-500 p-3">저장된 프롬프트가 없습니다.</p>
                    ) : (
                      <div className="space-y-1 p-2">
                        {savedPrompts.map((savedPrompt) => (
                          <div
                            key={savedPrompt.id}
                            onClick={() => {
                              setSelectedPromptToUpdate(savedPrompt.id);
                              setPromptName(savedPrompt.name);
                            }}
                            className={`p-2 rounded cursor-pointer transition-colors ${
                              selectedPromptToUpdate === savedPrompt.id
                                ? 'bg-blue-200 border border-blue-400'
                                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-gray-900 truncate">
                                  {savedPrompt.name}
                                </p>
                                <p className="text-xs text-gray-600 line-clamp-1">
                                  {savedPrompt.prompt}
                                </p>
                              </div>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded ml-2 flex-shrink-0">
                                {savedPrompt.model === 'gemini' ? 'Gemini' : 'OpenAI'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedPromptToUpdate && (
                    <p className="text-xs text-blue-600 mt-2">
                      ✓ 선택한 프롬프트가 덮어씌워집니다
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSavePrompt}
                    className="flex-1 py-2 px-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700"
                  >
                    {selectedPromptToUpdate ? '덮어씌우기' : '새로 저장'}
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveDialog(false);
                      setSelectedPromptToUpdate(null);
                      setPromptName('');
                    }}
                    className="flex-1 py-2 px-3 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 저장된 프롬프트 관리자 */}
            {showPromptManager && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg max-h-80 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">
                  저장된 프롬프트 ({savedPrompts.length})
                </h3>
                {savedPrompts.length === 0 ? (
                  <p className="text-xs text-gray-500">저장된 프롬프트가 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {savedPrompts.map((savedPrompt) => (
                      <div
                        key={savedPrompt.id}
                        className="p-2 bg-white border border-gray-200 rounded flex items-start justify-between gap-2 hover:shadow-sm"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-semibold text-gray-900 truncate">
                              {savedPrompt.name}
                            </p>
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                              {savedPrompt.model === 'gemini' ? 'Gemini' : 'OpenAI'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {savedPrompt.prompt}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(savedPrompt.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleLoadPrompt(savedPrompt)}
                            className="px-2 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-xs font-medium"
                          >
                            로드
                          </button>
                          <button
                            onClick={() => handleUpdatePromptFavorite(savedPrompt.id, savedPrompt.is_favorite)}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              savedPrompt.is_favorite
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {savedPrompt.is_favorite ? '⭐' : '☆'}
                          </button>
                          <button
                            onClick={() => handleDeletePrompt(savedPrompt.id)}
                            className="px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded text-xs font-medium"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 오류 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* 실행 버튼 */}
            <button
              onClick={handleExecute}
              disabled={isLoading || !prompt.trim() || !inputText.trim()}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '실행 중...' : '프롬프트 실행'}
            </button>
          </div>

          {/* 결과 영역 */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">실행 결과</h2>
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  모두 삭제
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-[calc(100vh-300px)] overflow-y-auto">
              {results.length === 0 ? (
                <div className="p-8 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  실행 결과가 여기에 표시됩니다.
                </div>
              ) : (
                results.map((result) => (
                  <div key={result.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                          {result.model === 'gemini' ? 'Gemini' : 'OpenAI'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">{result.timestamp}</p>
                        <p className="text-xs text-gray-500">실행 시간: {result.executionTime}ms</p>
                      </div>
                    </div>

                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">프롬프트:</p>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                        {result.prompt}
                      </p>
                    </div>

                    <div className="mb-3 pb-3 border-b border-gray-200">
                      <p className="text-xs font-medium text-gray-600 mb-1">입력:</p>
                      <p className="text-xs text-gray-700 bg-gray-50 p-2 rounded max-h-20 overflow-y-auto">
                        {result.input}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">결과:</p>
                      <div className="text-sm text-gray-900 bg-green-50 p-3 rounded max-h-32 overflow-y-auto border border-green-200">
                        {typeof result.output === 'string' ? (
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                            {result.output}
                          </pre>
                        ) : (
                          <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                            {JSON.stringify(result.output, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={resultsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
