import React from 'react';
import { Creditor, SubrogatedCreditor, SecuredCreditorData } from '../types';
import { formatCurrency, parseCurrency } from '../utils';

interface CreditorInfoFormProps {
    creditors: Creditor[];
    onAdd: () => void;
    onRemove: (id: string) => void;
    onUpdate: (id: string, field: keyof Creditor, value: string | number | boolean | string[]) => void;
    onUpdateSubrogation: (creditorId: string, subId: string, field: keyof SubrogatedCreditor, value: string | number) => void;
    onAddSubrogation: (creditorId: string) => void;
    onRemoveSubrogation: (creditorId: string, subId: string) => void;
    onUpdateSecured: (id: string, field: keyof SecuredCreditorData, value: string | number) => void;
}

export function CreditorInfoForm({
    creditors,
    onAdd,
    onRemove,
    onUpdate,
    onUpdateSubrogation,
    onAddSubrogation,
    onRemoveSubrogation,
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
                                <input
                                    id={`interest-rate-${c.id}`}
                                    type="text"
                                    value={c.interestRate}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Allow max 2 decimals, max 2 digits integer (block 100 or >= 100 logic by digit count), allow empty
                                        if ((/^\d{0,2}(\.\d{0,2})?$/.test(val)) || val === '') {
                                            onUpdate(c.id, 'interestRate', val);
                                        }
                                    }}
                                    placeholder="숫자 입력"
                                    className="w-full px-2 py-1 border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                />
                                <div className="flex gap-2 mt-1">
                                    {['약정', '연체'].map(val => (
                                        <button
                                            key={val}
                                            onClick={() => onUpdate(c.id, 'interestRate', val)}
                                            className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 border border-gray-300"
                                        >
                                            {val}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => {
                                            onUpdate(c.id, 'interestRate', '0');
                                            setTimeout(() => document.getElementById(`interest-rate-${c.id}`)?.focus(), 0);
                                        }}
                                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700 border border-gray-300"
                                    >
                                        숫자
                                    </button>
                                </div>
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

                            <div className="md:col-span-2 lg:col-span-4 border-t border-gray-300 pt-2 mt-1">
                                <label className="block text-sm font-medium text-gray-700 mb-2">부속서류 (중복 선택 가능)</label>
                                <div className="flex flex-col md:flex-row gap-x-4 gap-y-2 flex-wrap">
                                    {[
                                        { id: '1', label: '1. 별제권부 채권 및 이에 준하는 채권' },
                                        { id: '2', label: '2. 다툼이 있거나 예상되는 채권의 내역' },
                                        { id: '3', label: '3. 전부명령 내역' },
                                        { id: '4', label: '4. 기타의 경우' }
                                    ].map((opt) => (
                                        <label key={opt.id} className="flex items-center gap-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={(c.attachmentTypes || []).includes(opt.id)}
                                                onChange={(e) => {
                                                    const current = c.attachmentTypes || [];
                                                    const next = e.target.checked
                                                        ? [...current, opt.id]
                                                        : current.filter(id => id !== opt.id);
                                                    onUpdate(c.id, 'attachmentTypes', next);
                                                }}
                                                className="w-4 h-4"
                                            />
                                            <span className="text-sm text-gray-700">{opt.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 대위변제자 목록 렌더링 */}
                        {c.isSubrogated && (
                            <div className="bg-blue-50 border-t-2 border-blue-400">
                                {((c.subrogatedList) || (c.subrogationData ? [c.subrogationData] : [])).map((sub, idx) => (
                                    <div key={sub.id} className={`${idx > 0 ? 'border-t border-blue-200' : ''} p-3 relative`}>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-blue-700 text-white px-2 py-1 text-sm font-bold">
                                                    {sub.number}
                                                </span>
                                                <h4 className="font-bold text-base text-blue-900">대위변제자 정보 {idx + 1}</h4>
                                            </div>
                                            {/* 첫 번째 대위변제자 삭제 불가 정책이 있다면 idx > 0 조건 추가 가능하지만, 
                                                기본적으로 모든 대위변제자는 삭제 가능하게 하고, 다 지워지면 대위변제 여부를 false로 끌지는 UX 결정 사항.
                                                여기서는 자유롭게 삭제 가능하게 함. */}
                                            <button
                                                onClick={() => onRemoveSubrogation(c.id, sub.id)}
                                                className="text-blue-500 hover:text-red-600 text-sm px-2 py-1 border border-blue-200 bg-white hover:bg-red-50"
                                            >
                                                삭제
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">채권번호</label>
                                                <input readOnly value={sub.number} className="w-full px-2 py-1 bg-gray-100 border border-gray-400 text-base cursor-default outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">대위변제자명</label>
                                                <input type="text" value={sub.name} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'name', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-medium text-blue-900 mb-1">주소</label>
                                                <input type="text" value={sub.address} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'address', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div className="lg:col-span-4">
                                                <label className="block text-sm font-medium text-blue-900 mb-1">원인 (대위변제)</label>
                                                <textarea value={sub.reason} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'reason', e.target.value)} rows={2} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none resize-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">전화</label>
                                                <input type="text" value={sub.phone} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'phone', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">원금</label>
                                                <input type="text" value={formatCurrency(sub.principal)} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'principal', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">이자</label>
                                                <input type="text" value={formatCurrency(sub.interest || 0)} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'interest', parseCurrency(e.target.value))} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">이자기산일</label>
                                                <input type="date" max="9999-12-31" value={sub.interestStartDate || ''} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'interestStartDate', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">이자이율</label>
                                                <input
                                                    id={`sub-interest-rate-${sub.id}`}
                                                    type="text"
                                                    value={sub.interestRate || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if ((/^\d{0,2}(\.\d{0,2})?$/.test(val)) || val === '') {
                                                            onUpdateSubrogation(c.id, sub.id, 'interestRate', val);
                                                        }
                                                    }}
                                                    placeholder="숫자 입력"
                                                    className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none"
                                                />
                                                <div className="flex gap-2 mt-1">
                                                    {['약정', '연체'].map(val => (
                                                        <button
                                                            key={val}
                                                            onClick={() => onUpdateSubrogation(c.id, sub.id, 'interestRate', val)}
                                                            className="text-xs px-2 py-1 bg-white hover:bg-gray-100 rounded text-blue-900 border border-blue-200"
                                                        >
                                                            {val}
                                                        </button>
                                                    ))}
                                                    <button
                                                        onClick={() => {
                                                            onUpdateSubrogation(c.id, sub.id, 'interestRate', '0');
                                                            setTimeout(() => document.getElementById(`sub-interest-rate-${sub.id}`)?.focus(), 0);
                                                        }}
                                                        className="text-xs px-2 py-1 bg-white hover:bg-gray-100 rounded text-blue-900 border border-blue-200"
                                                    >
                                                        숫자
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-blue-900 mb-1">산정기준일</label>
                                                <input type="date" max="9999-12-31" value={sub.baseDate} onChange={(e) => onUpdateSubrogation(c.id, sub.id, 'baseDate', e.target.value)} className="w-full px-2 py-1 bg-white border border-gray-400 text-base focus:border-gray-600 focus:outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div className="p-3 bg-blue-100/50 border-t border-blue-200">
                                    <button
                                        onClick={() => onAddSubrogation(c.id)}
                                        className="w-full py-2 bg-white text-blue-800 border-2 border-dashed border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-base font-medium rounded"
                                    >
                                        + 대위변제자 추가
                                    </button>
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
