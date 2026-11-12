import React from 'react';
import { DebtorInfo } from '../types';

interface DebtorInfoFormProps {
    debtorInfo: DebtorInfo;
    onChange: (info: DebtorInfo) => void;
}

export function DebtorInfoForm({ debtorInfo, onChange }: DebtorInfoFormProps) {
    return (
        <div className="rounded-xl bg-white border border-slate-200 p-4 sm:p-5">
            <h2 className="text-lg font-bold mb-2 text-gray-900">채무자 기본정보</h2>
            <p className="text-base text-blue-600 mb-4 bg-blue-50 p-2 border-l-4 border-blue-600">
                ℹ️ 성명과 생년월일은 저장·문서 생성에 필요합니다. 입력 후 하단의 다음 단계로 이동하세요.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                    <label htmlFor={`DebtorInfoForm--1`} className="block text-sm font-medium text-gray-700 mb-1">성명 *</label>
                    <input id={`DebtorInfoForm--1`}
                        type="text"
                        value={debtorInfo.name}
                        onChange={(e) => onChange({ ...debtorInfo, name: e.target.value })}
                        placeholder="홍길동"
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                    />
                </div>
                <div>
                    <label htmlFor={`DebtorInfoForm--2`} className="block text-sm font-medium text-gray-700 mb-1">생년월일 *</label>
                    <input id={`DebtorInfoForm--2`}
                        type="text" inputMode="numeric"
                        value={debtorInfo.birthDate}
                        onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                            onChange({ ...debtorInfo, birthDate: value });
                        }}
                        placeholder="19820105"
                        maxLength={8}
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                    />
                </div>
                <div>
                    <label htmlFor={`DebtorInfoForm--3`} className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                    <input id={`DebtorInfoForm--3`}
                        type="tel"
                        value={debtorInfo.phone}
                        onChange={(e) => onChange({ ...debtorInfo, phone: e.target.value })}
                        placeholder="010-1234-5678"
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                    />
                </div>
                <div className="md:col-span-2">
                    <label htmlFor={`DebtorInfoForm--4`} className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                    <input id={`DebtorInfoForm--4`}
                        type="text"
                        value={debtorInfo.address}
                        onChange={(e) => onChange({ ...debtorInfo, address: e.target.value })}
                        placeholder="서울시 강남구 테헤란로 123"
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                    />
                </div>
                <div>
                    <label htmlFor={`DebtorInfoForm--5`} className="block text-sm font-medium text-gray-700 mb-1">관할법원</label>
                    <input id={`DebtorInfoForm--5`}
                        type="text"
                        value={debtorInfo.court}
                        onChange={(e) => onChange({ ...debtorInfo, court: e.target.value })}
                        placeholder="서울회생법원"
                        className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                    />
                </div>
            </div>
        </div>
    );
}
