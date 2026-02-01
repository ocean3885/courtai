import React from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';

export default function HomePage() {
  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium animate-fade-in shadow-sm">
            <span>법원 업무의 새로운 기준, Court-Easy</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 tracking-tight leading-tight">
            어려운 법원 업무,<br />
            <span className="text-blue-600">코트 이지</span>와 함께해요.
          </h1>

          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            채권자목록, 변제계획표 작성 등 복잡하고 번거로운 법원의 업무를<br className="hidden md:block" />
            지능형 시스템으로 쉽고 빠르게 지원합니다.
          </p>


        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              📝
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">변제 시뮬레이션 자동화</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              복잡한 가용소득 계산부터 회차별 변제금 산출까지 로직화하여, 법원 기준에 부합하는 최적의 계획안을 자동으로 도출합니다.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              📊
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">실시간 데이터 연동 편집</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              채권자 추가·삭제 및 금액 변동 사항을 입력하는 즉시, 클릭 한 번으로 변제계획표에 실시간 반영되어 재작성 번거로움을 없앱니다.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              ⚖️
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">법원 제출용 양식 출력</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              수기 입력의 실수(오타) 없이 최신 법정 표준 서식 그대로 출력하여, 제출 전 검토 시간과 보정 리스크를 혁신적으로 줄입니다.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
