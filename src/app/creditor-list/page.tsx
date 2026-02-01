'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';

interface DebtorInfo {
    name: string;
    birthDate: string; // YYYYMMDD 형식
    address: string;
    phone: string;
    court: string; // 관할법원
}

interface SubrogatedCreditor {
    id: string;
    number: string; // 예: 14-1
    name: string;
    reason: string;
    address: string;
    phone: string;
    fax: string;
    principal: number; // 구상원금
    damages: number; // 손해금(기타)
    interest: number;
    interestStartDate: string;
    interestRate: string;
    baseDate: string;
}

interface SecuredCreditorData {
    currentAmount: number; // 채권현재액
    expectedRepaymentAmount: number; // 별제권행사등으로 변제가 예상되는 채권액
    unrepayableAmount: number; // 별제권행사등으로도 변제받을 수 없을 채권액
    securedRehabilitationAmount: number; // 담보부회생채권액
    maxAmount: number; // 채권최고액
    collateralObject: string; // 목적물
    securedRightDetails: string; // 별제권내용
    expectedLiquidationValue: string; // 환가예상액 (계산식)
}

interface Creditor {
    id: string;
    number: string; // 예: 14
    name: string;
    reason: string;
    address: string;
    phone: string;
    fax: string;
    principal: number;
    interest: number;
    interestStartDate: string;
    interestRate: string;
    baseDate: string;
    isSubrogated: boolean;
    subrogationData?: SubrogatedCreditor;
    isSecured: boolean; // 별제권부채권 여부
    securedData?: SecuredCreditorData; // 별제권부채권 정보
    isPreferential: boolean; // 우선변제 여부
}

interface SavedList {
    id: string;
    title: string;
    data: { debtorInfo?: DebtorInfo; creditors?: Creditor[]; repaymentPlan?: RepaymentPlan } | Creditor[];
    updated_at: string;
}

interface RepaymentPlan {
    repaymentPeriod: {
        startDate: string;
        endDate: string;
        months: number;
    };
    incomeType: 'wage' | 'business';
    monthlyAverageIncome: number;
    monthlyAverageLivingCost: number;
    monthlyAverageAvailableIncome: number;
    monthlyTrusteeFee: number;
    otherEstateClaims: number;
    monthlyActualAvailableIncome: number;
    repaymentCount: number;
    totalActualAvailableIncome: number;
    trusteeFee: {
        preConfirmation: number;
        postConfirmationRate: number;
    };
    dependentsCount: number;
    standardMedianIncome: number;
    adjustedLivingCost: number;
    createDate: string;
}

