'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';

export default function HomePage() {
  const router = useRouter();

  const steps = [
    {
      number: '01',
      title: '채무자 정보 입력',
      description: '기본적인 인적사항과 법원 정보를 입력합니다.',
      icon: '👤',
      color: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      number: '02',
      title: '채권자 정보 입력',
      description: '채권 내역, 원금, 이자 및 담보 유무를 상세히 입력합니다.',
      icon: '💳',
      color: 'bg-indigo-50',
      textColor: 'text-indigo-600'
    },
    {
      number: '03',
      title: '변제 계획안 입력',
      description: '소득 및 피부양자 정보를 토대로 구체적인 변제안을 구상합니다.',
      icon: '📊',
      color: 'bg-purple-50',
      textColor: 'text-purple-600'
    },
    {
      number: '04',
      title: '순식간에 생성!',
      description: '버튼 하나로 완성된 채권자 목록과 변제계획안이 즉시 출력됩니다.',
      icon: '⚡',
      color: 'bg-yellow-50',
      textColor: 'text-yellow-600'
    }
  ];

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* 헤더 섹션 */}
        <div className="text-center mb-20 animate-fade-in">
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-full text-sm font-medium mb-6 shadow-sm">
            <span>법원 업무의 새로운 기준, Court-Easy</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
            복잡한 서류 작업, <span className="text-blue-600">클릭 몇 번으로 해결</span>하세요.
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            채무자, 채권자 정보와 변제계획만 입력해 주세요.
            전문적인 채권자 목록과 변제계획안이 마법처럼 생성됩니다.
          </p>
        </div>

        {/* 프로세스 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative group p-8 bg-white rounded-3xl border border-gray-100 shadow-xl hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 overflow-hidden"
            >
              <div className={`absolute top-0 right-0 p-4 font-black text-6xl opacity-20 ${step.textColor}`}>
                {step.number}
              </div>
              <div className={`w-16 h-16 ${step.color} rounded-2xl flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform`}>
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* 하이라이트 섹션 */}
        <div className="bg-gray-900 rounded-[2.5rem] p-10 md:p-16 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-10 left-10 w-40 h-40 bg-blue-500 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-10 right-10 w-40 h-40 bg-purple-500 rounded-full blur-[100px]"></div>
          </div>

          <h2 className="text-3xl md:text-4xl font-bold mb-8 relative z-10">
            "채권자 목록 및 변제계획안 생성"
          </h2>
          <p className="text-xl md:text-2xl text-gray-300 mb-10 max-w-3xl mx-auto font-light leading-relaxed relative z-10">
            이 버튼만 누르면 <span className="text-blue-400 font-bold underline underline-offset-8">순식간에</span> 모든 서류가 만들어집니다.
            시스템의 강력한 자동화 엔진이 당신의 업무를 대신합니다.
          </p>

          <button
            onClick={() => router.push('/case-input')}
            className="bg-white text-gray-900 px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-colors shadow-2xl relative z-10"
          >
            지금 바로 시작하기 →
          </button>
        </div>

        {/* 푸터 팁 */}
        <div className="mt-16 text-center text-gray-400 text-sm italic">
          * Court-Easy는 전문적인 법률 지식 없이도 개인회생 서류를 완벽하게 작성할 수 있도록 돕습니다.
        </div>
      </div>
    </MainLayout>
  );
}

