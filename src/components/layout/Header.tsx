'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type HeaderUser = {
  name?: string;
  email?: string;
  role?: string;
};

const roleLabel: Record<string, string> = {
  ADMIN: '관리자',
  OPERATOR: '운영자',
  USER: '사용자',
  PENDING: '승인 대기',
};

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<HeaderUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;

    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/user');
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        if (active) {
          setUser(data.user);
        }
      } catch {
        setUser(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchUser();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
      setUser(null);
      router.push('/auth/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  const renderUser = () => {
    if (loading) {
      return (
        <div className="flex items-center space-x-3 animate-pulse">
          <div className="h-6 w-20 bg-gray-200 rounded" />
          <div className="h-6 w-16 bg-gray-200 rounded" />
        </div>
      );
    }

    if (!user) {
      return (
        <Link
          href="/auth/login"
          className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50"
        >
          로그인
        </Link>
      );
    }

    return (
      <div className="flex items-center space-x-4">
        <div className="text-sm text-gray-700 hidden sm:block">
          <span className="font-medium">{user.name || user.email || '사용자'}</span>
          {user.role && (
            <span className="text-gray-500 ml-2">{roleLabel[user.role] || user.role}</span>
          )}
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loggingOut ? '로그아웃...' : '로그아웃'}
        </button>
      </div>
    );
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-30">
      <div className="px-4 md:px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              aria-label="메뉴 열기"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-xl">C</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-none">Court GPT</h1>
                <p className="text-xs text-gray-500 hidden sm:block">법원 업무 지원 시스템</p>
              </div>
            </Link>
          </div>

          {renderUser()}
        </div>
      </div>
    </header>
  );
}
