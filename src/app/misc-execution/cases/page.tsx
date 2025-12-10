import { MainLayout } from '@/components/layout';

export default function MiscExecutionCasesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">사건 목록</h1>
            <p className="text-gray-600 mt-2">기타집행 사건 전체 조회</p>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            + 새 사건 등록
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 border-b">
            <div className="grid grid-cols-4 gap-4">
              <input
                type="text"
                placeholder="사건번호 검색"
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">상태 전체</option>
                <option value="PENDING">접수 대기</option>
                <option value="IN_PROGRESS">진행 중</option>
                <option value="COMPLETED">완료</option>
                <option value="REJECTED">반려</option>
              </select>
              <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="">유형 전체</option>
                <option value="PROPERTY_INQUIRY">재산조회</option>
                <option value="SEIZURE">압류</option>
                <option value="COLLECTION">추심</option>
                <option value="OTHERS">기타</option>
              </select>
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                검색
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사건번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사건명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    채권자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    채무자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    2024집행1234
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    재산조회 신청
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    재산조회
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    홍길동
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    김철수
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      진행중
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2024-12-10
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    2024집행1233
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    압류 신청
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    압류
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    이영희
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    박민수
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      완료
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    2024-12-09
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t flex items-center justify-between">
            <p className="text-sm text-gray-700">
              총 <span className="font-medium">2</span>건
            </p>
            <div className="flex space-x-2">
              <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                이전
              </button>
              <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm">
                1
              </button>
              <button className="px-3 py-1 border border-gray-300 rounded text-sm hover:bg-gray-50">
                다음
              </button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
