import React from 'react';
import { Creditor, SubrogatedCreditor, SecuredCreditorData } from '../types';
import { formatCurrency, parseCurrency } from '../utils';

interface CreditorInfoFormProps {
    creditors: Creditor[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, field: keyof Creditor, value: string | number | boolean) => void;
    onUpdateSubrogation: (id: string, field: keyof SubrogatedCreditor, value: string | number) => void;
    onUpdateSecured: (id: string, field: keyof SecuredCreditorData, value: string | number) => void;
}

export function CreditorInfoForm({
    creditors,
    onAdd,
    onRemove,
    onUpdate,
    onUpdateSubrogation,
    onUpdateSecured
}: CreditorInfoFormProps) {
    return (
        <div className="space-y-3">
            {creditors.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 border border-gray-300">
                    <p className="text-gray-600 mb-3">입력된 채권자가 없습니다.</p>
                    <button
                        onClick={onAdd}
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
                                onClick={() => onRemove(c.id)}
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
                                    onChange={(e) => onUpdate(c.id, 'number', e.target.value)}
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">채권자명</label>
                                <input
                                    type="text"
                                    value={c.name}
                                    onChange={(e) => onUpdate(c.id, 'name', e.target.value)}
                                    placeholder="(주)엔씨자산관리대부"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">주소</label>
                                <input
                                    type="text"
                                    value={c.address}
                                    onChange={(e) => onUpdate(c.id, 'address', e.target.value)}
                                    placeholder="서울시 구로구 디지털로30길 28, 209호"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                            </div>
                            <div className="md:col-span-2 lg:col-span-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">원인</label>
                                <textarea
                                    value={c.reason}
                                    onChange={(e) => onUpdate(c.id, 'reason', e.target.value)}
                                    placeholder="2002.12.20.자 (주)나이스대부 대출금 양수채권"
                                    rows={2}
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">전화</label>
                                <input type="text" value={c.phone} onChange={(e) => onUpdate(c.id, 'phone', e.target.value)} placeholder="02-2135-7339" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">팩스</label>
                                <input type="text" value={c.fax} onChange={(e) => onUpdate(c.id, 'fax', e.target.value)} placeholder="0504-847-9030" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">원금</label>
                                <input type="text" value={formatCurrency(c.principal)} onChange={(e) => onUpdate(c.id, 'principal', parseCurrency(e.target.value))} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이자</label>
                                <input type="text" value={formatCurrency(c.interest)} onChange={(e) => onUpdate(c.id, 'interest', parseCurrency(e.target.value))} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이자기산일</label>
                                <input type="date" max="9999-12-31" value={c.interestStartDate} onChange={(e) => onUpdate(c.id, 'interestStartDate', e.target.value)} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이자이율</label>
                                <input type="text" value={c.interestRate} onChange={(e) => onUpdate(c.id, 'interestRate', e.target.value)} placeholder="약정 또는 0.2%" className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">산정기준일</label>
                                <input type="date" max="9999-12-31" value={c.baseDate} onChange={(e) => onUpdate(c.id, 'baseDate', e.target.value)} className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={c.isSubrogated}
                                        onChange={(e) => onUpdate(c.id, 'isSubrogated', e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-gray-700">대위변제자</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={c.isSecured}
                                        onChange={(e) => onUpdate(c.id, 'isSecured', e.target.checked)}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-gray-700">별제권부채권</span>
                                </label>
                                <label className="flex items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={c.isPreferential}
                                        onChange={(e) => onUpdate(c.id, 'isPreferential', e.target.checked)}
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
                                        <input type="text" value={c.subrogationData.name} onChange={(e) => onUpdateSubrogation(c.id, 'name', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-blue-900 mb-1">주소</label>
                                        <input type="text" value={c.subrogationData.address} onChange={(e) => onUpdateSubrogation(c.id, 'address', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div className="lg:col-span-4">
                                        <label className="block text-sm font-medium text-blue-900 mb-1">원인 (대위변제)</label>
                                        <textarea value={c.subrogationData.reason} onChange={(e) => onUpdateSubrogation(c.id, 'reason', e.target.value)} rows={2} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900 mb-1">전화</label>
                                        <input type="text" value={c.subrogationData.phone} onChange={(e) => onUpdateSubrogation(c.id, 'phone', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900 mb-1">구상원금</label>
                                        <input type="text" value={formatCurrency(c.subrogationData.principal)} onChange={(e) => onUpdateSubrogation(c.id, 'principal', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900 mb-1">손해금(기타)</label>
                                        <input type="text" value={formatCurrency(c.subrogationData.damages || 0)} onChange={(e) => onUpdateSubrogation(c.id, 'damages', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-blue-900 mb-1">산정기준일</label>
                                        <input type="date" max="9999-12-31" value={c.subrogationData.baseDate} onChange={(e) => onUpdateSubrogation(c.id, 'baseDate', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
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
                                            onChange={(e) => onUpdateSecured(c.id, 'currentAmount', parseCurrency(e.target.value))}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-purple-900 mb-1">채권최고액</label>
                                        <input
                                            type="text"
                                            value={formatCurrency(c.securedData.maxAmount)}
                                            onChange={(e) => onUpdateSecured(c.id, 'maxAmount', parseCurrency(e.target.value))}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-purple-900 mb-1">별제권행사 변제예상액</label>
                                        <input
                                            type="text"
                                            value={formatCurrency(c.securedData.expectedRepaymentAmount)}
                                            onChange={(e) => onUpdateSecured(c.id, 'expectedRepaymentAmount', parseCurrency(e.target.value))}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-purple-900 mb-1">담보부회생채권액</label>
                                        <input
                                            type="text"
                                            value={formatCurrency(c.securedData.securedRehabilitationAmount)}
                                            onChange={(e) => onUpdateSecured(c.id, 'securedRehabilitationAmount', parseCurrency(e.target.value))}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-purple-900 mb-1">별제권행사 변제불능액</label>
                                        <input
                                            type="text"
                                            value={formatCurrency(c.securedData.unrepayableAmount)}
                                            onChange={(e) => onUpdateSecured(c.id, 'unrepayableAmount', parseCurrency(e.target.value))}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-3">
                                        <label className="block text-sm font-medium text-purple-900 mb-1">환가예상액 (계산식)</label>
                                        <input
                                            type="text"
                                            value={c.securedData.expectedLiquidationValue}
                                            onChange={(e) => onUpdateSecured(c.id, 'expectedLiquidationValue', e.target.value)}
                                            placeholder="예: 12,950,000 X 0.7 = 9,065,000"
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-sm font-medium text-purple-900 mb-1">목적물</label>
                                        <textarea
                                            value={c.securedData.collateralObject}
                                            onChange={(e) => onUpdateSecured(c.id, 'collateralObject', e.target.value)}
                                            placeholder="예: 서울시 강남구 테헤란로 123 아파트 101호"
                                            rows={2}
                                            className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none"
                                        />
                                    </div>
                                    <div className="md:col-span-2 lg:col-span-4">
                                        <label className="block text-sm font-medium text-purple-900 mb-1">별제권내용</label>
                                        <textarea
                                            value={c.securedData.securedRightDetails}
                                            onChange={(e) => onUpdateSecured(c.id, 'securedRightDetails', e.target.value)}
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
                        onClick={onAdd}
                        className="w-full py-2 bg-white text-gray-700 border-2 border-dashed border-gray-400 hover:bg-gray-50 hover:border-gray-600 text-base font-medium"
                    >
                        + 다음 채권자 추가
                    </button>
                </div>
            )}
        </div>
    );
}
