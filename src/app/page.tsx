'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { MainLayout } from '@/components/layout';

type IconName = 'document' | 'calculator' | 'folder' | 'megaphone';

const services: {
  title: string;
  description: string;
  status: '이용 가능';
  buttonLabel: string;
  href: string;
  icon: IconName;
}[] = [
  {
    title: '개인회생 서류 작성',
    description: '채무자·채권자 정보를 입력하고 필요한 서류를 생성합니다.',
    status: '이용 가능',
    buttonLabel: '시작하기',
    href: '/case-input',
    icon: 'document',
  },
  {
    title: '소송비용액 확정 계산',
    description: '판결 내용과 비용 항목을 기준으로 부담액을 계산합니다.',
    status: '이용 가능',
    buttonLabel: '열기',
    href: '/case-list',
    icon: 'calculator',
  },
];

const statusStyles = {
  '작성 중': 'bg-blue-100 text-blue-700',
  완료: 'bg-emerald-100 text-emerald-700',
  '검토 필요': 'bg-amber-100 text-amber-700',
} as const;

type TaskStatus = keyof typeof statusStyles;

const recentTasks: { title: string; service: string; status: TaskStatus; updated: string }[] = [
  { title: '김OO 개인회생 서류', service: '개인회생 서류 작성', status: '작성 중', updated: '2024-05-21 14:35' },
  { title: '이OO 소송비용 계산', service: '소송비용액 확정 계산', status: '완료', updated: '2024-05-21 10:22' },
  { title: '박OO 개인회생 서류', service: '개인회생 서류 작성', status: '검토 필요', updated: '2024-05-20 16:48' },
  { title: '서울중앙지방법원 소송비용 계산', service: '소송비용액 확정 계산', status: '작성 중', updated: '2024-05-20 11:03' },
  { title: '강OO 소송비용 계산', service: '소송비용액 확정 계산', status: '완료', updated: '2024-05-19 15:17' },
];

const notifications: { title: string; description: string; icon: IconName }[] = [
  { title: '생성 문서 확인', description: '생성된 문서를 확인하고 다운로드할 수 있습니다.', icon: 'document' },
  { title: '임시 저장 문서', description: '임시 저장된 문서가 3건 있습니다. 이어 작성해 주세요.', icon: 'folder' },
  { title: '지원 안내', description: '1:1 문의에 대한 답변이 도착했습니다. 확인해 주세요.', icon: 'megaphone' },
];

function Icon({ name, className = 'h-7 w-7' }: { name: IconName; className?: string }) {
  const common = {
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.9,
    viewBox: '0 0 24 24',
  };

  switch (name) {
    case 'calculator':
      return <svg {...common}><rect x="6" y="3" width="12" height="18" rx="2" /><path d="M8.5 7h7" /><path d="M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01M9 18h.01M12 18h.01M15 18h.01" /></svg>;
    case 'folder':
      return <svg {...common}><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /></svg>;
    case 'megaphone':
      return <svg {...common}><path d="m4 13 3 7 3-2-2-5" /><path d="M5 13h3l10-6v11L8 13" /><path d="M19 9.5a3.5 3.5 0 0 1 0 7" /></svg>;
    default:
      return <svg {...common}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v5h5" /><path d="M10 13h4" /><path d="M10 17h3" /></svg>;
  }
}

export default function HomePage() {
  const router = useRouter();

  return (
    <MainLayout wide>
      <div className="px-4 py-8 md:px-7 md:py-9">
        <div className="mx-auto w-full max-w-[1160px] space-y-5">
          <div>
            <div>
              <h1 className="text-3xl font-bold tracking-normal text-slate-950 md:text-[34px]">업무 홈</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                진행할 업무 서비스를 선택하거나 최근 작업을 이어서 진행하세요.
              </p>
            </div>
          </div>

          <section className="pt-5">
            <h2 className="mb-5 text-xl font-bold text-slate-950">이용 가능한 서비스</h2>
            <div className="grid w-full gap-5 md:grid-cols-2">
              {services.map((service) => (
                <article key={service.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex h-full flex-col gap-5 lg:flex-row lg:items-center">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 lg:h-16 lg:w-16">
                      <Icon name={service.icon} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-bold text-slate-950">{service.title}</h3>
                        <span className="inline-flex w-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          {service.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{service.description}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => router.push(service.href)}
                      className="h-10 w-full rounded-md border border-blue-600 bg-white px-5 text-sm font-bold text-blue-600 transition hover:bg-blue-50 lg:w-32"
                    >
                      {service.buttonLabel}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="grid gap-5 pt-1 xl:grid-cols-[minmax(680px,1fr)_minmax(340px,380px)]">
            <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h2 className="text-lg font-bold text-slate-950">최근 작업</h2>
                <button
                  type="button"
                  onClick={() => router.push('/case-list')}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  전체 보기
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
              <div className="overflow-x-auto rounded-md border border-slate-200">
                <table className="min-w-[680px] w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">업무명</th>
                      <th className="px-4 py-3">서비스</th>
                      <th className="px-4 py-3">상태</th>
                      <th className="px-4 py-3">최근 수정일</th>
                      <th className="px-4 py-3 text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {recentTasks.map((task) => (
                      <tr key={`${task.title}-${task.updated}`} className="hover:bg-slate-50">
                        <td className="px-4 py-3.5 font-medium text-slate-800">{task.title}</td>
                        <td className="px-4 py-3.5 text-slate-700">{task.service}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusStyles[task.status]}`}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{task.updated}</td>
                        <td className="px-4 py-3.5 text-center text-slate-500">
                          <button type="button" className="font-bold tracking-[0.2em]" aria-label={`${task.title} 작업 메뉴`}>
                            ...
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-end gap-5 text-sm text-slate-700">
                <span>1-5 / 12</span>
                <button type="button" className="text-slate-400" aria-label="이전 페이지">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 font-bold text-white">1</button>
                <button type="button" className="font-medium">2</button>
                <button type="button" className="font-medium">3</button>
                <button type="button" aria-label="다음 페이지">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
                  </svg>
                </button>
                <button type="button" aria-label="마지막 페이지">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m7 18 6-6-6-6M13 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </section>

            <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-6 shadow-sm xl:min-w-[340px]">
              <h2 className="mb-5 text-lg font-bold text-slate-950">업무 알림</h2>
              <div className="overflow-hidden rounded-md border border-slate-200">
                {notifications.map((note, index) => (
                  <button
                    key={note.title}
                    type="button"
                    className={`flex w-full items-center gap-4 p-5 text-left transition hover:bg-slate-50 ${index > 0 ? 'border-t border-slate-200' : ''}`}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Icon name={note.icon} className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold text-slate-950">
                        {note.title}
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                      </span>
                      <span className="mt-1 block text-sm leading-5 text-slate-600">{note.description}</span>
                    </span>
                    <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
