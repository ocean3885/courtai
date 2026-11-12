'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout';

type RecentCase = { id: number; title: string; updated_at: string; documents: { id: number }[] };

export default function HomePage() {
  const [cases, setCases] = useState<RecentCase[]>([]);
  const [status, setStatus] = useState<'loading' | 'guest' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/creditors').then(async response => {
      if (cancelled) return;
      if (response.status === 401) { setStatus('guest'); return; }
      if (!response.ok) throw new Error('목록 조회 실패');
      const data = await response.json();
      if (!cancelled) { setCases(data); setStatus('ready'); }
    }).catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);
  return (
    <MainLayout wide>
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 md:px-7">
        <div><h1 className="text-3xl font-bold">업무 홈</h1><p className="mt-3 text-slate-600">개인회생 서류를 작성하고 저장된 사건을 이어서 작업하세요.</p></div>
        <section className="grid gap-5 md:grid-cols-2" aria-label="업무 서비스">
          <div className="rounded-lg border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold">개인회생 서류 작성</h2>
            <p className="my-4 text-slate-600">채무자·채권자 정보로 채권자목록과 변제계획안을 작성합니다.</p>
            <Link href="/case-input" className="inline-block rounded bg-blue-600 px-5 py-2 text-white">작성 시작</Link>
          </div>
          <div className="rounded-lg border border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold">내 사건과 문서</h2>
            <p className="my-4 text-slate-600">저장된 사건을 수정하고 생성된 문서를 확인합니다.</p>
            <Link href="/case-list" className="inline-block rounded border border-blue-600 px-5 py-2 text-blue-600">사건 목록</Link>
          </div>
        </section>
        <section className="rounded-lg border border-slate-200 p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-bold">최근 작업</h2><Link href="/case-list" className="text-blue-600">전체 보기</Link></div>
          {status === 'loading' && <p role="status">불러오는 중입니다.</p>}
          {status === 'guest' && <p>최근 작업은 <Link href="/auth/login" className="text-blue-600 underline">로그인</Link> 후 확인할 수 있습니다. 비회원도 서류 작성을 체험할 수 있습니다.</p>}
          {status === 'error' && <p role="alert" className="text-red-700">최근 작업을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>}
          {status === 'ready' && (cases.length ? <ul className="divide-y divide-slate-200">{cases.slice(0, 5).map(item => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div><Link href={`/case-input?id=${item.id}`} className="font-semibold text-blue-700 hover:underline">{item.title}</Link>
                <p className="mt-1 text-sm text-slate-500">{new Date(item.updated_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · 문서 {item.documents.length}건</p></div>
              <Link href={`/case-input?id=${item.id}`} className="rounded border px-3 py-1.5 text-sm">이어서 작성</Link>
            </li>
          ))}</ul> : <p className="text-slate-600">저장된 사건이 없습니다. 새 서류 작성을 시작해주세요.</p>)}
        </section>
        <section className="rounded-lg border border-slate-200 p-6"><h2 className="font-bold">문의하기</h2><p className="my-3 text-slate-600">사용 중 불편한 점이나 개선 의견을 남겨주세요.</p><Link href="/inquiry" className="text-blue-600 underline">문의 접수</Link></section>
      </div>
    </MainLayout>
  );
}