export default function CreditorListPage() {
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
        monthlyAverageIncome: 0,
        monthlyAverageLivingCost: 0,
        monthlyAverageAvailableIncome: 0,
        monthlyTrusteeFee: 0,
        otherEstateClaims: 0,
        monthlyActualAvailableIncome: 0,
        repaymentCount: 0,
        totalActualAvailableIncome: 0,
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

    const formatCurrency = (value: number): string => {
        if (!value && value !== 0) return '';
        return value.toLocaleString('ko-KR') + '원';
    };

    const parseCurrency = (value: string): number => {
        const numbers = value.replace(/[^0-9]/g, '');
        return numbers ? parseInt(numbers) : 0;
    };

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
            setSavedLists(data.lists || []);
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

    const filteredLists = savedLists.filter(list => list.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const itemsPerPage = 5;
    const totalPages = Math.ceil(filteredLists.length / itemsPerPage);
    const paginatedLists = filteredLists.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return (
        <MainLayout>
            <div className="max-w-7xl mx-auto px-4 py-4">
                {/* 탭 메뉴 */}
                <div className="flex gap-2 mb-4 border-b-2 border-gray-300">
                    <button
                        onClick={() => setActiveTab('debtor')}
                        className={`px-4 py-2 font-medium text-base ${
                            activeTab === 'debtor'
                                ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        1. 채무자정보
                    </button>
                    <button
                        onClick={() => setActiveTab('creditor')}
                        disabled={!debtorInfo.name || !debtorInfo.birthDate}
                        className={`px-4 py-2 font-medium text-base ${
                            activeTab === 'creditor'
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
                        className={`px-4 py-2 font-medium text-base ${
                            activeTab === 'plan'
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
                    <div className="bg-white border-2 border-gray-400 p-4">
                        <h2 className="text-lg font-bold mb-2 text-gray-900">채무자 기본정보</h2>
                        <p className="text-base text-blue-600 mb-4 bg-blue-50 p-2 border-l-4 border-blue-600">
                            ℹ️ 채무자 정보를 입력하고 저장하면 채권자정보를 입력할 수 있습니다.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">성명 *</label>
                                <input
                                    type="text"
                                    value={debtorInfo.name}
                                    onChange={(e) => setDebtorInfo({ ...debtorInfo, name: e.target.value })}
                                    placeholder="홍길동"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">생년월일 *</label>
                                <input
                                    type="text"
                                    value={debtorInfo.birthDate}
                                    onChange={(e) => {
                                        const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                        setDebtorInfo({ ...debtorInfo, birthDate: value });
                                    }}
                                    placeholder="19820105"
                                    maxLength={8}
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                                <input
                                    type="text"
                                    value={debtorInfo.phone}
                                    onChange={(e) => setDebtorInfo({ ...debtorInfo, phone: e.target.value })}
                                    placeholder="010-1234-5678"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                                <input
                                    type="text"
                                    value={debtorInfo.address}
                                    onChange={(e) => setDebtorInfo({ ...debtorInfo, address: e.target.value })}
                                    placeholder="서울시 강남구 테헤란로 123"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">관할법원</label>
                                <input
                                    type="text"
                                    value={debtorInfo.court}
                                    onChange={(e) => setDebtorInfo({ ...debtorInfo, court: e.target.value })}
                                    placeholder="서울회생법원"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* 채권자정보 탭 */}
                {activeTab === 'creditor' && (
                <div className="space-y-3">
                    {creditors.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 border border-gray-300">
                            <p className="text-gray-600 mb-3">입력된 채권자가 없습니다.</p>
                            <button
                                onClick={handleAddCreditor}
                                className="px-4 py-2 bg-white text-gray-700 border border-gray-400 hover:bg-gray-100"
                            >
                                + 첫 번째 채권자 추가
                            </button>
                        </div>
                    ) : (
                        creditors.map((c) => (
                            <div key={c.id} className="bg-white border-2 border-gray-400">
                                <div className="bg-gray-100 px-3 py-2 flex justify-between items-center border-b-2 border-gray-400">
                                    <div className="flex items-center gap-2">
                                        <span className="bg-gray-700 text-white px-2 py-1 text-sm font-bold">
                                            {c.number}
                                        </span>
                                        <h3 className="font-bold text-base text-gray-900">{c.name || '새 채권자'}</h3>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCreditor(c.id)}
                                        className="text-gray-500 hover:text-red-600 text-sm px-2 py-1 border border-gray-400 bg-white hover:bg-red-50"
                                    >
                                        삭제
                                    </button>
                                </div>

                                <div className="p-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">채권번호</label>
                                        <input
                                            type="text"
                                            value={c.number}
                                            onChange={(e) => updateCreditor(c.id, 'number', e.target.value)}
                                            className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">채권자명</label>
                                        <input
                                            type="text"
                                            value={c.name}
                                            onChange={(e) => updateCreditor(c.id, 'name', e.target.value)}
                                            placeholder="(주)엔씨자산관리대부"
                                            className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                                        <input
                                            type="text"
                                            value={c.address}
                                            onChange={(e) => updateCreditor(c.id, 'address', e.target.value)}
                                            placeholder="서울시 구로구 디지털로30길 28, 209호"
                                            className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">원인</label>
                                        <textarea
                                            value={c.reason}
                                            onChange={(e) => updateCreditor(c.id, 'reason', e.target.value)}
                                            placeholder="2002.12.20.자 (주)나이스대부 대출금 양수채권"
                                            rows={2}
                                            className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">전화</label>
                                        <input type="text" value={c.phone} onChange={(e) => updateCreditor(c.id, 'phone', e.target.value)} placeholder="02-2135-7339" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">팩스</label>
                                        <input type="text" value={c.fax} onChange={(e) => updateCreditor(c.id, 'fax', e.target.value)} placeholder="0504-847-9030" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">원금</label>
                                        <input type="text" value={formatCurrency(c.principal)} onChange={(e) => updateCreditor(c.id, 'principal', parseCurrency(e.target.value))} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">이자</label>
                                        <input type="text" value={formatCurrency(c.interest)} onChange={(e) => updateCreditor(c.id, 'interest', parseCurrency(e.target.value))} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">이자기산일</label>
                                        <input type="date" max="9999-12-31" value={c.interestStartDate} onChange={(e) => updateCreditor(c.id, 'interestStartDate', e.target.value)} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">이자이율</label>
                                        <input type="text" value={c.interestRate} onChange={(e) => updateCreditor(c.id, 'interestRate', e.target.value)} placeholder="약정 또는 0.2%" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">산정기준일</label>
                                        <input type="date" max="9999-12-31" value={c.baseDate} onChange={(e) => updateCreditor(c.id, 'baseDate', e.target.value)} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id={`sub-${c.id}`}
                                                checked={c.isSubrogated}
                                                onChange={(e) => updateCreditor(c.id, 'isSubrogated', e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700">대위변제자</span>
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id={`secured-${c.id}`}
                                                checked={c.isSecured || false}
                                                onChange={(e) => updateCreditor(c.id, 'isSecured', e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700">별제권부채권</span>
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id={`preferential-${c.id}`}
                                                checked={c.isPreferential || false}
                                                onChange={(e) => updateCreditor(c.id, 'isPreferential', e.target.checked)}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700">우선변제</span>
                                        </label>
                                    </div>
                                </div>

                                {c.isSubrogated && c.subrogationData && (
                                    <div className="bg-blue-50 p-3 border-t-2 border-blue-400">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-blue-700 text-white px-2 py-1 text-sm font-bold">
                                                {c.subrogationData.number}
                                            </span>
                                            <h4 className="font-bold text-base text-blue-900">대위변제자 정보</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">채권번호</label>
                                                <input readOnly value={c.subrogationData.number} className="w-full px-2 py-1 bg-gray-100 border border-gray-400 text-base cursor-default outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">대위변제자명</label>
                                                <input type="text" value={c.subrogationData.name} onChange={(e) => updateSubrogation(c.id, 'name', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-blue-900 mb-1">주소</label>
                                                <input type="text" value={c.subrogationData.address} onChange={(e) => updateSubrogation(c.id, 'address', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div className="lg:col-span-4">
                                                <label className="block text-sm font-medium text-blue-900 mb-1">원인 (대위변제)</label>
                                                <textarea value={c.subrogationData.reason} onChange={(e) => updateSubrogation(c.id, 'reason', e.target.value)} rows={2} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">전화</label>
                                                <input type="text" value={c.subrogationData.phone} onChange={(e) => updateSubrogation(c.id, 'phone', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">구상원금</label>
                                                <input type="text" value={formatCurrency(c.subrogationData.principal)} onChange={(e) => updateSubrogation(c.id, 'principal', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">손해금(기타)</label>
                                                <input type="text" value={formatCurrency(c.subrogationData.damages || 0)} onChange={(e) => updateSubrogation(c.id, 'damages', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">산정기준일</label>
                                                <input type="date" max="9999-12-31" value={c.subrogationData.baseDate} onChange={(e) => updateSubrogation(c.id, 'baseDate', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {c.isSecured && c.securedData && (
                                    <div className="bg-purple-50 p-3 border-t-2 border-purple-400">
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-purple-700 text-white px-2 py-1 text-sm font-bold">
                                                별제권
                                            </span>
                                            <h4 className="font-bold text-base text-purple-900">별제권부채권 정보</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-purple-900 mb-1">채권현재액</label>
                                                <input 
                                                    type="text" 
                                                    value={formatCurrency(c.securedData.currentAmount)} 
                                                    onChange={(e) => updateSecuredData(c.id, 'currentAmount', parseCurrency(e.target.value))} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-purple-900 mb-1">채권최고액</label>
                                                <input 
                                                    type="text" 
                                                    value={formatCurrency(c.securedData.maxAmount)} 
                                                    onChange={(e) => updateSecuredData(c.id, 'maxAmount', parseCurrency(e.target.value))} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-purple-900 mb-1">별제권행사 변제예상액</label>
                                                <input 
                                                    type="text" 
                                                    value={formatCurrency(c.securedData.expectedRepaymentAmount)} 
                                                    onChange={(e) => updateSecuredData(c.id, 'expectedRepaymentAmount', parseCurrency(e.target.value))} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-purple-900 mb-1">담보부회생채권액</label>
                                                <input 
                                                    type="text" 
                                                    value={formatCurrency(c.securedData.securedRehabilitationAmount)} 
                                                    onChange={(e) => updateSecuredData(c.id, 'securedRehabilitationAmount', parseCurrency(e.target.value))} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-purple-900 mb-1">별제권행사 변제불능액</label>
                                                <input 
                                                    type="text" 
                                                    value={formatCurrency(c.securedData.unrepayableAmount)} 
                                                    onChange={(e) => updateSecuredData(c.id, 'unrepayableAmount', parseCurrency(e.target.value))} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 lg:col-span-3">
                                                <label className="block text-sm font-medium text-purple-900 mb-1">환가예상액 (계산식)</label>
                                                <input 
                                                    type="text" 
                                                    value={c.securedData.expectedLiquidationValue} 
                                                    onChange={(e) => updateSecuredData(c.id, 'expectedLiquidationValue', e.target.value)} 
                                                    placeholder="예: 12,950,000 X 0.7 = 9,065,000"
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 lg:col-span-4">
                                                <label className="block text-sm font-medium text-purple-900 mb-1">목적물</label>
                                                <textarea 
                                                    value={c.securedData.collateralObject} 
                                                    onChange={(e) => updateSecuredData(c.id, 'collateralObject', e.target.value)} 
                                                    placeholder="예: 서울시 강남구 테헤란로 123 아파트 101호"
                                                    rows={2} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none" 
                                                />
                                            </div>
                                            <div className="md:col-span-2 lg:col-span-4">
                                                <label className="block text-sm font-medium text-purple-900 mb-1">별제권내용</label>
                                                <textarea 
                                                    value={c.securedData.securedRightDetails} 
                                                    onChange={(e) => updateSecuredData(c.id, 'securedRightDetails', e.target.value)} 
                                                    placeholder="예: 근저당권, 전세권 등"
                                                    rows={2} 
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {creditors.length > 0 && (
                        <div className="pt-2">
                            <button
                                onClick={handleAddCreditor}
                                className="w-full py-2 bg-white text-gray-700 border-2 border-dashed border-gray-400 hover:bg-gray-50 hover:border-gray-600 text-base font-medium"
                            >
                                + 다음 채권자 추가
                            </button>
                        </div>
                    )}
                </div>
                )}

                {/* 변제계획 탭 */}
                {activeTab === 'plan' && (
                    <div className="bg-white border-2 border-gray-400 p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-gray-900">변제계획</h2>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-4">
                            {/* Row 1 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">변제시작일</label>
                                <input type="date" max="9999-12-31" value={repaymentPlan.repaymentPeriod.startDate} onChange={(e) => setRepaymentPlan({...repaymentPlan, repaymentPeriod: {...repaymentPlan.repaymentPeriod, startDate: e.target.value}})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">변제종료일</label>
                                <input type="date" max="9999-12-31" value={repaymentPlan.repaymentPeriod.endDate} onChange={(e) => setRepaymentPlan({...repaymentPlan, repaymentPeriod: {...repaymentPlan.repaymentPeriod, endDate: e.target.value}})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">변제기간(개월) ⑧</label>
                                <input type="number" value={repaymentPlan.repaymentPeriod.months} onChange={(e) => setRepaymentPlan({...repaymentPlan, repaymentPeriod: {...repaymentPlan.repaymentPeriod, months: parseInt(e.target.value) || 0}})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">수입형태</label>
                                <select value={repaymentPlan.incomeType} onChange={(e) => setRepaymentPlan({...repaymentPlan, incomeType: e.target.value as 'wage' | 'business'})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none">
                                    <option value="wage">급여소득자</option>
                                    <option value="business">영업소득자</option>
                                </select>
                            </div>

                            {/* Row 2 - 4 items */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">피부양자수</label>
                                <input type="number" value={repaymentPlan.dependentsCount} onChange={(e) => setRepaymentPlan({...repaymentPlan, dependentsCount: parseInt(e.target.value) || 0})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">기준중위소득</label>
                                <input type="text" value={formatCurrency(repaymentPlan.standardMedianIncome)} onChange={(e) => setRepaymentPlan({...repaymentPlan, standardMedianIncome: parseCurrency(e.target.value)})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">회생위원보수(인가전)</label>
                                <input type="text" value={formatCurrency(repaymentPlan.trusteeFee.preConfirmation)} onChange={(e) => setRepaymentPlan({...repaymentPlan, trusteeFee: {...repaymentPlan.trusteeFee, preConfirmation: parseCurrency(e.target.value)}})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">회생위원보수(인가후) ④</label>
                                <div className="relative">
                                    <input type="number" step="0.1" value={repaymentPlan.trusteeFee.postConfirmationRate} onChange={(e) => setRepaymentPlan({...repaymentPlan, trusteeFee: {...repaymentPlan.trusteeFee, postConfirmationRate: parseFloat(e.target.value)}})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none pr-6" />
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-base text-gray-500">%</span>
                                </div>
                            </div>

                            {/* Row 3 - 4 items */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">월평균수입 ①</label>
                                <input type="text" value={formatCurrency(repaymentPlan.monthlyAverageIncome)} onChange={(e) => setRepaymentPlan({...repaymentPlan, monthlyAverageIncome: parseCurrency(e.target.value)})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">월평균생계비 ②</label>
                                <input type="text" value={formatCurrency(repaymentPlan.monthlyAverageLivingCost)} onChange={(e) => setRepaymentPlan({...repaymentPlan, monthlyAverageLivingCost: parseCurrency(e.target.value)})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">월평균가용소득 ③ (①-②)</label>
                                <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyAverageAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">월회생위원보수 ⑤ (③×④)</label>
                                <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyTrusteeFee)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                            </div>

                            {/* Row 4 - 4 items */}
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">기타재단채권 ⑥</label>
                                <input type="text" value={formatCurrency(repaymentPlan.otherEstateClaims)} onChange={(e) => setRepaymentPlan({...repaymentPlan, otherEstateClaims: parseCurrency(e.target.value)})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">월실제가용소득 ⑦ (③-⑤-⑥)</label>
                                <input type="text" readOnly value={formatCurrency(repaymentPlan.monthlyActualAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">총실제가용소득 ⑨ (⑦×⑧)</label>
                                <input type="text" readOnly value={formatCurrency(repaymentPlan.totalActualAvailableIncome)} className="w-full px-2 py-1 border border-gray-400 text-base bg-gray-100 cursor-default focus:outline-none" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">작성일</label>
                                <input type="date" value={repaymentPlan.createDate} onChange={(e) => setRepaymentPlan({...repaymentPlan, createDate: e.target.value})} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 불러오기 모달 */}
            {showLoadModal && (
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
            )}
        </MainLayout>
    );
}
