import { MainLayout } from '@/components/layout';
import Link from 'next/link';

export default function MiscExecutionPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">기타집행 업무</h1>
          <p className="text-gray-600 mt-2">
            기타집행 관련 사건을 관리하고 처리합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link
            href="/execution/cases"
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">사건 목록</h3>
                <p className="text-sm text-gray-500">전체 사건 조회 및 관리</p>
              </div>
            </div>
          </Link>

          <Link
            href="/execution/cases/new"
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">➕</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">사건 등록</h3>
                <p className="text-sm text-gray-500">새로운 사건 접수</p>
              </div>
            </div>
          </Link>

          <Link
            href="/execution/statistics"
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">통계</h3>
                <p className="text-sm text-gray-500">업무 현황 및 통계</p>
              </div>
            </div>
          </Link>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">최근 사건</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-gray-900">2024집행1234</p>
                <p className="text-sm text-gray-500">재산조회 신청</p>
              </div>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm rounded-full">
                진행중
              </span>
            </div>
            <div className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-gray-900">2024집행1233</p>
                <p className="text-sm text-gray-500">압류 신청</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                완료
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-900">2024집행1232</p>
                <p className="text-sm text-gray-500">추심 신청</p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                접수
              </span>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
