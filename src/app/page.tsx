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
            채권자목록, 변제계획표 작성 등 복잡하고 번거로운 법원 업무를<br className="hidden md:block" />
            지능형 시스템으로 쉽고 빠르게 지원합니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 pt-6">
            <Link 
              href="/auth/signup" 
              className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 text-lg"
            >
              지금 시작하기
            </Link>
            <Link 
              href="/rehabilitation" 
              className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 font-bold rounded-xl border-2 border-gray-100 hover:border-blue-100 hover:bg-gray-50 transition-all text-lg"
            >
              기능 둘러보기
            </Link>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-6xl mx-auto">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              📝
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">채권자목록 작성</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              복잡한 채권 관계를 한눈에 정리하고 표준 서식에 맞춰 자동으로 리스트를 생성합니다.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              📊
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">변제계획표 자동화</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              수입과 지출 데이터를 바탕으로 최적의 변제 계획안을 시뮬레이션하고 작성합니다.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-left hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-6 text-2xl">
              ⚖️
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">기타집행 지원</h3>
            <p className="text-gray-600 text-sm md:text-base leading-relaxed">
              다양한 기타집행 사건의 절차적 편의를 제공하여 실무자의 업무 효율을 극대화합니다.
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
