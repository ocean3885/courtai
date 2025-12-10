import { MainLayout } from '@/components/layout';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">대시보드</h1>
          <p className="text-gray-600 mt-2">
            Court GPT 업무 현황 및 통계
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">전체 사건</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">15</p>
                <p className="text-xs text-green-600 mt-1">↑ 3 from last week</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📋</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">진행 중</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">8</p>
                <p className="text-xs text-gray-500 mt-1">53% of total</p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⚡</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">완료</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">5</p>
                <p className="text-xs text-green-600 mt-1">↑ 2 this week</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">대기 중</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">2</p>
                <p className="text-xs text-gray-500 mt-1">Needs action</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">⏰</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">최근 활동</h2>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 pb-3 border-b">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">새로운 사건이 등록되었습니다</p>
                  <p className="text-xs text-gray-500 mt-1">2024집행1234 - 10분 전</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 pb-3 border-b">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">사건이 완료되었습니다</p>
                  <p className="text-xs text-gray-500 mt-1">2024집행1233 - 2시간 전</p>
                </div>
              </div>
              <div className="flex items-start space-x-3 pb-3 border-b">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">사용자 승인 요청</p>
                  <p className="text-xs text-gray-500 mt-1">이영희 - 5시간 전</p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">사건이 수정되었습니다</p>
                  <p className="text-xs text-gray-500 mt-1">2024집행1230 - 어제</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">빠른 실행</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link
                href="/execution/cases/new"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
              >
                <div className="text-3xl mb-2">➕</div>
                <p className="text-sm font-medium text-gray-700">새 사건 등록</p>
              </Link>
              <Link
                href="/execution/cases"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
              >
                <div className="text-3xl mb-2">📋</div>
                <p className="text-sm font-medium text-gray-700">사건 목록</p>
              </Link>
              <Link
                href="/admin/users"
                className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center"
              >
                <div className="text-3xl mb-2">👥</div>
                <p className="text-sm font-medium text-gray-700">사용자 관리</p>
              </Link>
              <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-center cursor-pointer">
                <div className="text-3xl mb-2">📊</div>
                <p className="text-sm font-medium text-gray-700">통계 보기</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
