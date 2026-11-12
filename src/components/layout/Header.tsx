'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
      <div className="flex h-[68px] items-center justify-between gap-2 px-4 sm:gap-4 md:px-7">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={onMenuClick}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
              aria-label="메뉴 열기"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
                CE
              </span>
              <span className="whitespace-nowrap text-sm font-bold text-slate-950 sm:text-base">Court-Easy</span>
            </Link>
          </div>

          <form role="search" action="/case-list" method="get" className="relative hidden w-full max-w-[304px] md:block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />
              </svg>
            </span>
            <input
              type="search"
              aria-label="사건 제목 검색"
              name="q"
              placeholder="사건 제목 검색"
              className="h-10 w-full rounded-md border border-slate-300 bg-white py-2 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </form>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0 2c-4.1 0-7.5 2.1-7.5 4.7 0 1.2 1 2.3 2.3 2.3h10.4c1.3 0 2.3-1.1 2.3-2.3 0-2.6-3.4-4.7-7.5-4.7Z" />
                </svg>
              </div>
              <Link
                href="/auth/change-password"
                className="hidden text-sm font-semibold text-slate-900 transition-colors hover:text-blue-600 sm:block"
                title="비밀번호 변경"
              >
                {user.username}님
              </Link>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-red-600 lg:block"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-slate-700 transition-colors hover:text-blue-600"
              >
                로그인
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                회원가입
              </Link>
            </div>
          )}

        </div>
      </div>
    </header>
  );
}
