'use client';

import { MainLayout } from '@/components/layout';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewCasePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    caseNumber: '',
    title: '',
    type: '',
    plaintiff: '',
    defendant: '',
    amount: '',
    description: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 사건 등록 API 호출
    console.log('New case:', formData);
    alert('사건이 등록되었습니다.');
    router.push('/misc-execution/cases');
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">새 사건 등록</h1>
          <p className="text-gray-600 mt-2">기타집행 사건 정보를 입력하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2">
              <label htmlFor="caseNumber" className="block text-sm font-medium text-gray-700 mb-2">
                사건번호 *
              </label>
              <input
                id="caseNumber"
                name="caseNumber"
                type="text"
                value={formData.caseNumber}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="예: 2024집행1234"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                사건명 *
              </label>
              <input
                id="title"
                name="title"
                type="text"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="사건명을 입력하세요"
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                사건 유형 *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">선택하세요</option>
                <option value="PROPERTY_INQUIRY">재산조회</option>
                <option value="SEIZURE">압류</option>
                <option value="COLLECTION">추심</option>
                <option value="OTHERS">기타</option>
              </select>
            </div>

            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                청구금액 (원)
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label htmlFor="plaintiff" className="block text-sm font-medium text-gray-700 mb-2">
                채권자 *
              </label>
              <input
                id="plaintiff"
                name="plaintiff"
                type="text"
                value={formData.plaintiff}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="채권자명"
              />
            </div>

            <div>
              <label htmlFor="defendant" className="block text-sm font-medium text-gray-700 mb-2">
                채무자 *
              </label>
              <input
                id="defendant"
                name="defendant"
                type="text"
                value={formData.defendant}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="채무자명"
              />
            </div>

            <div className="col-span-2">
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                사건 설명
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="사건에 대한 자세한 설명을 입력하세요"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              등록
            </button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
