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
} from './types'; import {
    SAMPLE_DEBTOR_INFO,
    SAMPLE_CREDITORS,
    SAMPLE_REPAYMENT_PLAN
} from './sample-data';
function CreditorListContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const caseId = searchParams.get('id');
    const loadTemp = searchParams.get('load_temp');

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
            preConfirmation: 0,
            postConfirmationRate: 0,
        },
        dependentsCount: 1,
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

        // 임시 저장 데이터 로드 (비로그인 수정)
        if (loadTemp === 'true' && !caseId) {
            const raw = localStorage.getItem('temp_case_data');
            if (raw) {
                try {
                    const parsed = JSON.parse(raw);
                    setTitle(parsed.title || '');
                    if (parsed.data) {
                        if (parsed.data.debtorInfo) setDebtorInfo(parsed.data.debtorInfo);
                        if (parsed.data.creditors) setCreditors(parsed.data.creditors);
                        if (parsed.data.repaymentPlan) setRepaymentPlan(parsed.data.repaymentPlan);
                    }
                } catch (e) {
                    console.error('Failed to load temp data', e);
                }
            }
        }
    }, [caseId, loadTemp]);

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

    const updateCreditor = (id: string, field: keyof Creditor, value: string | number | boolean | string[]) => {
        setCreditors(creditors.map(c => {
            if (c.id === id) {
                // 대위변제자 체크 시 초기 데이터 생성
                if (field === 'isSubrogated') {
                    if (value === true) {
                        // 이미 데이터가 있다면 유지, 없다면 초기화
                        const hasData = (c.subrogatedList && c.subrogatedList.length > 0) || c.subrogationData;
                        if (!hasData) {
                            return {
                                ...c,
                                [field]: value,
                                subrogatedList: [{
                                    id: Date.now().toString() + '-sub-1',
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
                                }]
                            };
                        }
                    } else {
                        // 체크 해제 시 데이터 초기화 (삭제)
                        return {
                            ...c,
                            [field]: value,
                            subrogatedList: [],
                            subrogationData: undefined
                        };
                    }
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

    const handleAddSubrogation = (creditorId: string) => {
        setCreditors(creditors.map(c => {
            if (c.id === creditorId) {
                const currentList = c.subrogatedList || [];
                // 기존 subrogationData가 있다면 마이그레이션해서 리스트에 포함
                if (currentList.length === 0 && c.subrogationData) {
                    currentList.push(c.subrogationData);
                }

                const nextSubNumber = currentList.length + 1;
                const newSub: SubrogatedCreditor = {
                    id: Date.now().toString() + `-sub-${nextSubNumber}`,
                    number: `${c.number}-${nextSubNumber}`,
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
                };

                return {
                    ...c,
                    subrogatedList: [...currentList, newSub]
                };
            }
            return c;
        }));
    };

    const handleRemoveSubrogation = (creditorId: string, subId: string) => {
        setCreditors(creditors.map(c => {
            if (c.id === creditorId && c.subrogatedList) {
                const updatedList = c.subrogatedList.filter(s => s.id !== subId);
                // 번호 재정렬 (예: 2-1, 2-3 -> 2-1, 2-2)
                const reindexedList = updatedList.map((s, index) => ({
                    ...s,
                    number: `${c.number}-${index + 1}`
                }));
                return { ...c, subrogatedList: reindexedList };
            }
            return c;
        }));
    };

    const updateSubrogation = (creditorId: string, subId: string, field: keyof SubrogatedCreditor, value: string | number) => {
        setCreditors(creditors.map(c => {
            if (c.id === creditorId) {
                // subrogatedList 업데이트
                if (c.subrogatedList) {
                    return {
                        ...c,
                        subrogatedList: c.subrogatedList.map(s =>
                            s.id === subId ? { ...s, [field]: value } : s
                        )
                    };
                }
                // 하위 호환성 (subrogationData만 있는 경우)
                else if (c.subrogationData && c.subrogationData.id === subId) {
                    return {
                        ...c,
                        subrogationData: { ...c.subrogationData, [field]: value }
                    };
                }
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

    const handleLoadSampleData = () => {
        // if (!confirm('현재 입력된 내용이 있다면 지워집니다. 샘플 데이터를 불러오시겠습니까?')) return;

        setDebtorInfo(SAMPLE_DEBTOR_INFO);
        setCreditors(SAMPLE_CREDITORS);
        setRepaymentPlan({
            ...SAMPLE_REPAYMENT_PLAN,
            createDate: new Date().toISOString().split('T')[0], // 생성일만 오늘 날짜로 갱신
        });

        setTitle('샘플(체험) 사건');
        // alert('샘플 데이터가 입력되었습니다. 각 탭을 확인해보시고 변제계획 탭에서 생성버튼을 눌러보세요.');
    };

    const handleSave = async () => {
        // 채무자 탭일 경우 기본 유효성 검사 유지 (최소한의 입력 확인)
        if (activeTab === 'debtor') {
            if (!debtorInfo.name.trim() || !debtorInfo.birthDate.trim()) {
                alert('채무자 이름과 생년월일을 입력해주세요.');
                return;
            }
        }


        // 제목 생성 로직: 사용자가 입력한 제목이 있으면 그것을 우선 사용
        // 제목이 공란이면 채무자 정보를 기반으로 자동 생성
        let saveTitle = title.trim();

        if (!saveTitle) {
            const autoTitle = `${debtorInfo.court || ''} ${debtorInfo.name || ''} ${debtorInfo.birthDate || ''}`.trim();
            if (autoTitle) {
                saveTitle = autoTitle;
            } else {
                // 채무자 정보도 없고 제목도 없으면 임시 제목 생성
                saveTitle = `임시저장 ${new Date().toLocaleDateString()}`;
            }
        }

        // 상태 업데이트
        setTitle(saveTitle);
        setIsSaving(true);
        setSaveMessage('');

        try {
            const res = await fetch(loadedId ? `/api/creditors/${loadedId}` : '/api/creditors', {
                method: loadedId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: saveTitle,
                    data: { debtorInfo, creditors, repaymentPlan }
                }),
            });

            if (res.ok) {
                const json = await res.json();
                if (!loadedId) setLoadedId(json.id);
                setSaveMessage('저장되었습니다.');
                setTimeout(() => setSaveMessage(''), 3000);
            } else {
                setSaveMessage('저장 실패.');
                setTimeout(() => setSaveMessage(''), 3000);
            }
        } catch (e) {
            console.error(e);
            setSaveMessage('저장 중 오류가 발생했습니다.');
            setTimeout(() => setSaveMessage(''), 3000);
        } finally {
            setIsSaving(false);
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
                // 데이터 마이그레이션: subrogationData -> subrogatedList
                const migratedCreditors = list.data.creditors.map(c => {
                    if (c.isSubrogated && c.subrogationData && (!c.subrogatedList || c.subrogatedList.length === 0)) {
                        return {
                            ...c,
                            subrogatedList: [c.subrogationData]
                        };
                    }
                    return c;
                });
                setCreditors(migratedCreditors);
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
        setIsGenerating(true);
        try {
            console.log(`Generating document... LoggedIn: ${isLoggedIn}, LoadedId: ${loadedId}`);
            let res;
            if (isLoggedIn) {
                if (!loadedId) {
                    alert('먼저 데이터를 저장해주세요.');
                    setIsGenerating(false);
                    return;
                }
                res = await fetch(`/api/creditors/${loadedId}/generate`, {
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
                    const errorData = await res.json();
                    const errorMessage = errorData.error || JSON.stringify(errorData);
                    console.error('Generate failed:', errorMessage);
                    alert(`생성 실패 (회원): ${errorMessage}`);
                }
            } else {
                console.log('Generating local preview for guest');
                // 비로그인 사용자: 로컬 스토리지에 저장하고 미리보기 페이지로 이동 (DB 저장 안 함)
                const tempData = {
                    title: title || '체험용 문서',
                    data: { debtorInfo, creditors, repaymentPlan }
                };
                localStorage.setItem('temp_case_data', JSON.stringify(tempData));

                setSaveMessage('문서가 생성되었습니다.');
                setTimeout(() => setSaveMessage(''), 2000);

                // 미리보기 페이지로 이동
                router.push('/documents/preview');
            }
        } catch (error: any) {
            console.error('Generation error:', error);
            alert(`생성 중 오류가 발생했습니다: ${error.message}`);
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
                        disabled={!debtorInfo.name || debtorInfo.birthDate.length !== 8}
                        className={`px-4 py-2 font-medium text-base ${activeTab === 'creditor'
                            ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                            : debtorInfo.name && debtorInfo.birthDate.length === 8
                                ? 'text-gray-600 hover:text-gray-900'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        2. 채권자정보
                    </button>
                    <button
                        onClick={() => setActiveTab('plan')}
                        disabled={!loadedId && creditors.length === 0}
                        className={`px-4 py-2 font-medium text-base ${activeTab === 'plan'
                            ? 'border-b-2 border-blue-600 text-blue-600 -mb-0.5'
                            : loadedId || creditors.length > 0
                                ? 'text-gray-600 hover:text-gray-900'
                                : 'text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        3. 변제계획
                    </button>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4 pb-3 border-b-2 border-gray-300">
                    <div className="flex-1 w-full md:w-auto">
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="사건명을 입력하세요 (미입력 시 자동생성)"
                                className="text-lg font-bold text-gray-900 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none bg-transparent w-full transition-colors placeholder:text-gray-400 placeholder:font-normal"
                            />
                        </div>
                    </div>
                    {!isLoggedIn && (
                        <button
                            onClick={handleLoadSampleData}
                            className="px-3 py-1 bg-green-600 text-white border border-green-700 hover:bg-green-700 text-base rounded shadow-sm flex items-center gap-1"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            샘플데이터 입력(체험)
                        </button>
                    )}
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
                        onAddSubrogation={handleAddSubrogation}
                        onRemoveSubrogation={handleRemoveSubrogation}
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

export default function CreditorListPage() {
    return (
        <React.Suspense fallback={
            <MainLayout>
                <div className="flex justify-center items-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
            </MainLayout>
        }>
            <CreditorListContent />
        </React.Suspense>
    );
}
