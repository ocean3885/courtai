'use client';

import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout';
import { useRouter } from 'next/navigation';

interface SubrogatedCreditor {
    id: string;
    number: string; // 예: 14-1
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
}

export default function CreditorListPage() {
    const router = useRouter();
    const [user, setUser] = useState<{ id: number; role: string } | null>(null);
    const [creditors, setCreditors] = useState<Creditor[]>([]);
    const [title, setTitle] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadedId, setLoadedId] = useState<string | null>(null);
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [savedLists, setSavedLists] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.ok ? res.json() : null)
            .then(data => data && setUser(data.user));
    }, []);

    const isLoggedIn = !!user;

    const handleAddCreditor = () => {
        const nextNumber = creditors.length > 0
            ? Math.max(...creditors.map(c => parseInt(c.number) || 0)) + 1
            : 1;

        setCreditors([
            ...creditors,
            {
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
                baseDate: new Date().toISOString().split('T')[0],
                isSubrogated: false,
            }
        ]);
    };

    const handleRemoveCreditor = (id: string) => {
        setCreditors(creditors.filter(c => c.id !== id));
    };

    const updateCreditor = (id: string, field: keyof Creditor, value: any) => {
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
                            interest: 0,
                            interestStartDate: '',
                            interestRate: '약정',
                            baseDate: c.baseDate,
                        }
                    };
                }
                return { ...c, [field]: value };
            }
            return c;
        }));
    };

    const updateSubrogation = (id: string, field: keyof SubrogatedCreditor, value: any) => {
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

    const handleSave = async () => {
        if (!title.trim()) {
            alert('목록 제목을 입력해주세요.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch(loadedId ? `/api/creditors/${loadedId}` : '/api/creditors', {
                method: loadedId ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, data: creditors }),
            });
            if (res.ok) {
                const json = await res.json();
                if (!loadedId) setLoadedId(json.id);
                alert('저장되었습니다.');
            }
        } catch (error) {
            alert('저장 중 오류가 발생했습니다.');
        } finally {
            setIsSaving(false);
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

    const handleLoad = (list: any) => {
        setTitle(list.title);
        setCreditors(list.data);
        setLoadedId(list.id);
        setShowLoadModal(false);
    };

    const handleDeleteList = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const res = await fetch(`/api/creditors/${id}`, { method: 'DELETE' });
        if (res.ok) fetchSavedLists();
    };

    return (
        <MainLayout>
            <div className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex-1 w-full">
                        <input
                            type="text"
                            placeholder="채권자목록 제목 (예: 2024 홍길동 채권자목록)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-2xl font-bold text-gray-900 border-b-2 border-transparent hover:border-gray-200 focus:border-blue-600 focus:outline-none bg-transparent w-full transition-all"
                        />
                    </div>
                    {isLoggedIn && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => { fetchSavedLists(); setShowLoadModal(true); }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm flex items-center gap-2"
                            >
                                📁 불러오기
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                            >
                                {isSaving ? '저장 중...' : '💾 저장'}
                            </button>
                            {loadedId && (
                                <button
                                    onClick={() => { setLoadedId(null); setTitle(''); setCreditors([]); }}
                                    className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium text-sm"
                                >
                                    ✨ 새로작성
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="space-y-6">
                    {creditors.length === 0 ? (
                        <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                            <p className="text-gray-500 mb-4">입력된 채권자가 없습니다.</p>
                            <button
                                onClick={handleAddCreditor}
                                className="px-6 py-3 bg-white text-blue-600 border border-blue-200 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-sm"
                            >
                                + 첫 번째 채권자 추가
                            </button>
                        </div>
                    ) : (
                        creditors.map((c, index) => (
                            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                                <div className="bg-gray-50 px-6 py-4 flex justify-between items-center border-b border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <span className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                                            {c.number}
                                        </span>
                                        <h3 className="font-bold text-gray-900">{c.name || '새 채권자'}</h3>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCreditor(c.id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">채권번호</label>
                                        <input
                                            type="text"
                                            value={c.number}
                                            onChange={(e) => updateCreditor(c.id, 'number', e.target.value)}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">채권자명</label>
                                        <input
                                            type="text"
                                            value={c.name}
                                            onChange={(e) => updateCreditor(c.id, 'name', e.target.value)}
                                            placeholder="(주)엔씨자산관리대부"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-1">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">주소</label>
                                        <input
                                            type="text"
                                            value={c.address}
                                            onChange={(e) => updateCreditor(c.id, 'address', e.target.value)}
                                            placeholder="서울시 구로구 디지털로30길 28, 209호"
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">원인</label>
                                        <textarea
                                            value={c.reason}
                                            onChange={(e) => updateCreditor(c.id, 'reason', e.target.value)}
                                            placeholder="2002.12.20.자 (주)나이스대부 대출금 양수채권"
                                            rows={2}
                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none resize-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">전화</label>
                                        <input type="text" value={c.phone} onChange={(e) => updateCreditor(c.id, 'phone', e.target.value)} placeholder="02-2135-7339" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">팩스</label>
                                        <input type="text" value={c.fax} onChange={(e) => updateCreditor(c.id, 'fax', e.target.value)} placeholder="0504-847-9030" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">원금</label>
                                        <input type="number" value={c.principal} onChange={(e) => updateCreditor(c.id, 'principal', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">이자</label>
                                        <input type="number" value={c.interest} onChange={(e) => updateCreditor(c.id, 'interest', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">이자기산일</label>
                                        <input type="text" value={c.interestStartDate} onChange={(e) => updateCreditor(c.id, 'interestStartDate', e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">이자이율</label>
                                        <input type="text" value={c.interestRate} onChange={(e) => updateCreditor(c.id, 'interestRate', e.target.value)} placeholder="약정 또는 0.2%" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">산정기준일</label>
                                        <input type="date" value={c.baseDate} onChange={(e) => updateCreditor(c.id, 'baseDate', e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                    </div>
                                    <div className="flex items-center gap-2 mt-4">
                                        <input
                                            type="checkbox"
                                            id={`sub-${c.id}`}
                                            checked={c.isSubrogated}
                                            onChange={(e) => updateCreditor(c.id, 'isSubrogated', e.target.checked)}
                                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                        />
                                        <label htmlFor={`sub-${c.id}`} className="text-sm font-semibold text-gray-700 cursor-pointer">대위변제자 있음</label>
                                    </div>
                                </div>

                                {c.isSubrogated && c.subrogationData && (
                                    <div className="bg-blue-50/50 p-6 border-t border-blue-100">
                                        <div className="flex items-center gap-3 mb-6">
                                            <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border border-blue-200">
                                                {c.subrogationData.number}
                                            </span>
                                            <h4 className="font-bold text-blue-900">대위변제자 정보</h4>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">채권번호</label>
                                                <input readOnly value={c.subrogationData.number} className="w-full px-3 py-2 bg-white/50 border border-blue-100 rounded-lg text-blue-700 font-medium cursor-default outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">대위변제자명</label>
                                                <input type="text" value={c.subrogationData.name} onChange={(e) => updateSubrogation(c.id, 'name', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">주소</label>
                                                <input type="text" value={c.subrogationData.address} onChange={(e) => updateSubrogation(c.id, 'address', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div className="lg:col-span-3">
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">원인 (대위변제)</label>
                                                <textarea value={c.subrogationData.reason} onChange={(e) => updateSubrogation(c.id, 'reason', e.target.value)} rows={2} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">전화</label>
                                                <input type="text" value={c.subrogationData.phone} onChange={(e) => updateSubrogation(c.id, 'phone', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">원금</label>
                                                <input type="number" value={c.subrogationData.principal} onChange={(e) => updateSubrogation(c.id, 'principal', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">산정기준일</label>
                                                <input type="date" value={c.subrogationData.baseDate} onChange={(e) => updateSubrogation(c.id, 'baseDate', e.target.value)} className="w-full px-3 py-2 bg-white border border-blue-100 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
                    )}

                    {creditors.length > 0 && (
                        <div className="pt-4">
                            <button
                                onClick={handleAddCreditor}
                                className="w-full py-4 bg-gray-50 text-gray-600 border-2 border-dashed border-gray-200 rounded-2xl font-bold hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all group"
                            >
                                <span className="inline-block transform group-hover:scale-110 transition-transform mr-2">+</span>
                                다음 채권자 추가
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* 불러오기 모달 */}
            {showLoadModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-900">저장된 목록 불러오기</h3>
                            <button onClick={() => setShowLoadModal(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            {isLoading ? (
                                <div className="text-center py-10 text-gray-500">로딩 중...</div>
                            ) : savedLists.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">저장된 목록이 없습니다.</div>
                            ) : (
                                savedLists.map(list => (
                                    <div
                                        key={list.id}
                                        onClick={() => handleLoad(list)}
                                        className="group p-4 bg-gray-50 rounded-2xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-bold text-gray-900 group-hover:text-blue-700">{list.title}</p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                작성일: {new Date(list.updated_at).toLocaleDateString()} · 채권자 {list.data.length}명
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
                            )}
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    );
}
