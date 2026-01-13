'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { useRouter } from 'next/navigation';
import { RepaymentPlanResults } from '@/components/RepaymentPlanResults';

interface Creditor {
  id: string;
  name: string;
  amount: number;
  priority: boolean;
  isSubrogated?: boolean;
  subrogatedName?: string;
  subrogatedAmount?: number;
}

interface PlanResult {
  success: boolean;
  plan: any[];
  statistics: {
    totalCreditors: number;
    totalAmount: number;
    monthlyAvailable: number;
    planMonths: number;
    totalPayment: number;
    differenceAmount: number;
  };
}

export default function CreatePlanPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [creditors, setCreditors] = useState<Creditor[]>([
    { id: '1', name: 'A은행(우선)', amount: 5000000, priority: true, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
    { id: '2', name: 'B카드(일반)', amount: 10000000, priority: false, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
    { id: '3', name: 'C대부(일반)', amount: 15000000, priority: false, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
  ]);
  const [monthlyAvailable, setMonthlyAvailable] = useState(2000000);
  const [months, setMonths] = useState(36);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResult | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);

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

  const handleAddCreditor = () => {
    setCreditors([
      ...creditors,
      {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        priority: false,
        isSubrogated: false,
        subrogatedName: '',
        subrogatedAmount: 0,
      },
    ]);
  };

  const handleRemoveCreditor = (id: string) => {
    setCreditors(creditors.filter(c => c.id !== id));
  };

  const handleUpdateCreditor = (id: string, field: string, value: any) => {
    setCreditors(
      creditors.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    );
  };
  const getAllPlanCreditors = () => {
    const list: any[] = [];
    creditors.forEach(c => {
      list.push({
        id: c.id,
        name: c.name || '채권자명 미입력',
        amount: c.amount,
        priority: c.priority,
        isSubRow: false
      });
      if (c.isSubrogated) {
        list.push({
          id: c.id + '-sub',
          name: c.subrogatedName || `${c.name || '채권자'}-1`,
          amount: c.subrogatedAmount || 0,
          priority: false, // 대위변제자는 항상 일반채권으로 처리
          isSubRow: true
        });
      }
    });
    return list;
  };

  const handleCreatePlan = async () => {
    // 검증
    setIsLoading(true);
    setError(null);

    try {
      const allCreditors = getAllPlanCreditors().filter(c => c.amount > 0);

      if (allCreditors.length === 0) {
        setError('금액이 0보다 큰 채권자가 최소 1명 이상 있어야 합니다.');
        setIsLoading(false);
        return;
      }

      const invalidEntry = allCreditors.find(c => !c.name || !c.name.trim());
      if (invalidEntry) {
        setError('금액이 입력된 모든 채권자의 이름을 입력해주세요.');
        setIsLoading(false);
        return;
      }

      const res = await fetch('/api/create-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creditors: allCreditors.map(c => ({
            id: c.id,
            name: c.name,
            amount: c.amount,
            priority: c.priority,
          })),
          monthlyAvailable,
          months,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '변제계획 생성 실패');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || '변제계획 생성 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
    }).format(value);
  };



  // 템플릿 목록 불러오기
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/plan-templates');
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  };

  const handleSaveTemplate = async (isNew: boolean = false) => {
    // 덮어쓰기 모드 (이미 불러온 템플릿이 있고 '저장' 버튼을 누른 경우)
    if (!isNew && loadedTemplateId) {
      try {
        const res = await fetch(`/api/plan-templates/${loadedTemplateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creditors,
            monthlyAvailable,
            months,
          }),
        });

        if (res.ok) {
          setShowSaveSuccessModal(true);
          setTimeout(() => setShowSaveSuccessModal(false), 2000);
        } else {
          alert('설정 저장에 실패했습니다.');
        }
      } catch (err) {
        alert('오류가 발생했습니다.');
      }
      return;
    }

    // 신규 저장 모드 (로드 안 된 상태의 '저장' 또는 '새로저장')
    if (!templateName.trim()) {
      alert('사건번호를 입력해주세요.');
      return;
    }

    try {
      const res = await fetch('/api/plan-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          creditors,
          monthlyAvailable,
          months,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setShowSaveModal(false);
        setLoadedTemplateId(data.id); // 저장 후 로드 상태로 전환
        setShowSaveSuccessModal(true);
        setTimeout(() => setShowSaveSuccessModal(false), 2000);
      } else {
        alert('설정 저장에 실패했습니다.');
      }
    } catch (err) {
      alert('오류가 발생했습니다.');
    }
  };

  const handleLoadTemplate = async (template: any) => {
    const loadedCreditors = template.creditors.map((c: any, idx: number) => ({
      ...c,
      id: Date.now().toString() + idx,
    }));
    
    // 상태 업데이트
    setCreditors(loadedCreditors);
    setMonthlyAvailable(template.monthlyAvailable);
    setMonths(template.months);
    setTemplateName(template.name);
    setLoadedTemplateId(template.id);
    setShowLoadModal(false);
    
    // 불러온 데이터로 자동 변제계획 생성
    // 1. 서브로우 포함하여 전체 리스트 구성 (getAllPlanCreditors와 동일 로직)
    const expandedCreditors: any[] = [];
    loadedCreditors.forEach((c: any) => {
      expandedCreditors.push({
        id: c.id,
        name: c.name,
        amount: c.amount,
        priority: c.priority,
      });
      if (c.isSubrogated) {
        expandedCreditors.push({
          id: c.id + '-sub',
          name: c.subrogatedName || `${c.name}-1`, // getAllPlanCreditors와 일치
          amount: c.subrogatedAmount || 0,
          priority: false,
        });
      }
    });

    // 2. 금액 있는 채권자만 필터링
    const allCreditors = expandedCreditors.filter(c => c.amount > 0);
    
    if (allCreditors.length > 0) {
      try {
        setIsLoading(true);
        setError(null);
        
        const res = await fetch('/api/create-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creditors: allCreditors.map(c => ({
              id: c.id,
              name: c.name,
              amount: c.amount,
              priority: c.priority,
            })),
            monthlyAvailable: template.monthlyAvailable,
            months: template.months,
          }),
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || '변제계획 생성 실패');
        }
        
        setResult(data);
      } catch (err: any) {
        setError(err.message || '변제계획 생성 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    if (confirm('정말 이 설정을 삭제하시겠습니까?')) {
      try {
        const res = await fetch(`/api/plan-templates/${id}`, {
          method: 'DELETE',
        });
        if (res.ok) {
          fetchTemplates(); // 목록 갱신
        } else {
          alert('삭제 실패');
        }
      } catch (err) {
        alert('오류 발생');
      }
    }
  };

  const handleReset = () => {
    if (confirm('모든 입력 내용을 초기화하시겠습니까?')) {
      setCreditors([
        { id: '1', name: 'A은행(우선)', amount: 5000000, priority: true, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
        { id: '2', name: 'B카드(일반)', amount: 10000000, priority: false, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
        { id: '3', name: 'C대부(일반)', amount: 15000000, priority: false, isSubrogated: false, subrogatedName: '', subrogatedAmount: 0 },
      ]);
      setMonthlyAvailable(2000000);
      setMonths(36);
      setResult(null);
      setError(null);
      setTemplateName('');
      setLoadedTemplateId(null);
    }
  };

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">변제계획 생성</h1>
            {loadedTemplateId && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-bold rounded-full border border-blue-200 shadow-sm animate-fade-in">
                {templateName}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0015.357-2m0 0H15" />
              </svg>
              초기화
            </button>
            <button
              onClick={() => {
                fetchTemplates();
                setShowLoadModal(true);
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              불러오기
            </button>
            <button
              onClick={() => {
                if (loadedTemplateId) {
                  handleSaveTemplate(false);
                } else {
                  setShowSaveModal(true);
                }
              }}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm font-medium flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              저장
            </button>
            {loadedTemplateId && (
              <button
                onClick={() => {
                  setTemplateName(''); // 새 이름 입력을 위해 비움
                  setShowSaveModal(true);
                }}
                className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                새로저장
              </button>
            )}
            <button
              onClick={handleCreatePlan}
              disabled={isLoading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              {isLoading ? '생성 중...' : '변제계획 생성'}
            </button>
          </div>
        </div>

        {/* 저장 모달 */}
        {showSaveModal && (
          <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-96 transform transition-all scale-100 border-2 border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">사건번호 저장</h3>
                <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">
                현재 입력된 정보를 사건번호로 저장하여 나중에 불러올 수 있습니다.
              </p>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="사건번호를 입력하세요 (25개회12345)"
                className="w-full border border-gray-300 px-4 py-2 rounded-lg mb-6 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium text-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSaveTemplate(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 불러오기 모달 */}
        {showLoadModal && (
          <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50 transition-opacity">
            <div className="bg-white rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col transform transition-all scale-100">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">설정 불러오기</h3>
                  <p className="text-sm text-gray-500 mt-1">저장된 변제계획 설정을 선택해주세요.</p>
                </div>
                <button onClick={() => setShowLoadModal(false)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {templates.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <p className="text-gray-500 font-medium">저장된 설정이 없습니다.</p>
                    <p className="text-sm text-gray-400 mt-1">새로운 계획을 생성하고 저장해보세요.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {templates.map((t) => (
                      <div key={t.id} className="group flex justify-between items-center p-4 border border-gray-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer" onClick={() => handleLoadTemplate(t)}>
                        <div>
                          <p className="font-bold text-gray-900 group-hover:text-blue-700">{t.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded group-hover:bg-white">{new Date(t.created_at).toLocaleDateString()}</span>
                            <span className="text-xs text-gray-500">· 채권자 {t.creditors.length}명</span>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLoadTemplate(t);
                            }}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 shadow-sm"
                          >
                            선택
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(t.id);
                            }}
                            className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                            title="삭제"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-end">
                <button
                  onClick={() => setShowLoadModal(false)}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 text-sm shadow-sm"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 저장 성공 팝업 */}
        {showSaveSuccessModal && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 transition-all">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-96 transform transition-all scale-100 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">저장되었습니다</h3>
              <p className="text-sm text-gray-500">변제계획 설정이 저장되었습니다.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 입력 영역 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 계획 설정 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">계획 설정</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    월별 가용액 (원)
                  </label>
                  <input
                    type="number"
                    value={monthlyAvailable}
                    onChange={(e) => setMonthlyAvailable(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(monthlyAvailable)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    계획 기간 (개월)
                  </label>
                  <input
                    type="number"
                    value={months}
                    onChange={(e) => setMonths(parseInt(e.target.value) || 1)}
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* 채권자 정보 */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">채권자 정보</h2>

              <div className="space-y-3 mb-4">
                {creditors.map((creditor, index) => (
                  <div key={creditor.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-gray-700">채권자 {index + 1}</span>
                      {creditors.length > 1 && (
                        <button
                          onClick={() => handleRemoveCreditor(creditor.id)}
                          className="text-xs px-2 py-1 bg-red-100 text-red-700 hover:bg-red-200 rounded"
                        >
                          삭제
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="채권자명"
                      value={creditor.name}
                      onChange={(e) => handleUpdateCreditor(creditor.id, 'name', e.target.value)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded mb-2"
                    />

                    <input
                      type="number"
                      placeholder="금액"
                      value={creditor.amount}
                      onChange={(e) => handleUpdateCreditor(creditor.id, 'amount', parseInt(e.target.value) || 0)}
                      className="w-full text-sm px-2 py-1 border border-gray-300 rounded mb-2"
                    />

                    <div className="flex flex-wrap gap-4 mt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditor.priority}
                          onChange={(e) => handleUpdateCreditor(creditor.id, 'priority', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">우선변제</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={creditor.isSubrogated}
                          onChange={(e) => handleUpdateCreditor(creditor.id, 'isSubrogated', e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">대위변제</span>
                      </label>
                    </div>

                    {creditor.isSubrogated && (
                      <div className="mt-3 pt-3 border-t border-blue-100 space-y-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-blue-600">채권자 {index + 1}-1 (대위변제자)</span>
                        </div>

                        <input
                          type="text"
                          placeholder="대위변제자명"
                          value={creditor.subrogatedName || ''}
                          onChange={(e) => handleUpdateCreditor(creditor.id, 'subrogatedName', e.target.value)}
                          className="w-full text-sm px-2 py-1 border border-blue-200 rounded bg-blue-50 focus:bg-white transition-colors"
                        />

                        <input
                          type="number"
                          placeholder="대위변제액"
                          value={creditor.subrogatedAmount || 0}
                          onChange={(e) => handleUpdateCreditor(creditor.id, 'subrogatedAmount', parseInt(e.target.value) || 0)}
                          className="w-full text-sm px-2 py-1 border border-blue-200 rounded bg-blue-50 focus:bg-white transition-colors"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddCreditor}
                className="w-full py-2 px-3 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg font-medium text-sm"
              >
                + 채권자 추가
              </button>
            </div>

            {/* 오류 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* 결과 영역 */}
          <div className="lg:col-span-2">
            {result ? (
              <div className="space-y-6">
                {/* 통계 */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">계획 통계</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">채권자 수</p>
                      <p className="text-xl font-bold text-blue-700">{result.statistics.totalCreditors}명</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">총 채무액</p>
                      <p className="text-xl font-bold text-blue-700">{formatCurrency(result.statistics.totalAmount)}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-gray-600">계획 기간</p>
                      <p className="text-xl font-bold text-blue-700">{result.statistics.planMonths}개월</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-xs text-gray-600">예상 상환액</p>
                      <p className="text-xl font-bold text-green-700">{formatCurrency(result.statistics.totalPayment)}</p>
                    </div>
                  </div>
                  {result.statistics.differenceAmount > 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <p className="text-xs text-gray-600">미상환액</p>
                      <p className="text-lg font-bold text-yellow-700">{formatCurrency(result.statistics.differenceAmount)}</p>
                    </div>
                  )}
                </div>

                {/* 변제계획 테이블 (회차별 그룹) */}
                {/* 변제계획 결과 컴포넌트 사용 */}
                <RepaymentPlanResults
                  plan={result.plan}
                  creditors={getAllPlanCreditors()} // Flattened list
                  monthlyAvailable={monthlyAvailable}
                  months={months}
                />

                {/* 전 회차 통합 변제계획표 (RepaymentPlanResults 컴포넌트 내부에 포함됨) */}

              </div>
            ) : (
              <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-8 text-center">
                <p className="text-gray-500">채권자 정보를 입력하고 변제계획을 생성해주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
