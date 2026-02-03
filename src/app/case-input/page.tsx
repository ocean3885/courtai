'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MainLayout } from '@/components/layout';
import { DebtorInfoForm } from './components/DebtorInfoForm';
import { CreditorInfoForm } from './components/CreditorInfoForm';
import { PlanInfoForm } from './components/PlanInfoForm';
import type {
    DebtorInfo,
    SubrogatedCreditor,
    SecuredCreditorData,
    Creditor,
    SavedList,
    RepaymentPlan
} from './types';

export default function CreditorListPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const caseId = searchParams.get('id');

    const [user, setUser] = useState<{ id: number; role: string } | null>(null);
    const [activeTab, setActiveTab] = useState<'debtor' | 'creditor' | 'plan'>('debtor');
    const [debtorInfo, setDebtorInfo] = useState<DebtorInfo>({
        name: '',
        birthDate: '',
        address: '',
        phone: '',
        court: '',
    });
    const [creditors, setCreditors] = useState<Creditor[]>([]);
    const [repaymentPlan, setRepaymentPlan] = useState<RepaymentPlan>({
        repaymentPeriod: {
            startDate: '',
            endDate: '',
            months: 36,
        },
        incomeType: 'wage',
        companyName: '',
        monthlyAverageIncome: 0,
        monthlyAverageLivingCost: 0,
        monthlyAverageAvailableIncome: 0,
        monthlyTrusteeFee: 0,
        otherEstateClaims: 0,
        monthlyActualAvailableIncome: 0,
        repaymentCount: 0,
        totalActualAvailableIncome: 0,
        liquidationValue: 0,
        seizedReservesStatus: 'no',
        seizedReservesAmount: 0,
        trusteeFee: {
            preConfirmation: 150000,
            postConfirmationRate: 1.0,
        },
        dependentsCount: 0,
        standardMedianIncome: 0,
        adjustedLivingCost: 0,
        createDate: new Date().toISOString().split('T')[0],
    });
    const [title, setTitle] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadedId, setLoadedId] = useState<string | null>(null);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [savedLists, setSavedLists] = useState<SavedList[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [saveMessage, setSaveMessage] = useState<string>('');

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => data && setUser(data.user));
    }, []);

    // URL 파라미터로 케이스 ID가 있으면 자동으로 로드
    useEffect(() => {
        if (caseId && !loadedId) {
            loadCaseData(caseId);
        }
    }, [caseId]);

    const loadCaseData = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/creditors/${id}`);
            if (res.ok) {
                const data = await res.json();
                handleLoad({
                    id: data.id.toString(),
                    title: data.title,
                    data: data.data,
                    updated_at: data.updated_at
                });
            } else {
                alert('사건 정보를 불러올 수 없습니다.');
                router.push('/case-list');
            }
        } catch (error) {
            console.error('Failed to load case:', error);
            alert('사건 로딩 중 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    };

    // 월평균가용소득 자동 계산
    useEffect(() => {
        const income = repaymentPlan.monthlyAverageIncome;
        const livingCost = repaymentPlan.monthlyAverageLivingCost;
        const available = Math.max(0, income - livingCost); // 음수 방지

        if (repaymentPlan.monthlyAverageAvailableIncome !== available) {
            setRepaymentPlan(prev => ({
                ...prev,
                monthlyAverageAvailableIncome: available
            }));
        }
    }, [repaymentPlan.monthlyAverageIncome, repaymentPlan.monthlyAverageLivingCost]);

    // 월회생위원보수 자동 계산
    useEffect(() => {
        const availableIncome = repaymentPlan.monthlyAverageAvailableIncome;
        const rate = repaymentPlan.trusteeFee.postConfirmationRate;
        const fee = Math.floor(availableIncome * (rate / 100));

        if (repaymentPlan.monthlyTrusteeFee !== fee) {
            setRepaymentPlan(prev => ({
                ...prev,
                monthlyTrusteeFee: fee
            }));
        }
    }, [repaymentPlan.monthlyAverageAvailableIncome, repaymentPlan.trusteeFee.postConfirmationRate]);

    // 월실제가용소득 자동 계산 (월평균가용소득 - 월회생위원보수 - 기타재단채권)
    useEffect(() => {
        const availableIncome = repaymentPlan.monthlyAverageAvailableIncome;
        const trusteeFee = repaymentPlan.monthlyTrusteeFee;
        const otherClaims = repaymentPlan.otherEstateClaims;
        const actualAvailable = Math.max(0, availableIncome - trusteeFee - otherClaims);

        if (repaymentPlan.monthlyActualAvailableIncome !== actualAvailable) {
            setRepaymentPlan(prev => ({
                ...prev,
                monthlyActualAvailableIncome: actualAvailable
            }));
        }
    }, [repaymentPlan.monthlyAverageAvailableIncome, repaymentPlan.monthlyTrusteeFee, repaymentPlan.otherEstateClaims]);

    // 총실제가용소득 자동 계산 (월실제가용소득 * 변제기간)
    useEffect(() => {
        const actualAvailable = repaymentPlan.monthlyActualAvailableIncome;
        const months = repaymentPlan.repaymentPeriod.months;
        const totalActual = actualAvailable * months;

        if (repaymentPlan.totalActualAvailableIncome !== totalActual) {
            setRepaymentPlan(prev => ({
                ...prev,
                totalActualAvailableIncome: totalActual
            }));
        }
    }, [repaymentPlan.monthlyActualAvailableIncome, repaymentPlan.repaymentPeriod.months]);

    const isLoggedIn = !!user;

    const handleAddCreditor = () => {
        const nextNumber = creditors.length > 0
            ? Math.max(...creditors.map(c => parseInt(c.number) || 0)) + 1
            : 1;

        setCreditors([
            ...creditors,
            {
                isSecured: false,
                id: Date.now().toString(),
                number: nextNumber.toString(),
                name: '',
                reason: '',
                address: '',
                phone: '',
                fax: '',
                principal: 0,
                interest: 0,
                interestStartDate: '',
                interestRate: '약정',
                baseDate: '',
                isSubrogated: false,
                isPreferential: false,
            }
        ]);
    };

    const handleRemoveCreditor = (id: string) => {
        setCreditors(creditors.filter(c => c.id !== id));
    };

    const updateCreditor = (id: string, field: keyof Creditor, value: string | number | boolean) => {
        setCreditors(creditors.map(c => {
            if (c.id === id) {
                if (field === 'isSubrogated' && value === true && !c.subrogationData) {
                    return {
                        ...c,
                        [field]: value,
                        subrogationData: {
                            id: Date.now().toString() + '-sub',
                            number: `${c.number}-1`,
                            name: '',
                            reason: '',
                            address: '',
                            phone: '',
                            fax: '',
                            principal: 0,
                            damages: 0,
                            interest: 0,
                            interestStartDate: '',
                            interestRate: '약정',
                            baseDate: c.baseDate,
                        }
                    };
                }
                if (field === 'isSecured' && value === true && !c.securedData) {
                    return {
                        ...c,
                        [field]: value,
                        securedData: {
                            currentAmount: 0,
                            expectedRepaymentAmount: 0,
                            unrepayableAmount: 0,
                            securedRehabilitationAmount: 0,
                            maxAmount: 0,
                            collateralObject: '',
                            securedRightDetails: '',
                            expectedLiquidationValue: '',
                        }
                    };
                }
                return { ...c, [field]: value };
            }
            return c;
        }));
    };

    const updateSubrogation = (id: string, field: keyof SubrogatedCreditor, value: string | number) => {
        setCreditors(creditors.map(c => {
            if (c.id === id && c.subrogationData) {
                return {
                    ...c,
                    subrogationData: { ...c.subrogationData, [field]: value }
                };
            }
            return c;
        }));
    };

    const updateSecuredData = (id: string, field: keyof SecuredCreditorData, value: string | number) => {
        setCreditors(creditors.map(c => {
            if (c.id === id && c.securedData) {
                const updatedSecuredData = { ...c.securedData, [field]: value };

                // 별제권행사 변제예상액이 변경되면 담보부회생채권액에 같은 값을 복사
                if (field === 'expectedRepaymentAmount') {
                    updatedSecuredData.securedRehabilitationAmount = typeof value === 'number' ? value : 0;
                }

                // 별제권행사 변제불능액 자동 계산 (별제권행사 변제예상액, 채권최고액, 채권현재액 변경 시)
                if (field === 'expectedRepaymentAmount' || field === 'maxAmount' || field === 'currentAmount') {
                    const expectedRepayment = field === 'expectedRepaymentAmount'
                        ? (typeof value === 'number' ? value : 0)
                        : (updatedSecuredData.expectedRepaymentAmount || 0);
                    const maxAmount = field === 'maxAmount'
                        ? (typeof value === 'number' ? value : 0)
                        : (updatedSecuredData.maxAmount || 0);
                    const currentAmount = field === 'currentAmount'
                        ? (typeof value === 'number' ? value : 0)
                        : (updatedSecuredData.currentAmount || 0);

                    // 채권최고액이 있으면 채권최고액 - 별제권행사변제예상액, 없으면 채권현재액 - 별제권행사변제예상액
                    const baseAmount = maxAmount > 0 ? maxAmount : currentAmount;
                    updatedSecuredData.unrepayableAmount = Math.max(0, baseAmount - expectedRepayment);
                }

                return {
                    ...c,
                    securedData: updatedSecuredData
                };
            }
            return c;
        }));
    };

    const handleSave = async () => {
        if (activeTab === 'debtor') {
            if (!debtorInfo.name.trim() || !debtorInfo.birthDate.trim()) {
                alert('채무자 이름과 생년월일을 입력해주세요.');
                return;
            }
            const autoTitle = `${debtorInfo.court} ${debtorInfo.name} ${debtorInfo.birthDate}`;
            setTitle(autoTitle);
            setIsSaving(true);
            try {
                const res = await fetch(loadedId ? `/api/creditors/${loadedId}` : '/api/creditors', {
                    method: loadedId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: autoTitle,
                        data: { debtorInfo, creditors, repaymentPlan }
                    }),
                });
                if (res.ok) {
                    const json = await res.json();
                    if (!loadedId) setLoadedId(json.id);
                    setSaveMessage('저장되었습니다.');
                    setTimeout(() => setSaveMessage(''), 3000);
                }
            } catch {
                setSaveMessage('저장 중 오류가 발생했습니다.');
                setTimeout(() => setSaveMessage(''), 3000);
            } finally {
                setIsSaving(false);
            }
        } else if (activeTab === 'creditor' || activeTab === 'plan') {
            if (!title.trim()) {
                alert('채무자 정보를 먼저 저장해주세요.');
                return;
            }
            setIsSaving(true);
            try {
                const res = await fetch(loadedId ? `/api/creditors/${loadedId}` : '/api/creditors', {
                    method: loadedId ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, data: { debtorInfo, creditors, repaymentPlan } }),
                });
                if (res.ok) {
                    const json = await res.json();
                    if (!loadedId) setLoadedId(json.id);
                    setSaveMessage('저장되었습니다.');
                    setTimeout(() => setSaveMessage(''), 3000);
                }
            } catch {
                setSaveMessage('저장 중 오류가 발생했습니다.');
                setTimeout(() => setSaveMessage(''), 3000);
            } finally {
                setIsSaving(false);
            }
        }
    };

    const fetchSavedLists = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/creditors');
            const data = await res.json();
            setSavedLists(Array.isArray(data) ? data : []);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoad = (list: SavedList) => {
        setTitle(list.title);
        if (!Array.isArray(list.data)) {
            if (list.data.debtorInfo) {
                setDebtorInfo(list.data.debtorInfo);
            }
            if (list.data.creditors) {
                setCreditors(list.data.creditors);
            }
            if (list.data.repaymentPlan) {
                setRepaymentPlan(list.data.repaymentPlan);
            }
        } else {
            // 이전 버전 호환성
            setCreditors(list.data);
        }
        setLoadedId(list.id);
        setShowLoadModal(false);
    };

    const handleDeleteList = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const res = await fetch(`/api/creditors/${id}`, { method: 'DELETE' });
        if (res.ok) fetchSavedLists();
    };

    const handleGenerate = async () => {
        if (!loadedId) {
            alert('먼저 데이터를 저장해주세요.');
            return;
        }

        setIsGenerating(true);
        try {
            const res = await fetch(`/api/creditors/${loadedId}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    data: { debtorInfo, creditors, repaymentPlan }
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setSaveMessage('채권자목록 및 변제계획안이 생성되었습니다.');
                setTimeout(() => setSaveMessage(''), 2000);

                // 생성된 문서 상세보기 페이지로 이동
                router.push(`/documents/${data.documentId}`);
            } else {
                const error = await res.json();
                alert(`생성 실패: ${error.error}`);
            }
        } catch (error) {
            console.error('Generation error:', error);
            alert('생성 중 오류가 발생했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };


    const filteredLists = savedLists.filter(list => list.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const itemsPerPage = 5;
    const totalPages = Math.ceil(filteredLists.length / itemsPerPage);
    const paginatedLists = filteredLists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
        <MainLayout>
            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* 탭 메뉴 */}
                <div className="flex gap-2 mb-4 border-b-2 border-gray-300">
                    <button
                        onClick={() => setActiveTab('debtor')}
                        className={`px-4 py-2 font-medium text-base ${activeTab === 'debtor'
                            ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        1. 채무자정보
                    </button>
                    <button
                        onClick={() => setActiveTab('creditor')}
                        disabled={!debtorInfo.name || !debtorInfo.birthDate}
                        className={`px-4 py-2 font-medium text-base ${activeTab === 'creditor'
                            ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                            : debtorInfo.name && debtorInfo.birthDate
                                ? 'text-gray-600 hover:text-gray-900'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        2. 채권자정보
                    </button>
                    <button
                        onClick={() => setActiveTab('plan')}
                        disabled={!loadedId}
                        className={`px-4 py-2 font-medium text-base ${activeTab === 'plan'
                            ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                            : loadedId
                                ? 'text-gray-600 hover:text-gray-900'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        3. 변제계획
                    </button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 pb-3 border-b-2 border-gray-300">
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-gray-900">
                            {title || '사건정보입력'}
                        </h1>
                    </div>
                    {isLoggedIn && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { fetchSavedLists(); setSearchTerm(''); setCurrentPage(1); setShowLoadModal(true); }}
                                className="px-3 py-1 bg-white text-gray-700 border border-gray-400 hover:bg-gray-100 text-base"
                            >
                                불러오기
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-3 py-1 bg-blue-700 text-white border border-blue-800 hover:bg-blue-800 text-base"
                            >
                                {isSaving ? '저장 중...' : '저장'}
                            </button>
                            {loadedId && (
                                <button
                                    onClick={() => {
                                        setLoadedId(null);
                                        setTitle('');
                                        setCreditors([]);
                                        setDebtorInfo({
                                            name: '',
                                            birthDate: '',
                                            address: '',
                                            phone: '',
                                            court: '',
                                        });
                                        setActiveTab('debtor');
                                    }}
                                    className="px-3 py-1 bg-white text-gray-700 border border-gray-400 hover:bg-gray-100 text-base"
                                >
                                    새로작성
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* 저장 성공 메시지 */}
                {saveMessage && (
                    <div className="mt-3 p-3 bg-green-100 border border-green-400 text-green-800 text-base">
                        {saveMessage}
                    </div>
                )}

                {/* 채무자정보 탭 */}
                {activeTab === 'debtor' && (
                    <DebtorInfoForm
                        debtorInfo={debtorInfo}
                        onChange={setDebtorInfo}
                    />
                )}

                {/* 채권자정보 탭 */}
                {activeTab === 'creditor' && (
                    <CreditorInfoForm
                        creditors={creditors}
                        onAdd={handleAddCreditor}
                        onRemove={handleRemoveCreditor}
                        onUpdate={updateCreditor}
                        onUpdateSubrogation={updateSubrogation}
                        onUpdateSecured={updateSecuredData}
                    />
                )}

                {/* 변제계획 탭 */}
                {
                    activeTab === 'plan' && (
                        <PlanInfoForm
                            repaymentPlan={repaymentPlan}
                            onChange={setRepaymentPlan}
                            onGenerate={handleGenerate}
                            isGenerating={isGenerating}
                            isLoaded={!!loadedId}
                        />
                    )
                }
            </div >

            {/* 불러오기 모달 */}
            {
                showLoadModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-xl font-bold text-gray-900">저장된 목록 불러오기</h3>
                                    <button onClick={() => setShowLoadModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="검색어 입력 (사건명, 날짜 등)"
                                        value={searchTerm}
                                        onChange={(e) => {
                                            setSearchTerm(e.target.value);
                                            setCurrentPage(1);
                                        }}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-base"
                                    />
                                    <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 space-y-3">
                                {isLoading ? (
                                    <div className="text-center py-10 text-gray-500">로딩 중...</div>
                                ) : savedLists.length === 0 ? (
                                    <div className="text-center py-10 text-gray-500">저장된 목록이 없습니다.</div>
                                ) : paginatedLists.length > 0 ? (
                                    paginatedLists.map(list => (
                                        <div
                                            key={list.id}
                                            onClick={() => handleLoad(list)}
                                            className="group p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer flex justify-between items-center"
                                        >
                                            <div>
                                                <p className="font-bold text-gray-900 group-hover:text-blue-700">
                                                    {list.title.split(new RegExp(`(${searchTerm})`, 'gi')).map((part, i) =>
                                                        part.toLowerCase() === searchTerm.toLowerCase() && searchTerm
                                                            ? <span key={i} className="bg-yellow-200 text-black px-1 rounded">{part}</span>
                                                            : part
                                                    )}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    작성일: {new Date(list.updated_at).toLocaleDateString()} · 채권자 {Array.isArray(list.data) ? list.data.length : (list.data.creditors?.length || 0)}명
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDeleteList(list.id, e)}
                                                className="p-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all"
                                            >
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-gray-500">검색 결과가 없습니다.</div>
                                )}
                            </div>
                            {/* 페이지네이션 */}
                            {totalPages > 1 && (
                                <div className="p-4 border-t border-gray-100 flex justify-center items-center gap-4 bg-gray-50/50">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                    <span className="text-sm font-medium text-gray-600">
                                        {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                    >
                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </MainLayout >
    );
}
